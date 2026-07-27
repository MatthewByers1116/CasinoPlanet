// ClientGame: Core client controller managing loop, HUD bindings, local socket simulation, and build mode
(function() {
  class ClientGame {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.cellSize = 32; // size in pixels of each grid square
      
      this.playerId = 'player_local';
      this.chips = 0;
      this.isInMinigame = false;

      // Build mode state
      this.buildModeItem = null; // 'roulette', 'craps', 'bar' or null
      this.moveModeItem = null;  // moving object reference
      this.selectedObjectId = null;
      this.detailedMode = false;

      // Movement throttle
      this.lastMoveTime = 0;
      this.moveCooldown = 180; // ms per grid square step

      // Setup systems
      this.renderer = new window.Casino.Renderer(this.canvas, this.cellSize);
      this.inputHandler = new window.Casino.InputHandler(this.canvas, this.cellSize);
      this.minigameUI = new window.Casino.MinigameUI(document.getElementById('minigame-overlay'), this);

      // Local State Cache (replicated from simulator)
      this.state = {
        grid: { cols: 24, rows: 16, objects: [] },
        economy: { chips: 1000 },
        players: {},
        guests: {},
        employees: {}, // Replicated employees list
        sizeLevel: 1,
        happiness: 1.0,
        maxGuests: 10,
        unlockedTechs: []
      };

      // Reference to server simulator
      this.sim = null;

      // PeerJS multiplayer fields
      this.peer = null;
      this.playerName = 'Manager';
      this.playerSuitColor = '#00f0ff';
      this.playerHairColor = '#ffb300';
      const nameInput = document.getElementById('player-name-input');
      const suitColorInput = document.getElementById('player-suit-color');
      const hairColorInput = document.getElementById('player-hair-color');
      if (nameInput) {
        const savedName = localStorage.getItem('casino_player_name');
        if (savedName) nameInput.value = savedName;
        nameInput.addEventListener('input', () => {
          localStorage.setItem('casino_player_name', nameInput.value);
        });
      }
      if (suitColorInput) {
        const savedSuit = localStorage.getItem('casino_player_suit');
        if (savedSuit) {
          suitColorInput.value = savedSuit;
          this.playerSuitColor = savedSuit;
        }
        suitColorInput.addEventListener('input', () => {
          this.playerSuitColor = suitColorInput.value;
          localStorage.setItem('casino_player_suit', suitColorInput.value);
        });
      }
      if (hairColorInput) {
        const savedHair = localStorage.getItem('casino_player_hair');
        if (savedHair) {
          hairColorInput.value = savedHair;
          this.playerHairColor = savedHair;
        }
        hairColorInput.addEventListener('input', () => {
          this.playerHairColor = hairColorInput.value;
          localStorage.setItem('casino_player_hair', hairColorInput.value);
        });
      }
      this.peerConn = null; // Used in Guest mode
      this.connections = new Map(); // Used in Host mode (Peer ID -> DataConnection)
      this.isMultiplayerHost = false;
      this.isMultiplayerGuest = false;
    }

    connectToSimulator(sim) {
      if (this.sim) {
        this.sim.stop();
      }
      this.sim = sim;

      // Register network broadcast listener (Server -> Client)
      sim.onBroadcast = (event, payload) => {
        this.handleServerEvent(event, payload);
      };

      // Join the game!
      sim.addPlayer(this.playerId, this.playerName, this.playerSuitColor, this.playerHairColor);

      // Initialize state cache
      const fullState = sim.getFullState();
      this.state.grid = fullState.grid;
      this.state.economy = fullState.economy;
      this.state.players = fullState.players;
      this.state.guests = fullState.guests;
      this.state.sizeLevel = fullState.sizeLevel || 1;
      this.state.happiness = fullState.happiness !== undefined ? fullState.happiness : 1.0;
      this.state.unlockedTechs = fullState.unlockedTechs || [];

      this.chips = this.state.economy.chips;
      this.updateHUD();
    }

    start() {
      // Resize canvas to match container size
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());

      // Bind HUD panel clicks
      this.setupHUDBindings();

      // Bind Multiplayer Mode Selection buttons
      const modeOverlay = document.getElementById('mode-selection-overlay');
      const soloBtn = document.getElementById('mode-solo-btn');
      const hostBtn = document.getElementById('mode-host-btn');
      const joinBtn = document.getElementById('mode-join-btn');

      const diffOverlay = document.getElementById('difficulty-overlay');
      const joinOverlay = document.getElementById('join-room-overlay');

      if (modeOverlay) {
        const readPlayerName = () => {
          const nameInput = document.getElementById('player-name-input');
          this.playerName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : `Manager_${Math.floor(1000 + Math.random() * 9000)}`;
          const suitColorInput = document.getElementById('player-suit-color');
          const hairColorInput = document.getElementById('player-hair-color');
          if (suitColorInput) this.playerSuitColor = suitColorInput.value;
          if (hairColorInput) this.playerHairColor = hairColorInput.value;
        };

        if (soloBtn) {
          soloBtn.addEventListener('click', () => {
            readPlayerName();
            modeOverlay.style.display = 'none';
            if (diffOverlay) {
              diffOverlay.classList.remove('hidden');
              diffOverlay.style.display = 'flex';
            }
            // Initialize local GameSim server
            const sim = new window.Casino.GameSim();
            this.connectToSimulator(sim);
            sim.start();
          });
        }

        if (hostBtn) {
          hostBtn.addEventListener('click', () => {
            readPlayerName();
            modeOverlay.style.display = 'none';
            if (diffOverlay) {
              diffOverlay.classList.remove('hidden');
              diffOverlay.style.display = 'flex';
            }
            // Initialize WebRTC PeerJS hosting
            this.isMultiplayerHost = true;
            this.setupMultiplayerHost();
          });
        }

        if (joinBtn) {
          joinBtn.addEventListener('click', () => {
            readPlayerName();
            modeOverlay.style.display = 'none';
            if (joinOverlay) {
              joinOverlay.classList.remove('hidden');
              joinOverlay.style.display = 'flex';
            }
          });
        }

        const loadBtn = document.getElementById('mode-load-btn');
        if (loadBtn) {
          loadBtn.addEventListener('click', () => {
            modeOverlay.style.display = 'none';
            const loadOverlay = document.getElementById('load-game-overlay');
            if (loadOverlay) {
              loadOverlay.classList.remove('hidden');
              loadOverlay.style.display = 'flex';
            }
          });
        }
      }

      // Bind Load Game Dialog Buttons
      const loadCancelBtn = document.getElementById('load-game-cancel-btn');
      const loadSubmitBtn = document.getElementById('load-game-submit-btn');
      const loadInput = document.getElementById('load-game-input');
      const loadOverlay = document.getElementById('load-game-overlay');

      if (loadCancelBtn) {
        loadCancelBtn.addEventListener('click', () => {
          if (loadOverlay) loadOverlay.style.display = 'none';
          if (modeOverlay) modeOverlay.style.display = 'flex';
        });
      }

      if (loadSubmitBtn && loadInput) {
        loadSubmitBtn.addEventListener('click', () => {
          const saveCode = loadInput.value.trim();
          if (!saveCode) {
            this.showNotification("Please paste a valid save code!", "error");
            return;
          }
          try {
            let decoded = saveCode;
            if (!saveCode.startsWith('{')) {
              decoded = decodeURIComponent(escape(atob(saveCode)));
            }
            const state = JSON.parse(decoded);
            if (!state.grid || !state.economy) {
              throw new Error("Invalid save state format");
            }

            if (loadOverlay) loadOverlay.style.display = 'none';
            
            this.tempLoadState = state; // cache it!
            const choiceOverlay = document.getElementById('load-choice-overlay');
            if (choiceOverlay) {
              choiceOverlay.classList.remove('hidden');
              choiceOverlay.style.display = 'flex';
            }
          } catch (e) {
            console.error("[SaveLoad] Failed to load save code:", e);
            this.showNotification("Failed to parse save code! Make sure it is copied correctly.", "error");
          }
        });
      }

      // Bind Save Game HUD Button
      const saveBtn = document.getElementById('btn-save-game');
      const saveOverlay = document.getElementById('save-game-overlay');
      const saveOutput = document.getElementById('save-game-output');
      const saveCloseBtn = document.getElementById('save-game-close-btn');
      const saveCopyBtn = document.getElementById('save-game-copy-btn');

      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          const stateData = (this.sim) ? this.sim.getFullState() : this.state;
          try {
            // Compute total refund value of all placed objects and upgrades
            let totalChips = stateData.economy.chips;
            const Catalog = window.Casino.GameObjects.Catalog;
            if (stateData.grid && stateData.grid.objects) {
              stateData.grid.objects.forEach(obj => {
                const template = Catalog[obj.type];
                if (template) {
                  totalChips += template.cost;
                  if (obj.upgradesCount) {
                    const capCost = Math.max(150, Math.floor(template.cost * 0.4));
                    const incCost = Math.max(100, Math.floor(template.cost * 0.3));
                    for (let i = 0; i < (obj.upgradesCount.capacity || 0); i++) {
                      totalChips += capCost + i * 100;
                    }
                    for (let i = 0; i < (obj.upgradesCount.income || 0); i++) {
                      totalChips += incCost + i * 100;
                    }
                  }
                }
              });
            }

            const progressionSave = {
              chips: totalChips,
              researchPoints: stateData.researchPoints || 0,
              unlockedTechs: stateData.unlockedTechs || [],
              currentDay: stateData.currentDay || 1,
              starRating: stateData.starRating || 1.0,
              sizeLevel: stateData.sizeLevel || 1,
              happiness: stateData.happiness || 1.0
            };

            const jsonStr = JSON.stringify(progressionSave);
            const saveCode = btoa(unescape(encodeURIComponent(jsonStr)));
            if (saveOutput) saveOutput.value = saveCode;
            if (saveOverlay) {
              saveOverlay.classList.remove('hidden');
              saveOverlay.style.display = 'flex';
            }
          } catch (e) {
            console.error("[SaveLoad] Failed to generate save code:", e);
            this.showNotification("Failed to generate save code!", "error");
          }
        });
      }

      if (saveCloseBtn) {
        saveCloseBtn.addEventListener('click', () => {
          if (saveOverlay) saveOverlay.style.display = 'none';
        });
      }

      if (saveCopyBtn && saveOutput) {
        saveCopyBtn.addEventListener('click', () => {
          saveOutput.select();
          saveOutput.setSelectionRange(0, 99999);
          navigator.clipboard.writeText(saveOutput.value);
          this.showNotification("Save code copied to clipboard!", "success");
        });
      }

      // Bind Load Choice Buttons
      const loadChoiceOverlay = document.getElementById('load-choice-overlay');
      const loadChoiceSoloBtn = document.getElementById('load-choice-solo-btn');
      const loadChoiceHostBtn = document.getElementById('load-choice-host-btn');
      const loadChoiceCancelBtn = document.getElementById('load-choice-cancel-btn');

      if (loadChoiceSoloBtn) {
        loadChoiceSoloBtn.addEventListener('click', () => {
          if (loadChoiceOverlay) loadChoiceOverlay.style.display = 'none';
          const state = this.tempLoadState;
          if (!state) return;

          // Boot local simulator
          const sim = new window.Casino.GameSim();
          sim.loadState(state);
          this.connectToSimulator(sim);
          sim.start();

          // Resync client state
          this.state.grid = state.grid;
          this.state.economy = state.economy;
          this.state.players = state.players;
          this.state.guests = state.guests;
          this.state.employees = state.employees;
          this.state.sizeLevel = state.sizeLevel || 1;
          this.state.happiness = state.happiness || 1.0;
          this.state.maxGuests = state.maxGuests || 10;
          this.state.unlockedTechs = state.unlockedTechs || [];
          this.chips = state.economy.chips;
          this.updateHUD();

          this.tempLoadState = null;
          this.showNotification("Loaded offline successfully!", "success");
        });
      }

      if (loadChoiceHostBtn) {
        loadChoiceHostBtn.addEventListener('click', () => {
          if (loadChoiceOverlay) loadChoiceOverlay.style.display = 'none';
          const state = this.tempLoadState;
          if (!state) return;

          // Save state to host cache
          this.loadedStateCache = state;
          this.isMultiplayerHost = true;
          this.setupMultiplayerHost();

          this.tempLoadState = null;
          this.showNotification("Hosting multiplayer lobby with loaded save...", "info");
        });
      }

      if (loadChoiceCancelBtn) {
        loadChoiceCancelBtn.addEventListener('click', () => {
          if (loadChoiceOverlay) loadChoiceOverlay.style.display = 'none';
          this.tempLoadState = null;
          if (modeOverlay) modeOverlay.style.display = 'flex';
        });
      }

      // Bind Tutorial Buttons
      const tutorialBtn = document.getElementById('btn-tutorial');
      const tutorialOverlay = document.getElementById('tutorial-overlay');
      const tutorialCloseBtn = document.getElementById('tutorial-close-btn');

      if (tutorialBtn && tutorialOverlay) {
        tutorialBtn.addEventListener('click', () => {
          tutorialOverlay.classList.remove('hidden');
          tutorialOverlay.style.display = 'flex';
        });
      }

      if (tutorialCloseBtn && tutorialOverlay) {
        tutorialCloseBtn.addEventListener('click', () => {
          tutorialOverlay.style.display = 'none';
        });
      }

      const unstuckBtn = document.getElementById('btn-unstuck');
      if (unstuckBtn) {
        unstuckBtn.addEventListener('click', () => {
          this.isInQTE = false;
          this.isInMinigame = false;
          
          const qteContainer = document.getElementById('qte-container');
          if (qteContainer) qteContainer.classList.add('hidden');
          
          if (this.minigameUI) this.minigameUI.close();
          
          this.sendAction(window.Casino.Protocol.Commands.UNSTUCK_PLAYER, {});
          this.showNotification("🆘 Teleported back to casino entrance", "info");
        });
      }

      const dayReportOverlay = document.getElementById('day-report-overlay');
      const dayReportNextBtn = document.getElementById('day-report-next-btn');
      if (dayReportNextBtn && dayReportOverlay) {
        dayReportNextBtn.addEventListener('click', () => {
          dayReportOverlay.style.display = 'none';
        });
      }

      // Bind Join Room Dialog Buttons
      const joinCancelBtn = document.getElementById('join-room-cancel-btn');
      const joinSubmitBtn = document.getElementById('join-room-submit-btn');
      const joinInput = document.getElementById('join-room-input');

      if (joinCancelBtn) {
        joinCancelBtn.addEventListener('click', () => {
          if (joinOverlay) joinOverlay.style.display = 'none';
          if (modeOverlay) modeOverlay.style.display = 'flex';
        });
      }

      if (joinSubmitBtn && joinInput) {
        joinSubmitBtn.addEventListener('click', () => {
          const roomId = joinInput.value.trim();
          if (!roomId) {
            this.showNotification("Please enter a valid Room ID!", "error");
            return;
          }
          if (joinOverlay) joinOverlay.style.display = 'none';
          this.setupMultiplayerGuest(roomId);
        });
      }

      // Bind Difficulty Buttons
      const easyBtn = document.getElementById('difficulty-easy-btn');
      const medBtn = document.getElementById('difficulty-medium-btn');
      const hardBtn = document.getElementById('difficulty-hard-btn');
      const gamblerBtn = document.getElementById('difficulty-gambler-btn');

      if (diffOverlay) {
        const selectDifficulty = (diff) => {
          this.sendAction(window.Casino.Protocol.Commands.SELECT_DIFFICULTY, { difficulty: diff });
          diffOverlay.style.display = 'none';
          if (diff === 'gambler') {
            const centerHud = document.querySelector('.hud-center');
            if (centerHud) centerHud.style.display = 'none';
          }
        };

        if (easyBtn) easyBtn.addEventListener('click', () => selectDifficulty('easy'));
        if (medBtn) medBtn.addEventListener('click', () => selectDifficulty('medium'));
        if (hardBtn) hardBtn.addEventListener('click', () => selectDifficulty('hard'));
        if (gamblerBtn) gamblerBtn.addEventListener('click', () => selectDifficulty('gambler'));
      }

      // Bind InputHandler callbacks
      this.inputHandler.onInteractPressed = () => this.handleInteractKeyPress();
      this.inputHandler.onCellClicked = (gx, gy) => this.handleCellClick(gx, gy);

      // Dev backdoors (add chips easily for testing!)
      window.addChips = (amount) => {
        this.sendAction(window.Casino.Protocol.Commands.DEV_GIVE_CHIPS, { amount });
      };

      // Start client drawing loop
      let lastTime = performance.now();
      const loop = (time) => {
        const dt = time - lastTime;
        lastTime = time;

        this.update(dt);
        this.draw();

        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    resizeCanvas() {
      const parent = this.canvas.parentElement;
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
      
      // Scale cell size to fit the viewport comfortably
      const gridWidthPx = this.state.grid.cols * 32;
      const gridHeightPx = this.state.grid.rows * 32;
      
      const widthRatio = this.canvas.width / gridWidthPx;
      const heightRatio = this.canvas.height / gridHeightPx;
      const scale = Math.min(1.2, Math.min(widthRatio, heightRatio) * 0.9);
      
      const finalCellSize = Math.floor(32 * scale);
      this.cellSize = finalCellSize;
      
      const gridWidth = this.state.grid.cols * finalCellSize;
      const gridHeight = this.state.grid.rows * finalCellSize;
      
      // Offset layout to clear the HUD and center horizontally
      this.offsetX = Math.floor((this.canvas.width - gridWidth) / 2);
      
      const hudPadding = 110; // Pixels reserved at top for the absolute HUD
      const availableHeight = this.canvas.height - hudPadding;
      this.offsetY = Math.floor(hudPadding + (availableHeight - gridHeight) / 2);
      if (this.offsetY < hudPadding - 20) {
        this.offsetY = Math.max(10, Math.floor((this.canvas.height - gridHeight) / 2));
      }

      // Propagate grid scale parameters to sub-engines
      this.renderer.cellSize = finalCellSize;
      this.renderer.offsetX = this.offsetX;
      this.renderer.offsetY = this.offsetY;

      this.inputHandler.cellSize = finalCellSize;
      this.inputHandler.offsetX = this.offsetX;
      this.inputHandler.offsetY = this.offsetY;
    }

    setupHUDBindings() {
      const btnSelect = document.getElementById('btn-select');
      const buildItems = [
        'slots', 'roulette', 'craps', 'bar', 'restaurant', 'bathroom',
        'soda_machine', 'vending_machine', 'bathroom_stall', 'jazz_band',
        'blackjack', 'ride_the_bus', 'three_card_poker', 'elec_roulette',
        'elec_blackjack', 'bubble_craps', 'atm', 'minigame_machine',
        'baccarat', 'texas_holdem', 'pai_gow', 'sic_bo', 'caribbean_stud',
        'big_six', 'let_it_ride', 'red_dog', 'spanish_21', 'casino_war',
        'video_poker', 'elec_sic_bo', 'elec_baccarat', 'plinko', 'lottery',
        'palm_tree', 'fountain', 'glow_sofa', 'arcade_console', 'candy_dispenser',
        'coffee_maker', 'popcorn_cart', 'pizza_oven', 'ice_cream', 'bubble_tea',
        'gold_statue', 'vr_pod', 'vip_lounge', 'hologram', 'massage_chair'
      ];
      this.buildItems = buildItems;

      const clearActive = () => {
        btnSelect.classList.remove('active');
        buildItems.forEach(item => {
          const btn = document.getElementById(`btn-build-${item.replace(/_/g, '-')}`);
          if (btn) btn.classList.remove('active');
        });
      };

      btnSelect.addEventListener('click', () => {
        clearActive();
        btnSelect.classList.add('active');
        this.buildModeItem = null;
      });

      buildItems.forEach(item => {
        const btn = document.getElementById(`btn-build-${item.replace(/_/g, '-')}`);
        if (btn) {
          btn.addEventListener('click', () => {
            const isUnlocked = this.state.unlockedTechs.includes(item);
            if (isUnlocked) {
              clearActive();
              btn.classList.add('active');
              this.buildModeItem = item;
            } else {
              const Catalog = window.Casino.GameObjects.Catalog;
              const template = Catalog[item];
              if (!template) return;
              
              const researchCost = template.researchCost || 0;
              const requiredRating = template.requiredRating || 1.0;
              
              const currentRating = this.state.starRating || 4.2;
              if (currentRating < requiredRating) {
                this.showNotification(`Requires a Casino Rating of at least ${requiredRating}★! Keep guests happy to increase rating.`, "error");
                return;
              }

              const dynamicCost = this.getDynamicBuildCost(item);
              this.showConfirm(
                `🔬 Research ${template.name}`,
                `Unlock ${template.name} for ${researchCost} Research Points? (Requires ${requiredRating}★, build cost: ${dynamicCost.toLocaleString()} chips)`,
                () => {
                  const currentRP = this.state.researchPoints || 0;
                  if (currentRP < researchCost) {
                    this.showNotification("Not enough Research Points! Keep guests happy to earn research points when they leave.", "error");
                    return;
                  }
                  this.sendAction(window.Casino.Protocol.Commands.UNLOCK_TECH, { techType: item });
                }
              );
            }
          });
        }
      });

      const btnDetailMode = document.getElementById('btn-detail-mode');
      if (btnDetailMode) {
        btnDetailMode.addEventListener('click', () => {
          this.detailedMode = !this.detailedMode;
          if (this.detailedMode) {
            btnDetailMode.classList.add('active');
            btnDetailMode.innerText = "📊 Detail: On";
          } else {
            btnDetailMode.classList.remove('active');
            btnDetailMode.innerText = "📊 Detail: Off";
          }
        });
      }

      const btnCloseChar = document.getElementById('btn-close-char-modal');
      const modalChar = document.getElementById('character-details-modal');
      if (btnCloseChar && modalChar) {
        btnCloseChar.addEventListener('click', () => {
          modalChar.classList.add('hidden');
        });
      }

      const btnHireDealer = document.getElementById('btn-hire-dealer');
      if (btnHireDealer) {
        btnHireDealer.addEventListener('click', () => {
          const dynamicCost = this.getDynamicStaffHiringCost('dealer');
          if (this.chips < dynamicCost) {
            this.showNotification("Cannot afford to hire Dealer!", "error");
            return;
          }
          this.sendAction(window.Casino.Protocol.Commands.HIRE_EMPLOYEE, { role: 'dealer' });
        });
      }

      const btnHireWaitress = document.getElementById('btn-hire-waitress');
      if (btnHireWaitress) {
        btnHireWaitress.addEventListener('click', () => {
          const dynamicCost = this.getDynamicStaffHiringCost('waitress');
          if (this.chips < dynamicCost) {
            this.showNotification("Cannot afford to hire Waitress!", "error");
            return;
          }
          this.sendAction(window.Casino.Protocol.Commands.HIRE_EMPLOYEE, { role: 'waitress' });
        });
      }

      const setupStaffHiringBtn = (btnId, role, name, requiredRating, researchCost) => {
        const btn = document.getElementById(btnId);
        if (btn) {
          btn.addEventListener('click', () => {
            const isUnlocked = this.state.unlockedTechs && this.state.unlockedTechs.includes(role);
            const dynamicCost = this.getDynamicStaffHiringCost(role);
            if (isUnlocked) {
              if (this.chips < dynamicCost) {
                this.showNotification(`Cannot afford to hire ${name}!`, "error");
                return;
              }
              this.sendAction(window.Casino.Protocol.Commands.HIRE_EMPLOYEE, { role });
            } else {
              const currentRating = this.state.starRating || 4.2;
              if (currentRating < requiredRating) {
                this.showNotification(`Requires a Casino Rating of at least ${requiredRating}★! Keep guests happy to increase rating.`, "error");
                return;
              }
              this.showConfirm(
                `🔬 Research ${name}`,
                `Unlock the ability to hire a ${name} for ${researchCost} Research Points? (Requires ${requiredRating}★, hiring cost: ${dynamicCost.toLocaleString()} Chips)`,
                () => {
                  const currentRP = this.state.researchPoints || 0;
                  if (currentRP < researchCost) {
                    this.showNotification("Not enough Research Points! Keep guests happy to earn research points when they leave.", "error");
                    return;
                  }
                  this.sendAction(window.Casino.Protocol.Commands.UNLOCK_TECH, { techType: role });
                }
              );
            }
          });
        }
      };

      setupStaffHiringBtn('btn-hire-chef', 'chef', 'Food Chef', 2.0, 80);
      setupStaffHiringBtn('btn-hire-scientist', 'scientist', 'Research Scientist', 3.0, 120);
      setupStaffHiringBtn('btn-hire-manager', 'manager', 'Casino Manager', 3.5, 150);
      setupStaffHiringBtn('btn-hire-security', 'security', 'Security Guard', 2.0, 80);
      setupStaffHiringBtn('btn-hire-tech_support', 'tech_support', 'Tech Support Specialist', 2.5, 100);
      setupStaffHiringBtn('btn-hire-entertainer', 'entertainer', 'Stage Entertainer', 3.0, 120);
      setupStaffHiringBtn('btn-hire-stocker', 'stocker', 'Amenity Stocker', 1.5, 60);
      setupStaffHiringBtn('btn-hire-janitor', 'janitor', 'Janitor Cleaner', 1.0, 40);

      const btnUpgrade = document.getElementById('btn-upgrade-size');
      if (btnUpgrade) {
        btnUpgrade.addEventListener('click', () => {
          if (this.state.sizeLevel >= 3) {
            this.showNotification("Casino is already at maximum size!", "info");
            return;
          }
          const upgradeCosts = (this.sim && this.sim.upgradeCosts) || { 1: 1500, 2: 3000, 3: 6000 };
          const cost = upgradeCosts[this.state.sizeLevel] || 1500;
          this.showConfirm("Expand Casino?", `Do you want to expand the casino space for ${cost.toLocaleString()} chips?`, () => {
            this.sendAction(window.Casino.Protocol.Commands.UPGRADE_SIZE);
          });
        });
      }

      // Dropdown click pinning & outside click closing
      const dropdowns = document.querySelectorAll('.dropdown');
      dropdowns.forEach(dd => {
        const toggle = dd.querySelector('.dropdown-toggle');
        if (toggle) {
          toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdowns.forEach(other => {
              if (other !== dd) other.classList.remove('active');
            });
            dd.classList.toggle('active');
          });
        }
      });

      document.addEventListener('click', () => {
        dropdowns.forEach(dd => dd.classList.remove('active'));
      });

      const btnToggleMusic = document.getElementById('btn-toggle-music');
      if (btnToggleMusic) {
        btnToggleMusic.addEventListener('click', () => {
          window.Casino.SoundManager.toggleMusic();
        });
      }

      const volumeSlider = document.getElementById('volume-slider');
      if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
          window.Casino.SoundManager.setVolume(e.target.value);
        });
      }

      const btnToggleScorecard = document.getElementById('btn-toggle-scorecard');
      const scorecardPanel = document.getElementById('scorecard-panel');
      const scorecardCollapsedBtn = document.getElementById('scorecard-collapsed-btn');
      
      if (btnToggleScorecard && scorecardPanel && scorecardCollapsedBtn) {
        btnToggleScorecard.addEventListener('click', () => {
          scorecardPanel.classList.add('hidden');
          scorecardCollapsedBtn.classList.remove('hidden');
        });
        scorecardCollapsedBtn.addEventListener('click', () => {
          scorecardCollapsedBtn.classList.add('hidden');
          scorecardPanel.classList.remove('hidden');
        });
      }

      // Procedural click sounds on any interactive buttons
      document.querySelectorAll('.build-btn, .dropdown-item, .action-btn, .close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          window.Casino.SoundManager.playClick();
        });
      });
    }

    sendAction(command, payload) {
      console.log(`[Client:Action] Sending Action: "${command}"`, payload);
      if (this.minigameUI) {
        this.minigameUI.logDebug(`Client outbound action: "${command}"`, 'info');
      }
      if (this.isMultiplayerGuest) {
        if (this.peerConn && this.peerConn.open) {
          this.peerConn.send(JSON.stringify({ command, payload }));
        }
      } else {
        if (this.sim) {
          // Send command message over "simulated network socket"
          this.sim.receiveCommand(this.playerId, command, payload);
        }
      }
    }

    handleServerEvent(event, payload) {
      if (event !== window.Casino.Protocol.Events.STATE_UPDATE && event !== window.Casino.Protocol.Events.PLAYER_MOVED) {
        console.log(`[Client:Event] Received Server Event: "${event}"`, payload);
        if (this.minigameUI) {
          this.minigameUI.logDebug(`Client inbound event: "${event}"`, 'success');
        }
      }
      const Protocol = window.Casino.Protocol;

      switch (event) {
        case Protocol.Events.PLAYER_MOVED:
          if (this.state.players[payload.id]) {
            this.state.players[payload.id].gridX = payload.gridX;
            this.state.players[payload.id].gridY = payload.gridY;
            this.state.players[payload.id].interactingObjectId = payload.interactingObjectId;
          } else {
            this.state.players[payload.id] = payload;
          }
          if (this.minigameUI && this.isInMinigame) {
            this.minigameUI.updateOtherPlayers(this.state);
          }
          break;

        case Protocol.Events.OBJECT_PLACED:
          // Insert the object
          this.state.grid.objects.push(payload.object);
          // Sync cash
          this.chips = payload.chips;
          this.state.economy.chips = payload.chips;
          this.updateHUD();
          break;

        case Protocol.Events.STATE_UPDATE:
          this.state.economy = payload.economy;
          this.chips = payload.economy.chips;
          this.state.guests = payload.guests;
          if (payload.employees) {
            this.state.employees = payload.employees;
          }
          this.state.sizeLevel = payload.sizeLevel;
          this.state.happiness = payload.happiness;
          this.state.maxGuests = payload.maxGuests;
          this.state.researchPoints = payload.researchPoints !== undefined ? payload.researchPoints : this.state.researchPoints;
          this.state.starRating = payload.starRating !== undefined ? payload.starRating : this.state.starRating;
          this.state.currentDay = payload.currentDay;
          this.state.dayTimer = payload.dayTimer;

          // Sync grid objects list (specifically guests count and dealer seats)
          if (payload.objects) {
            payload.objects.forEach(updatedObj => {
              const matched = this.state.grid.objects.find(o => o.id === updatedObj.id);
              if (matched) {
                matched.guests = updatedObj.guests;
                matched.eps = updatedObj.eps; // Sync EPS!
                if (updatedObj.dealerSeat !== undefined) {
                  matched.dealerSeat = updatedObj.dealerSeat;
                }
                if (updatedObj.stock !== undefined) matched.stock = updatedObj.stock;
                if (updatedObj.maxStock !== undefined) matched.maxStock = updatedObj.maxStock;
                if (updatedObj.isOutOfStock !== undefined) matched.isOutOfStock = updatedObj.isOutOfStock;
                if (updatedObj.isBroken !== undefined) matched.isBroken = updatedObj.isBroken;
                if (updatedObj.needsRepairSoon !== undefined) matched.needsRepairSoon = updatedObj.needsRepairSoon;
                if (updatedObj.isDealerBoosted !== undefined) matched.isDealerBoosted = updatedObj.isDealerBoosted;
              }
            });
          }

          if (payload.players) {
            this.state.players = payload.players;
          }
          if (this.minigameUI && this.isInMinigame) {
            this.minigameUI.updateOtherPlayers(this.state);
          }

          this.updateHUD();
          break;

        case Protocol.Events.MINIGAME_PAYOUT:
          if (payload.playerId === this.playerId) {
            const hasDelay = ['slots', 'plinko', 'big_six', 'lottery'].includes(payload.gameType);
            if (!hasDelay) {
              if (payload.researchPoints !== undefined) this.state.researchPoints = payload.researchPoints;
              if (payload.starRating !== undefined) this.state.starRating = payload.starRating;
              if (payload.chips !== undefined) {
                this.chips = payload.chips;
                if (this.state.economy) this.state.economy.chips = payload.chips;
              }
              this.updateHUD();
            }
          }

          // Forward payout calculation values directly to the active Minigame UI if matching the player's active table
          if (this.minigameUI && this.isInMinigame) {
            const active = this.minigameUI.activeGameType;
            const isSameTable = this.minigameUI.activeTableId === payload.tableId;
            if (active === payload.gameType && isSameTable) {
              if (payload.gameType === 'roulette' || payload.gameType === 'elec_roulette') {
                this.minigameUI.handleRoulettePayout(payload);
              } else if (payload.gameType === 'craps' || payload.gameType === 'bubble_craps') {
                this.minigameUI.handleCrapsPayout(payload);
              } else if (payload.gameType === 'slots') {
                this.minigameUI.handleSlotsPayout(payload);
              } else if (payload.gameType === 'blackjack' || payload.gameType === 'elec_blackjack') {
                this.minigameUI.handleBlackjackPayout(payload);
              } else if (payload.gameType === 'ride_the_bus') {
                this.minigameUI.handleRideTheBusPayout(payload);
              } else if (payload.gameType === 'three_card_poker') {
                this.minigameUI.handleThreeCardPokerPayout(payload);
              } else if (payload.gameType === 'baccarat' || payload.gameType === 'elec_baccarat') {
                this.minigameUI.handleBaccaratPayout(payload);
              } else if (payload.gameType === 'texas_holdem') {
                this.minigameUI.handleTexasHoldemPayout(payload);
              } else if (payload.gameType === 'pai_gow') {
                this.minigameUI.handlePaiGowPayout(payload);
              } else if (payload.gameType === 'sic_bo' || payload.gameType === 'elec_sic_bo') {
                this.minigameUI.handleSicBoPayout(payload);
              } else if (payload.gameType === 'caribbean_stud') {
                this.minigameUI.handleCaribbeanStudPayout(payload);
              } else if (payload.gameType === 'big_six') {
                this.minigameUI.handleBigSixPayout(payload);
              } else if (payload.gameType === 'let_it_ride') {
                this.minigameUI.handleLetItRidePayout(payload);
              } else if (payload.gameType === 'red_dog') {
                this.minigameUI.handleRedDogPayout(payload);
              } else if (payload.gameType === 'spanish_21') {
                this.minigameUI.handleSpanish21Payout(payload);
              } else if (payload.gameType === 'casino_war') {
                this.minigameUI.handleCasinoWarPayout(payload);
              } else if (payload.gameType === 'video_poker') {
                this.minigameUI.handleVideoPokerPayout(payload);
              } else if (payload.gameType === 'plinko') {
                this.minigameUI.handlePlinkoPayout(payload);
              } else if (payload.gameType === 'lottery') {
                this.minigameUI.handleLotteryPayout(payload);
              } else if (payload.gameType === 'minigame_machine') {
                this.minigameUI.handleMinigameMachinePayout(payload);
              }
            }
          }

          if (payload.playerId === this.playerId) {
            this.chips = payload.chips;
            this.state.economy.chips = payload.chips;
            this.updateHUD();
          }
          break;

        case Protocol.Events.SIZE_UPGRADED:
          this.showNotification(`Casino expanded to Level ${payload.sizeLevel}!`, "success");
          this.state.sizeLevel = payload.sizeLevel;
          this.chips = payload.chips;
          this.state.economy.chips = payload.chips;
          this.updateHUD();
          break;

        case Protocol.Events.GUEST_LEFT_REASON:
          this.handleGuestLeftReason(payload);
          break;

        case Protocol.Events.SOUND_TRIGGER:
          if (payload.type === 'win') {
            window.Casino.SoundManager.playWin();
          } else if (payload.type === 'lose') {
            window.Casino.SoundManager.playLose();
          } else if (payload.type === 'beep') {
            window.Casino.SoundManager.playBeep();
          }
          break;

        case Protocol.Events.DAY_REPORT:
          this.showDayReportDialog(payload);
          break;

        case Protocol.Events.FULL_STATE:
          // Synchronize full expanded state
          this.state.grid = payload.grid;
          this.state.economy = payload.economy;
          this.state.players = payload.players;
          this.state.guests = payload.guests;
          if (payload.employees) {
            this.state.employees = payload.employees;
          }
          this.state.sizeLevel = payload.sizeLevel;
          this.state.happiness = payload.happiness;
          this.state.maxGuests = payload.maxGuests;
          this.state.unlockedTechs = payload.unlockedTechs || [];
          this.state.researchPoints = payload.researchPoints !== undefined ? payload.researchPoints : this.state.researchPoints;
          this.state.starRating = payload.starRating !== undefined ? payload.starRating : this.state.starRating;
          this.state.currentDay = payload.currentDay;
          this.state.dayTimer = payload.dayTimer;
          this.state.crapsState = payload.crapsState || {};
          this.chips = this.state.economy.chips;
          
          if (payload.isGamblerMode) {
            const centerHud = document.querySelector('.hud-center');
            if (centerHud) centerHud.style.display = 'none';
          }
          
          if (this.minigameUI && this.isInMinigame) {
            this.minigameUI.updateOtherPlayers(this.state);
          }

          // Refresh canvas centering ratios
          this.resizeCanvas();
          this.updateHUD();
          break;
      }
    }

    handleGuestLeftReason(payload) {
      const { name, reason } = payload;
      let text = '';
      if (reason === 'broke') {
        text = `${name} went home happy (broke).`;
      } else if (reason === 'satisfied') {
        text = `${name} went home satisfied after a great stay!`;
      } else if (reason === 'thirsty') {
        text = `${name} left dehydrated (needs drinks!).`;
      } else if (reason === 'hungry') {
        text = `${name} left starving (needs food!).`;
      } else if (reason === 'bladder') {
        text = `${name} left due to urgent bladder (needs toilets!).`;
      } else if (reason === 'bored') {
        text = `${name} left due to boredom (needs fun!).`;
      } else if (reason === 'broken_machine') {
        text = `🔧 ${name} broke down! Needs Tech Support or Player repair.`;
      } else if (reason === 'pickpocketed') {
        text = `⚠️ ${name} had 10 Chips stolen by a Pickpocket!`;
      } else if (reason === 'pickpocket_spawned') {
        text = `⚠️ A suspicious pickpocket has entered the casino!`;
      } else if (reason === 'pickpocket_captured_by_staff') {
        text = `👮 Security Guard caught a pickpocket!`;
      } else if (reason === 'machine_repaired') {
        text = `🔧 Tech Support repaired a broken machine!`;
      } else {
        text = `${name} left the casino.`;
      }

      const list = document.getElementById('complaints-list');
      if (list) {
        const item = document.createElement('div');
        item.style.color = (reason === 'broke' || reason === 'satisfied') ? '#00ff66' : '#ff4d4d';
        item.style.animation = 'fadeIn 0.3s ease';
        item.innerText = `• ${text}`;
        list.appendChild(item);

        // Limit to 5 lines
        while (list.children.length > 5) {
          list.removeChild(list.firstChild);
        }

        // Scroll to bottom
        const container = document.getElementById('complaints-log');
        if (container) container.scrollTop = container.scrollHeight;
      }
    }

    showDayReportDialog(payload) {
      const day = payload.day;
      const revenue = payload.revenue || 0;
      const expenses = payload.expenses || 0;
      const netProfit = revenue - expenses;

      const overlay = document.getElementById('day-report-overlay');
      const dayNumEl = document.getElementById('report-day-num');
      const revEl = document.getElementById('report-revenue');
      const expEl = document.getElementById('report-expenses');
      const netEl = document.getElementById('report-net-profit');
      const listEl = document.getElementById('report-breakdown-list');

      if (dayNumEl) dayNumEl.innerText = day;
      if (revEl) revEl.innerText = `+${revenue.toLocaleString()} Chips`;
      if (expEl) expEl.innerText = `-${expenses.toLocaleString()} Chips`;

      const playerLossesEl = document.getElementById('report-player-losses');
      const playerLosses = payload.playerGamblingLosses || 0;
      if (playerLossesEl) {
        playerLossesEl.innerText = `${playerLosses.toLocaleString()} Chips`;
      }
      
      if (netEl) {
        netEl.innerText = (netProfit >= 0 ? '+' : '') + netProfit.toLocaleString() + ' Chips';
        netEl.style.color = netProfit > 0 ? 'var(--accent-green)' : (netProfit < 0 ? 'var(--accent-pink)' : '#fff');
      }

      if (listEl) {
        if (payload.stats && Object.keys(payload.stats).length > 0) {
          listEl.innerHTML = Object.entries(payload.stats).map(([source, stats]) => {
            const netItem = (stats.earned || 0) - (stats.lost || 0);
            const color = netItem > 0 ? 'var(--accent-green)' : (netItem < 0 ? 'var(--accent-pink)' : '#aaa');
            const sign = netItem > 0 ? '+' : '';
            const cleanName = source.replace(/_/g, ' ').toUpperCase();
            return `
              <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
                <span>${cleanName}:</span>
                <span style="color:${color}; font-weight:700;">${sign}${netItem.toLocaleString()}</span>
              </div>
            `;
          }).join('');
        } else {
          listEl.innerHTML = `<div style="text-align:center; padding: 10px 0;">No transactions recorded today.</div>`;
        }
      }

      // Auto-save the game to localStorage (progression-only)!
      try {
        const stateData = (this.sim) ? this.sim.getFullState() : this.state;
        let totalChips = stateData.economy.chips;
        const Catalog = window.Casino.GameObjects.Catalog;
        if (stateData.grid && stateData.grid.objects) {
          stateData.grid.objects.forEach(obj => {
            const template = Catalog[obj.type];
            if (template) {
              totalChips += template.cost;
              if (obj.upgradesCount) {
                const capCost = Math.max(150, Math.floor(template.cost * 0.4));
                const incCost = Math.max(100, Math.floor(template.cost * 0.3));
                for (let i = 0; i < (obj.upgradesCount.capacity || 0); i++) {
                  totalChips += capCost + i * 100;
                }
                for (let i = 0; i < (obj.upgradesCount.income || 0); i++) {
                  totalChips += incCost + i * 100;
                }
              }
            }
          });
        }

        const progressionSave = {
          chips: totalChips,
          researchPoints: stateData.researchPoints || 0,
          unlockedTechs: stateData.unlockedTechs || [],
          currentDay: stateData.currentDay || 1,
          starRating: stateData.starRating || 1.0,
          sizeLevel: stateData.sizeLevel || 1,
          happiness: stateData.happiness || 1.0
        };

        const jsonStr = JSON.stringify(progressionSave);
        const saveCode = btoa(unescape(encodeURIComponent(jsonStr)));
        if (!window.isMobile) {
          localStorage.setItem('casino_planet_autosave', saveCode);
          console.log("[Autosave] Game auto-saved successfully at end of day!");
        } else {
          console.log("[Autosave] Autosave skipped on mobile.");
        }
      } catch (e) {
        console.error("[Autosave] Failed to auto-save game:", e);
      }

      if (overlay) {
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
      }
    }

    updateHUD() {
      this.updateBuffsUI();
      document.getElementById('chip-balance').innerText = this.chips.toLocaleString();
      
      const researchEl = document.getElementById('research-balance');
      if (researchEl) {
        researchEl.innerText = (this.state.researchPoints || 0).toLocaleString();
      }
      
      const ratingEl = document.getElementById('rating-value');
      if (ratingEl) {
        ratingEl.innerText = (this.state.starRating || 4.2).toFixed(1);
      }

      // Gross CPS tracking
      const now = Date.now();
      if (this.lastChipsValue === undefined) {
        this.lastChipsValue = this.chips;
        this.earningsHistory = [];
      }
      if (this.chips > this.lastChipsValue) {
        const diff = this.chips - this.lastChipsValue;
        this.earningsHistory.push({ time: now, amount: diff });
      }
      this.lastChipsValue = this.chips;

      // Filter earnings older than 10 seconds
      this.earningsHistory = this.earningsHistory.filter(e => now - e.time <= 10000);
      const totalEarned = this.earningsHistory.reduce((sum, e) => sum + e.amount, 0);
      const cps = totalEarned / 10;

      const chipRateEl = document.getElementById('chip-rate');
      if (chipRateEl) {
        chipRateEl.innerText = `+${cps.toFixed(1)}/s`;
      }

      // Update capacity occupancy ratio
      const currentGuests = Object.keys(this.state.guests).length;
      const maxGuests = this.state.maxGuests || 10;
      const ratioDisplay = `${currentGuests} / ${maxGuests}`;
      const fillPct = Math.min(100, Math.round((currentGuests / maxGuests) * 100)) + '%';

      const guestRatioEl = document.getElementById('guest-ratio');
      const happinessBarEl = document.getElementById('happiness-bar');
      if (guestRatioEl && happinessBarEl) {
        guestRatioEl.innerText = ratioDisplay;
        happinessBarEl.style.width = fillPct;
      }

      // Update staff counts
      let dealersCount = 0;
      let waitressesCount = 0;
      let chefsCount = 0;
      let scientistsCount = 0;
      let managersCount = 0;
      let securitiesCount = 0;
      let tech_supportsCount = 0;
      let entertainersCount = 0;
      let stockersCount = 0;
      let janitorsCount = 0;
      if (this.state.employees) {
        Object.values(this.state.employees).forEach(emp => {
          if (emp.role === 'dealer') dealersCount++;
          else if (emp.role === 'waitress') waitressesCount++;
          else if (emp.role === 'chef') chefsCount++;
          else if (emp.role === 'scientist') scientistsCount++;
          else if (emp.role === 'manager') managersCount++;
          else if (emp.role === 'security') securitiesCount++;
          else if (emp.role === 'tech_support') tech_supportsCount++;
          else if (emp.role === 'entertainer') entertainersCount++;
          else if (emp.role === 'stocker') stockersCount++;
          else if (emp.role === 'janitor') janitorsCount++;
        });
      }

      const dealersCountEl = document.getElementById('staff-dealers-count');
      const waitressesCountEl = document.getElementById('staff-waitresses-count');
      const chefsCountEl = document.getElementById('staff-chefs-count');
      const scientistsCountEl = document.getElementById('staff-scientists-count');
      const managersCountEl = document.getElementById('staff-managers-count');
      const securitiesCountEl = document.getElementById('staff-securities-count');
      const tech_supportsCountEl = document.getElementById('staff-tech_supports-count');
      const entertainersCountEl = document.getElementById('staff-entertainers-count');
      const stockersCountEl = document.getElementById('staff-stockers-count');
      const janitorsCountEl = document.getElementById('staff-janitors-count');
      if (dealersCountEl) dealersCountEl.innerText = dealersCount;
      if (waitressesCountEl) waitressesCountEl.innerText = waitressesCount;
      if (chefsCountEl) chefsCountEl.innerText = chefsCount;
      if (scientistsCountEl) scientistsCountEl.innerText = scientistsCount;
      if (managersCountEl) managersCountEl.innerText = managersCount;
      if (securitiesCountEl) securitiesCountEl.innerText = securitiesCount;
      if (tech_supportsCountEl) tech_supportsCountEl.innerText = tech_supportsCount;
      if (entertainersCountEl) entertainersCountEl.innerText = entertainersCount;
      if (stockersCountEl) stockersCountEl.innerText = stockersCount;
      if (janitorsCountEl) janitorsCountEl.innerText = janitorsCount;

      // Update staff hiring buttons styling (locked/unlocked)
      const unlocked = this.state.unlockedTechs || [];
      const updateStaffBtnStyle = (id, role, cost, rpCost) => {
        const btn = document.getElementById(id);
        if (btn) {
          const isUnlocked = ['dealer', 'waitress'].includes(role) || unlocked.includes(role);
          const costTag = btn.querySelector('.cost-tag') || btn.querySelector('.mobile-item-cost');
          if (isUnlocked) {
            btn.style.opacity = '1';
            if (costTag) {
              costTag.innerText = cost + (btn.classList.contains('mobile-grid-item') ? 'c' : '');
              costTag.style.background = 'rgba(255,255,255,0.1)';
              costTag.style.color = '#fff';
            }
            btn.setAttribute('title', `Hire ${role.charAt(0).toUpperCase() + role.slice(1)} (Cost: ${cost} Chips)`);
          } else {
            btn.style.opacity = '0.6';
            if (costTag) {
              costTag.innerText = (btn.classList.contains('mobile-grid-item') ? '' : '🔬 ') + rpCost;
              costTag.style.background = 'var(--accent-gold)';
              costTag.style.color = '#000';
            }
            const Catalog = window.Casino.GameObjects.Catalog;
            const requiredRating = Catalog[role] ? Catalog[role].requiredRating : 1.0;
            btn.setAttribute('title', `Unlock ${role.charAt(0).toUpperCase() + role.slice(1)} for ${rpCost} (Requires ${requiredRating}★)`);
          }
        }
      };

      const Catalog = window.Casino.GameObjects.Catalog;
      updateStaffBtnStyle('btn-hire-dealer', 'dealer', this.getDynamicStaffHiringCost('dealer').toLocaleString(), '0 RP');
      updateStaffBtnStyle('btn-hire-waitress', 'waitress', this.getDynamicStaffHiringCost('waitress').toLocaleString(), '0 RP');
      updateStaffBtnStyle('btn-hire-chef', 'chef', this.getDynamicStaffHiringCost('chef').toLocaleString(), '80 RP');
      updateStaffBtnStyle('btn-hire-scientist', 'scientist', this.getDynamicStaffHiringCost('scientist').toLocaleString(), '120 RP');
      updateStaffBtnStyle('btn-hire-manager', 'manager', this.getDynamicStaffHiringCost('manager').toLocaleString(), '150 RP');
      updateStaffBtnStyle('btn-hire-security', 'security', this.getDynamicStaffHiringCost('security').toLocaleString(), '80 RP');
      updateStaffBtnStyle('btn-hire-tech_support', 'tech_support', this.getDynamicStaffHiringCost('tech_support').toLocaleString(), '100 RP');
      updateStaffBtnStyle('btn-hire-entertainer', 'entertainer', this.getDynamicStaffHiringCost('entertainer').toLocaleString(), '120 RP');
      updateStaffBtnStyle('btn-hire-stocker', 'stocker', this.getDynamicStaffHiringCost('stocker').toLocaleString(), '60 RP');
      updateStaffBtnStyle('btn-hire-janitor', 'janitor', this.getDynamicStaffHiringCost('janitor').toLocaleString(), '40 RP');

      // Update build buttons styling (locked/unlocked and dynamic cost titles)
      if (this.buildItems) {
        this.buildItems.forEach(item => {
          const btn = document.getElementById(`btn-build-${item.replace(/_/g, '-')}`);
          if (btn) {
            const template = Catalog[item];
            if (template) {
              const isUnlocked = unlocked.includes(item) || ['slots', 'roulette', 'craps', 'bar', 'restaurant', 'bathroom', 'soda_machine', 'vending_machine', 'bathroom_stall'].includes(item);
              const dynamicCost = this.getDynamicBuildCost(item);
              if (isUnlocked) {
                btn.style.opacity = '1';
                btn.setAttribute('title', `Build ${template.name} (Cost: ${dynamicCost.toLocaleString()} Chips)`);
              } else {
                btn.style.opacity = '0.6';
                const researchCost = template.researchCost || 0;
                const requiredRating = template.requiredRating || 1.0;
                btn.setAttribute('title', `Research ${template.name} (Cost: ${researchCost} RP, Requires ${requiredRating}★, build cost: ${dynamicCost.toLocaleString()} Chips)`);
              }
            }
          }
        });
      }

      // Trigger minigame dealer badge update
      if (this.minigameUI && this.isInMinigame) {
        this.minigameUI.updateDealerStatus();
      }

      // Update upgrade button cost display
      const upgradeBtn = document.getElementById('btn-upgrade-size');
      const costText = document.getElementById('upgrade-cost-text');
      const sizeLevel = this.state.sizeLevel || 1;
      
      if (upgradeBtn && costText) {
        if (sizeLevel >= 3) {
          costText.innerText = "MAX";
          upgradeBtn.disabled = true;
          upgradeBtn.title = "Casino is at maximum size";
        } else {
          const nextCost = this.sim ? this.sim.upgradeCosts[sizeLevel] : (sizeLevel === 1 ? 1500 : 3000);
          costText.innerText = nextCost.toLocaleString();
          upgradeBtn.disabled = false;
        }
      }

      const buildItems = [
        'slots', 'roulette', 'craps', 'bar', 'restaurant', 'bathroom',
        'soda_machine', 'vending_machine', 'bathroom_stall', 'jazz_band',
        'blackjack', 'ride_the_bus', 'three_card_poker', 'elec_roulette',
        'elec_blackjack', 'bubble_craps', 'atm', 'minigame_machine',
        'baccarat', 'texas_holdem', 'pai_gow', 'sic_bo', 'caribbean_stud',
        'big_six', 'let_it_ride', 'red_dog', 'spanish_21', 'casino_war',
        'video_poker', 'elec_sic_bo', 'elec_baccarat', 'plinko', 'lottery',
        'palm_tree', 'fountain', 'glow_sofa', 'arcade_console', 'candy_dispenser',
        'coffee_maker', 'popcorn_cart', 'pizza_oven', 'ice_cream', 'bubble_tea',
        'gold_statue', 'vr_pod', 'vip_lounge', 'hologram', 'massage_chair'
      ];

      buildItems.forEach(item => {
        const btn = document.getElementById(`btn-build-${item.replace(/_/g, '-')}`);
        if (btn && btn.children.length >= 2) {
          const Catalog = window.Casino.GameObjects.Catalog;
          const template = Catalog[item];
          const cleanName = template ? template.name : (btn.dataset.cleanName || btn.children[0].innerText.replace("🔒", "").trim());
          if (!btn.dataset.cleanName) {
            btn.dataset.cleanName = cleanName;
          }

          const isUnlocked = this.state.unlockedTechs && this.state.unlockedTechs.includes(item);
          if (isUnlocked) {
            btn.children[0].innerText = cleanName;
            const buildCost = this.getDynamicBuildCost(item);
            btn.children[1].innerText = buildCost.toLocaleString();
            // Remove inline custom styling if any (e.g. style overrides on arcade cabinet tag)
            btn.children[1].style.background = '';
            btn.children[1].style.color = '';
            btn.classList.remove('locked-tech');
            btn.title = `Build ${cleanName} (Cost: ${buildCost.toLocaleString()} Chips)`;
          } else {
            btn.children[0].innerText = "🔒 " + cleanName;
            const rCost = template ? (template.researchCost || 0) : 0;
            btn.children[1].innerText = `🔬 ${rCost} RP`;
            btn.classList.add('locked-tech');
            btn.title = `Research ${cleanName} (Cost: ${rCost} RP)`;
          }
        }
      });

      // Update Day timer HUD
      const dayNumEl = document.getElementById('hud-day-num');
      const dayTimerEl = document.getElementById('hud-day-timer');
      if (dayNumEl && this.state.currentDay !== undefined) {
        dayNumEl.innerText = this.state.currentDay;
      }
      if (dayTimerEl && this.state.dayTimer !== undefined) {
        const isAfterHours = this.state.dayTimer < 0;
        const totalSeconds = Math.abs(Math.floor(this.state.dayTimer));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (isAfterHours) {
          dayTimerEl.innerText = `After Hours: +${timeStr}`;
          dayTimerEl.style.color = 'var(--accent-pink)';
        } else {
          dayTimerEl.innerText = timeStr;
          dayTimerEl.style.color = 'var(--accent-gold)';
        }
      }
      this.updateScorecardUI();
    }

    updateScorecardUI() {
      const panel = document.getElementById('scorecard-panel');
      const content = document.getElementById('scorecard-content');
      if (!panel || !content) return;

      content.innerHTML = '';

      if (!this.state.players || Object.keys(this.state.players).length === 0) {
        content.innerHTML = '<div style="font-size: 11px; color: var(--text-secondary); text-align: center; padding: 12px 0;">No active players</div>';
        return;
      }

      Object.values(this.state.players).forEach(p => {
        const stats = p.gamblingStats || { totalWon: 0, totalLost: 0, netProfit: 0 };
        const row = document.createElement('div');
        row.style.background = 'rgba(255,255,255,0.03)';
        row.style.border = '1px solid rgba(255,255,255,0.05)';
        row.style.borderRadius = '8px';
        row.style.padding = '8px';
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '4px';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        const nameSpan = document.createElement('span');
        nameSpan.innerText = p.name;
        nameSpan.style.color = p.color || 'var(--accent-blue)';
        nameSpan.style.fontWeight = 'bold';
        nameSpan.style.fontSize = '11px';

        const profitSpan = document.createElement('span');
        const profit = stats.netProfit || 0;
        if (profit >= 0) {
          profitSpan.innerText = `+${profit} c`;
          profitSpan.style.color = '#39ff14';
          profitSpan.style.textShadow = '0 0 4px rgba(57,255,20,0.3)';
        } else {
          profitSpan.innerText = `${profit} c`;
          profitSpan.style.color = '#ff007f';
          profitSpan.style.textShadow = '0 0 4px rgba(255,0,127,0.3)';
        }
        profitSpan.style.fontWeight = 'bold';
        profitSpan.style.fontSize = '11px';
        profitSpan.style.fontFamily = 'monospace';

        header.appendChild(nameSpan);
        header.appendChild(profitSpan);

        const details = document.createElement('div');
        details.style.display = 'flex';
        details.style.justifyContent = 'space-between';
        details.style.fontSize = '9px';
        details.style.color = 'var(--text-secondary)';

        const wonSpan = document.createElement('span');
        wonSpan.innerText = `Won: ${stats.totalWon || 0}`;

        const lostSpan = document.createElement('span');
        lostSpan.innerText = `Lost: ${stats.totalLost || 0}`;

        details.appendChild(wonSpan);
        details.appendChild(lostSpan);

        row.appendChild(header);
        row.appendChild(details);
        content.appendChild(row);
      });
    }

    handleInteractKeyPress() {
      if (this.isInMinigame || this.isInQTE) return;

      const player = this.state.players[this.playerId];
      if (!player) return;

      // 1. Check for nearby dirt to sweep
      if (this.state.dirtyTiles) {
        const closestDirt = this.state.dirtyTiles.find(t => {
          const dist = Math.sqrt((player.gridX - t.x)**2 + (player.gridY - t.y)**2);
          return dist <= 1.8;
        });
        if (closestDirt) {
          this.startQTEMinigame(
            "🧹 SWEEP DIRT",
            "Press SPACE or E in the GREEN zone to sweep!",
            () => {
              this.sendAction(window.Casino.Protocol.Commands.CLEAN_DIRT, { x: closestDirt.x, y: closestDirt.y });
              this.showNotification("🧹 Floor smudge cleaned up!", "success");
            }
          );
          return;
        }
      }

      // 2. Check for nearby pickpockets to tackle
      if (this.state.employees) {
        const closestPickpocket = Object.values(this.state.employees).find(emp => {
          if (emp.role !== 'pickpocket') return false;
          const dist = Math.sqrt((player.gridX - emp.gridX)**2 + (player.gridY - emp.gridY)**2);
          return dist <= 2.2;
        });
        if (closestPickpocket) {
          this.startQTEMinigame(
            "👮 APPREHEND PICKPOCKET",
            "Press SPACE or E in the GREEN zone to tackle!",
            () => {
              this.sendAction(window.Casino.Protocol.Commands.CAPTURE_PICKPOCKET, { id: closestPickpocket.id });
              this.showNotification("👮 Pickpocket captured! +100 Chips bounty!", "success");
            }
          );
          return;
        }
      }

      // Check if carrying food/drink, and look for a nearby guest who needs it
      if (player.holdingDrink || player.holdingMeal) {
        const nearbyGuests = Array.from(Object.values(this.state.guests)).filter(guest => {
          const dist = Math.sqrt((player.gridX - guest.gridX)**2 + (player.gridY - guest.gridY)**2);
          if (dist > 1.8 || guest.state === 'LEAVING') return false;
          if (player.holdingDrink && guest.thirst < 90) return true;
          if (player.holdingMeal && guest.hunger < 90) return true;
          return false;
        });

        if (nearbyGuests.length > 0) {
          const targetGuest = nearbyGuests[0];
          const isDrink = player.holdingDrink;
          this.startQTEMinigame(
            isDrink ? "🍹 SERVE DRINK" : "🍱 SERVE FOOD",
            isDrink ? "Press SPACE or E in the GREEN zone to hand the drink!" : "Press SPACE or E in the GREEN zone to hand the food!",
            () => {
              this.sendAction(window.Casino.Protocol.Commands.HAND_NEEDS, { guestId: targetGuest.id, itemType: isDrink ? 'drink' : 'meal' });
              this.showNotification(`Served ${targetGuest.name} directly! +20 Chips Tip!`, "success");
            }
          );
          return;
        }
      }

      // 3. Find nearby placed objects
      let closestObj = this.getClosestObject(player.gridX, player.gridY, 1.8);
      if (closestObj) {
        // If broken, trigger Repair mini-game
        if (closestObj.isBroken) {
          this.startQTEMinigame(
            "🔧 REPAIR MACHINE",
            "Press SPACE or E in the GREEN zone to fix the grid!",
            () => {
              this.repairFailuresCount = 0;
              this.sendAction(window.Casino.Protocol.Commands.REPAIR_MACHINE, { objectId: closestObj.id });
              this.showNotification(`🔧 Machine "${closestObj.name}" repaired!`, "success");
            },
            () => {
              this.repairFailuresCount = (this.repairFailuresCount || 0) + 1;
              if (this.repairFailuresCount >= 3) {
                this.repairFailuresCount = 0;
                this.sendAction(window.Casino.Protocol.Commands.REPAIR_MACHINE, { objectId: closestObj.id });
                this.showNotification(`🔧 Machine "${closestObj.name}" repaired! (Mercy Rule applied)`, "success");
              } else {
                this.showNotification(`QTE Failed! Missed target zone. (${3 - this.repairFailuresCount} attempts remaining before mercy rule)`, "warning");
              }
            }
          );
          return;
        }

        // Check for out-of-stock / low-stock refilling
        if (closestObj.stock !== undefined && closestObj.stock !== null && closestObj.stock < closestObj.maxStock) {
          this.startQTEMinigame(
            "📦 REFILL AMENITY",
            "Press SPACE or E in the GREEN zone to restock!",
            () => {
              this.sendAction(window.Casino.Protocol.Commands.REFILL_AMENITY, { objectId: closestObj.id });
              this.showNotification(`Restocked "${closestObj.name}"!`, "success");
            }
          );
          return;
        }

        // Check for grabbing food/drink item
        if (closestObj.stock !== undefined && closestObj.stock !== null && closestObj.stock > 0 && !player.holdingDrink && !player.holdingMeal) {
          const isDrinkStand = ['bar', 'soda_machine', 'coffee_maker', 'bubble_tea'].includes(closestObj.type);
          const isFoodStand = ['restaurant', 'vending_machine', 'candy_dispenser', 'popcorn_cart', 'pizza_oven', 'ice_cream'].includes(closestObj.type);
          if (isDrinkStand || isFoodStand) {
            this.startQTEMinigame(
              isDrinkStand ? "🍹 GRAB DRINK" : "🍱 GRAB FOOD",
              isDrinkStand ? "Press SPACE or E in the GREEN zone to grab!" : "Press SPACE or E in the GREEN zone to grab!",
              () => {
                this.sendAction(window.Casino.Protocol.Commands.GRAB_AMENITY_ITEM, { objectId: closestObj.id });
                this.showNotification(isDrinkStand ? "🍹 Carrying a drink! Find a thirsty guest." : "🍱 Carrying food! Find a hungry guest.", "success");
              }
            );
            return;
          }
        }

        // Open Amenity Buff Shop if applicable (covers stages, food/bar service, and decor)
        if (AmenityShopData[closestObj.type]) {
          this.openAmenityShop(closestObj.id);
          return;
        }

        // Card dealing boost (if standing on the dealer seat of this table game)
        const isTable = ['roulette', 'craps', 'blackjack', 'ride_the_bus', 'three_card_poker', 'baccarat', 'texas_holdem', 'pai_gow', 'sic_bo', 'caribbean_stud', 'big_six', 'let_it_ride', 'red_dog', 'spanish_21', 'casino_war'].includes(closestObj.type);
        const dealerX = closestObj.gridX + (closestObj.dealerSeat ? closestObj.dealerSeat.rx : 999);
        const dealerY = closestObj.gridY + (closestObj.dealerSeat ? closestObj.dealerSeat.ry : 999);
        const isDealerSeat = (player.gridX === dealerX && player.gridY === dealerY);

        if (isTable && isDealerSeat) {
          const isWheel = ['roulette', 'big_six'].includes(closestObj.type);
          const title = isWheel ? "🎰 WHEEL SPINNING BOOST" : "🤵 CARD DEALING BOOST";
          const instrs = isWheel ? "Perform wheel spinning! Hit the GREEN zone!" : "Perform card dealing! Hit the GREEN zone!";
          
          this.startQTEMinigame(
            title,
            instrs,
            () => {
              this.sendAction(window.Casino.Protocol.Commands.INTERACT, { objectId: closestObj.id });
              this.showNotification(`${isWheel ? '🎰 Wheel spinning' : '🤵 Dealing'} boosted! Modifiers doubled to +40% for 60 seconds!`, "success");
            },
            null,
            null // Select QTE mode randomly
          );
          return;
        }

        // Regular gambling minigames
        this.sendAction(window.Casino.Protocol.Commands.INTERACT, {
          objectId: closestObj.id
        });
        this.minigameUI.open(closestObj.type, closestObj.id);
      }
    }

    startQTEMinigame(title, instructions, successCallback, failureCallback, preferredMode) {
      if (this.isInQTE) return;
      this.isInQTE = true;
      let animId = null;

      let qteResolved = false;
      const originalSuccess = successCallback;
      const originalFailure = failureCallback;

      const safeSuccess = (...args) => {
        if (qteResolved) return;
        qteResolved = true;
        this.isInQTE = false;
        if (cleanUp) cleanUp();
        if (originalSuccess) originalSuccess(...args);
      };

      const safeFailure = (...args) => {
        if (qteResolved) return;
        qteResolved = true;
        this.isInQTE = false;
        if (cleanUp) cleanUp();
        if (originalFailure) {
          originalFailure(...args);
        } else {
          this.showNotification("QTE Failed! Missed target zone.", "error");
        }
      };

      successCallback = safeSuccess;
      failureCallback = safeFailure;

      const container = document.getElementById('qte-container');
      const titleEl = document.getElementById('qte-title');
      const instrEl = document.getElementById('qte-instructions');
      const footerTip = document.getElementById('qte-footer-tip');
      const sliderWrap = document.getElementById('qte-slider-wrap');
      const sequenceWrap = document.getElementById('qte-sequence-wrap');

      if (!container || !sliderWrap || !sequenceWrap) {
        this.isInQTE = false;
        successCallback();
        return;
      }

      titleEl.innerText = title;
      container.classList.remove('hidden');

      // Hide all wraps initially
      sliderWrap.classList.add('hidden');
      sequenceWrap.classList.add('hidden');
      const oldPuzzleWrap = document.getElementById('qte-puzzle-wrap');
      if (oldPuzzleWrap) oldPuzzleWrap.classList.add('hidden');
      const oldWheelWrap = document.getElementById('qte-wheel-wrap');
      if (oldWheelWrap) oldWheelWrap.classList.add('hidden');
      const oldMashWrap = document.getElementById('qte-mash-wrap');
      if (oldMashWrap) oldMashWrap.classList.add('hidden');
      const oldMicrogameWrap = document.getElementById('qte-microgame-wrap');
      if (oldMicrogameWrap) oldMicrogameWrap.classList.add('hidden');

      // Randomly select mode: slider, sequence, puzzle, wheel, mash, or microgame
      let mode = preferredMode;
      if (!mode) {
        const modeChoice = Math.random();
        if (modeChoice < 0.16) mode = 'slider';
        else if (modeChoice < 0.32) mode = 'sequence';
        else if (modeChoice < 0.48) mode = 'puzzle';
        else if (modeChoice < 0.64) mode = 'wheel';
        else if (modeChoice < 0.80) mode = 'mash';
        else mode = 'microgame';
      }

      let cleanUp = null;
      let active = true;

      if (mode === 'slider') {
        sliderWrap.classList.remove('hidden');
        instrEl.innerText = instructions + " (Zone expands over time!)";
        if (footerTip) footerTip.innerText = "PRESS [SPACE] OR [E] TO TRIGGER!";

        const targetZoneEl = document.getElementById('qte-target-zone');
        const pointerEl = document.getElementById('qte-pointer');

        const targetLeft = 15 + Math.floor(Math.random() * 55);
        const targetCenter = targetLeft + 6.0; // base width 12% -> center is +6%
        let currentWidth = 12; // Start with 12% width
        let currentLeft = targetLeft;

        targetZoneEl.style.left = currentLeft + '%';
        targetZoneEl.style.width = currentWidth + '%';

        let pointerPct = 0;
        let direction = 1;
        const speed = 2.2 + Math.random() * 1.2;
        animId = null;
        const startTime = performance.now();

        const tick = () => {
          if (!active) return;

          // Expand green zone dynamically over time
          const elapsed = performance.now() - startTime;
          currentWidth = Math.min(50, 12 + elapsed * 0.008); // grows by 0.008% per ms, caps at 50%
          currentLeft = Math.max(5, targetCenter - currentWidth / 2);
          targetZoneEl.style.left = currentLeft + '%';
          targetZoneEl.style.width = currentWidth + '%';

          pointerPct += direction * speed;
          if (pointerPct >= 100) {
            pointerPct = 100;
            direction = -1;
          } else if (pointerPct <= 0) {
            pointerPct = 0;
            direction = 1;
          }
          pointerEl.style.left = pointerPct + '%';
          animId = requestAnimationFrame(tick);
        };
        animId = requestAnimationFrame(tick);

        cleanUp = () => {
          active = false;
          cancelAnimationFrame(animId);
          container.classList.add('hidden');
          window.removeEventListener('keydown', handleKey);
          this.isInQTE = false;
          if (this.inputHandler) this.inputHandler.keys = {};
        };

        const handleKey = (e) => {
          const key = e.key.toLowerCase();
          if (key === ' ' || key === 'e') {
            e.preventDefault();
            cleanUp();

            if (pointerPct >= currentLeft && pointerPct <= currentLeft + currentWidth) {
              window.Casino.SoundManager.playWin();
              successCallback();
            } else {
              window.Casino.SoundManager.playLose();
              if (failureCallback) {
                failureCallback();
              } else {
                this.showNotification("QTE Failed! Action incomplete.", "error");
              }
            }
          }
        };
        window.addEventListener('keydown', handleKey);

      } else if (mode === 'sequence') {
        // Sequence Typing Mode
        sliderWrap.classList.add('hidden');
        sequenceWrap.classList.remove('hidden');
        instrEl.innerText = "Type the sequence keys before timer runs out!";
        if (footerTip) footerTip.innerText = "TYPE IN ORDER!";

        const keysListEl = document.getElementById('qte-keys-list');
        const timerBarEl = document.getElementById('qte-sequence-timer');
        keysListEl.innerHTML = '';

        // Generate 4 random keys from WASD
        const possibleKeys = ['w', 'a', 's', 'd'];
        const sequence = [];
        for (let i = 0; i < 4; i++) {
          sequence.push(possibleKeys[Math.floor(Math.random() * possibleKeys.length)]);
        }

        let currentIndex = 0;
        const totalDuration = 4500; // 4.5 seconds to complete
        const startTime = performance.now();
        let timerInterval = null;

        // Render capsules
        const keySpans = sequence.map((k, index) => {
          const span = document.createElement('span');
          span.innerText = k.toUpperCase();
          span.style.display = 'inline-block';
          span.style.width = '36px';
          span.style.height = '36px';
          span.style.lineHeight = '36px';
          span.style.background = 'rgba(255,255,255,0.05)';
          span.style.border = '2px solid rgba(255,255,255,0.2)';
          span.style.borderRadius = '8px';
          span.style.fontWeight = 'bold';
          span.style.fontSize = '14px';
          span.style.color = '#a0a0c0';
          span.style.transition = 'all 0.15s ease';
          
          if (index === 0) {
            span.style.borderColor = '#ff007f';
            span.style.color = '#fff';
            span.style.boxShadow = '0 0 8px #ff007f';
          }
          keysListEl.appendChild(span);
          return span;
        });

        const tickTimer = () => {
          if (!active) return;
          const elapsed = performance.now() - startTime;
          const remainingPct = Math.max(0, 100 - (elapsed / totalDuration) * 100);
          timerBarEl.style.width = remainingPct + '%';

          if (elapsed >= totalDuration) {
            cleanUp();
            window.Casino.SoundManager.playLose();
            if (failureCallback) {
              failureCallback();
            } else {
              this.showNotification("Time ran out! QTE Failed.", "error");
            }
          } else {
            timerInterval = requestAnimationFrame(tickTimer);
          }
        };
        timerInterval = requestAnimationFrame(tickTimer);

        cleanUp = () => {
          active = false;
          cancelAnimationFrame(timerInterval);
          container.classList.add('hidden');
          window.removeEventListener('keydown', handleKeyPress);
          this.isInQTE = false;
          if (this.inputHandler) this.inputHandler.keys = {};
        };

        const handleKeyPress = (e) => {
          const key = e.key.toLowerCase();
          
          if (possibleKeys.includes(key)) {
            e.preventDefault();
            e.stopPropagation();
          }
          
          if (e.ctrlKey || e.altKey || e.metaKey) return;
          
          const expectedKey = sequence[currentIndex];
          if (key === expectedKey) {
            window.Casino.SoundManager.playBeep();
            
            const span = keySpans[currentIndex];
            span.style.background = '#39ff14';
            span.style.borderColor = '#39ff14';
            span.style.color = '#000';
            span.style.boxShadow = '0 0 12px #39ff14';

            currentIndex++;

            if (currentIndex >= sequence.length) {
              cleanUp();
              window.Casino.SoundManager.playWin();
              successCallback();
            } else {
              const nextSpan = keySpans[currentIndex];
              nextSpan.style.borderColor = '#ff007f';
              nextSpan.style.color = '#fff';
              nextSpan.style.boxShadow = '0 0 8px #ff007f';
            }
          } else if (possibleKeys.includes(key)) {
            window.Casino.SoundManager.playLose();
            currentIndex = 0;
            keySpans.forEach((span, idx) => {
              span.style.background = 'rgba(255,255,255,0.05)';
              span.style.border = '2px solid rgba(255,255,255,0.2)';
              span.style.color = '#a0a0c0';
              span.style.boxShadow = 'none';
              if (idx === 0) {
                span.style.borderColor = '#ff007f';
                span.style.color = '#fff';
                span.style.boxShadow = '0 0 8px #ff007f';
              }
            });
          }
        };
        window.addEventListener('keydown', handleKeyPress);
      } else if (mode === 'puzzle') {
        // Color Wiring Sequence Puzzle Mode
        sliderWrap.classList.add('hidden');
        sequenceWrap.classList.add('hidden');
        instrEl.innerText = "Connect the wires! Click the nodes in order of the target sequence.";
        if (footerTip) footerTip.innerText = "CLICK THE COLOR NODES!";

        // Get or create puzzle wrapper
        let puzzleWrap = document.getElementById('qte-puzzle-wrap');
        if (!puzzleWrap) {
          puzzleWrap = document.createElement('div');
          puzzleWrap.id = 'qte-puzzle-wrap';
          puzzleWrap.style.marginTop = '12px';
          puzzleWrap.style.marginBottom = '16px';
          puzzleWrap.style.display = 'flex';
          puzzleWrap.style.flexDirection = 'column';
          puzzleWrap.style.alignItems = 'center';
          puzzleWrap.style.gap = '12px';
          puzzleWrap.style.width = '100%';
          container.insertBefore(puzzleWrap, footerTip);
        }
        puzzleWrap.classList.remove('hidden');
        puzzleWrap.innerHTML = '';

        // Generate target sequence
        const colors = [
          { name: 'Red', hex: '#ff4d4d' },
          { name: 'Green', hex: '#39ff14' },
          { name: 'Blue', hex: '#00f0ff' },
          { name: 'Yellow', hex: '#ffaa00' }
        ];
        
        const targetSequence = [];
        for (let i = 0; i < 4; i++) {
          targetSequence.push(colors[Math.floor(Math.random() * colors.length)]);
        }

        // Render target sequence preview
        const targetRow = document.createElement('div');
        targetRow.style.display = 'flex';
        targetRow.style.gap = '8px';
        targetRow.style.justifyContent = 'center';
        targetRow.style.background = 'rgba(0,0,0,0.3)';
        targetRow.style.padding = '8px';
        targetRow.style.borderRadius = '8px';
        targetRow.style.border = '1px solid rgba(255,255,255,0.08)';
        targetRow.style.width = '100%';
        targetRow.style.boxSizing = 'border-box';

        targetSequence.forEach(color => {
          const indicator = document.createElement('div');
          indicator.style.width = '16px';
          indicator.style.height = '16px';
          indicator.style.borderRadius = '50%';
          indicator.style.background = color.hex;
          indicator.style.boxShadow = `0 0 6px ${color.hex}`;
          targetRow.appendChild(indicator);
        });
        puzzleWrap.appendChild(targetRow);

        // Render interactive node terminals
        const nodesRow = document.createElement('div');
        nodesRow.style.display = 'flex';
        nodesRow.style.gap = '12px';
        nodesRow.style.justifyContent = 'center';

        let playerIndex = 0;

        const nodeButtons = colors.map(color => {
          const btn = document.createElement('button');
          btn.style.width = '42px';
          btn.style.height = '42px';
          btn.style.borderRadius = '50%';
          btn.style.border = '2px solid rgba(255,255,255,0.2)';
          btn.style.background = 'rgba(0,0,0,0.4)';
          btn.style.cursor = 'pointer';
          btn.style.display = 'flex';
          btn.style.alignItems = 'center';
          btn.style.justifyContent = 'center';
          btn.style.transition = 'all 0.15s ease';
          
          // Inner core color
          const core = document.createElement('div');
          core.style.width = '20px';
          core.style.height = '20px';
          core.style.borderRadius = '50%';
          core.style.background = color.hex;
          core.style.boxShadow = `0 0 4px ${color.hex}`;
          btn.appendChild(core);

          // Click handling
          btn.addEventListener('click', () => {
            if (!active) return;
            window.Casino.SoundManager.playClick();
            
            // Check matching color
            const targetColor = targetSequence[playerIndex];
            if (color.name === targetColor.name) {
              // Correct color node! Highlight indicator
              targetRow.children[playerIndex].style.opacity = '0.3'; // dim completed indicator
              playerIndex++;
              
              if (playerIndex >= targetSequence.length) {
                // Success!
                cleanUp();
                window.Casino.SoundManager.playWin();
                successCallback();
              }
            } else {
              // Incorrect wire! Fail!
              cleanUp();
              window.Casino.SoundManager.playLose();
              if (failureCallback) {
                failureCallback();
              } else {
                this.showNotification("Wrong wire connection! QTE Failed.", "error");
              }
            }
          });

          // Hover feedback
          btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.1)';
            btn.style.borderColor = color.hex;
            btn.style.boxShadow = `0 0 10px ${color.hex}`;
          });
          btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1.0)';
            btn.style.borderColor = 'rgba(255,255,255,0.2)';
            btn.style.boxShadow = 'none';
          });

          nodesRow.appendChild(btn);
          return btn;
        });

        puzzleWrap.appendChild(nodesRow);

        // Timer bar
        const timerContainer = document.createElement('div');
        timerContainer.style.position = 'relative';
        timerContainer.style.width = '100%';
        timerContainer.style.height = '6px';
        timerContainer.style.background = '#222';
        timerContainer.style.borderRadius = '3px';
        timerContainer.style.overflow = 'hidden';

        const timerBar = document.createElement('div');
        timerBar.style.position = 'absolute';
        timerBar.style.top = '0';
        timerBar.style.left = '0';
        timerBar.style.height = '100%';
        timerBar.style.width = '100%';
        timerBar.style.background = '#ff007f';
        timerContainer.appendChild(timerBar);
        puzzleWrap.appendChild(timerContainer);

        const totalDuration = 6000; // 6 seconds for puzzle
        const startTime = performance.now();
        let timerInterval = null;

        const tickTimer = () => {
          if (!active) return;
          const elapsed = performance.now() - startTime;
          const remainingPct = Math.max(0, 100 - (elapsed / totalDuration) * 100);
          timerBar.style.width = remainingPct + '%';

          if (elapsed >= totalDuration) {
            cleanUp();
            window.Casino.SoundManager.playLose();
            if (failureCallback) {
              failureCallback();
            } else {
              this.showNotification("Time ran out! QTE Failed.", "error");
            }
          } else {
            timerInterval = requestAnimationFrame(tickTimer);
          }
        };
        timerInterval = requestAnimationFrame(tickTimer);

        cleanUp = () => {
          active = false;
          cancelAnimationFrame(timerInterval);
          container.classList.add('hidden');
          puzzleWrap.classList.add('hidden');
          this.isInQTE = false;
          if (this.inputHandler) this.inputHandler.keys = {};
        };
      } else if (mode === 'wheel') {
        // Dead by Daylight Circular Skill Check Wheel Mode
        sliderWrap.classList.add('hidden');
        sequenceWrap.classList.add('hidden');
        instrEl.innerText = "Hit the target zone! Press SPACE, E, or Click when needle is in the zone!";
        if (footerTip) footerTip.innerText = "PRESS [SPACE], [E], OR CLICK THE WHEEL!";

        // Get or create wheel wrapper
        let wheelWrap = document.getElementById('qte-wheel-wrap');
        if (!wheelWrap) {
          wheelWrap = document.createElement('div');
          wheelWrap.id = 'qte-wheel-wrap';
          wheelWrap.style.marginTop = '12px';
          wheelWrap.style.marginBottom = '16px';
          wheelWrap.style.display = 'flex';
          wheelWrap.style.justifyContent = 'center';
          wheelWrap.style.width = '100%';
          container.insertBefore(wheelWrap, footerTip);
        }
        wheelWrap.classList.remove('hidden');
        wheelWrap.innerHTML = '';

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        canvas.style.cursor = 'pointer';
        wheelWrap.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const cx = 60;
        const cy = 60;
        const radius = 45;

        // Generate target zone angle (in radians)
        const targetWidth = 0.6 + Math.random() * 0.2; // approx 35-45 degrees
        const targetStart = 0.5 * Math.PI + Math.random() * 0.8 * Math.PI;
        const targetEnd = targetStart + targetWidth;
        
        this.qteTargetStart = targetStart;
        this.qteTargetEnd = targetEnd;
        
        // Great check zone is the first 22% of target zone
        const greatWidth = targetWidth * 0.22;
        const greatStart = targetStart;
        const greatEnd = targetStart + greatWidth;

        let currentAngle = 0;
        this.qteAngle = currentAngle;
        const speed = 0.02 + Math.random() * 0.008;
        animId = null;

        const tick = () => {
          if (!active) return;
          ctx.clearRect(0, 0, 120, 120);

          // 1. Draw background circular track
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
          ctx.lineWidth = 8;
          ctx.strokeStyle = '#222';
          ctx.stroke();

          // 2. Draw Good target sector
          ctx.beginPath();
          ctx.arc(cx, cy, radius, targetStart, targetEnd);
          ctx.lineWidth = 10;
          ctx.strokeStyle = 'rgba(57, 255, 20, 0.4)';
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(cx, cy, radius, targetStart, targetEnd);
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#39ff14';
          ctx.stroke();

          // 3. Draw Great target sector
          ctx.beginPath();
          ctx.arc(cx, cy, radius, greatStart, greatEnd);
          ctx.lineWidth = 10;
          ctx.strokeStyle = '#fff';
          ctx.stroke();

          // 4. Draw needle
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(currentAngle);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(radius + 8, 0);
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#ff007f';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#ff007f';
          ctx.stroke();
          ctx.restore();

          currentAngle = (currentAngle + speed) % (2 * Math.PI);
          this.qteAngle = currentAngle;
          animId = requestAnimationFrame(tick);
        };
        animId = requestAnimationFrame(tick);

        cleanUp = () => {
          active = false;
          cancelAnimationFrame(animId);
          container.classList.add('hidden');
          wheelWrap.classList.add('hidden');
          window.removeEventListener('keydown', handleInput);
          canvas.removeEventListener('click', triggerClick);
          this.isInQTE = false;
          if (this.inputHandler) this.inputHandler.keys = {};
        };

        const resolveQTE = () => {
          cleanUp();
          const normAngle = currentAngle % (2 * Math.PI);
          
          const tolerance = 0.08;
          if (normAngle >= (targetStart - tolerance) && normAngle <= (targetEnd + tolerance)) {
            window.Casino.SoundManager.playWin();
            if (normAngle >= greatStart && normAngle <= greatEnd) {
              this.showNotification("🎯 GREAT SKILL CHECK! Boost duration doubled!", "success");
              successCallback(true);
            } else {
              successCallback(false);
            }
          } else {
            window.Casino.SoundManager.playLose();
            if (failureCallback) {
              failureCallback();
            } else {
              this.showNotification("QTE Failed! Missed target zone.", "error");
            }
          }
        };

        const handleInput = (e) => {
          const key = e.key.toLowerCase();
          if (key === ' ' || key === 'e') {
            e.preventDefault();
            resolveQTE();
          }
        };
        const triggerClick = (e) => {
          e.preventDefault();
          resolveQTE();
        };

        window.addEventListener('keydown', handleInput);
        canvas.addEventListener('click', triggerClick);
      } else if (mode === 'mash') {
        let mashWrap = document.getElementById('qte-mash-wrap');
        if (!mashWrap) {
          mashWrap = document.createElement('div');
          mashWrap.id = 'qte-mash-wrap';
          mashWrap.style.marginBottom = '16px';
          
          const progressContainer = document.createElement('div');
          progressContainer.style.position = 'relative';
          progressContainer.style.width = '100%';
          progressContainer.style.height = '24px';
          progressContainer.style.background = '#222';
          progressContainer.style.borderRadius = '6px';
          progressContainer.style.overflow = 'hidden';
          progressContainer.style.marginBottom = '8px';
          
          const progressFill = document.createElement('div');
          progressFill.id = 'qte-mash-fill';
          progressFill.style.position = 'absolute';
          progressFill.style.top = '0';
          progressFill.style.left = '0';
          progressFill.style.height = '100%';
          progressFill.style.width = '0%';
          progressFill.style.background = 'linear-gradient(90deg, #ff007f, #39ff14)';
          progressFill.style.boxShadow = '0 0 10px #39ff14';
          progressFill.style.transition = 'width 0.05s ease';
          
          progressContainer.appendChild(progressFill);
          
          const timerContainer = document.createElement('div');
          timerContainer.style.position = 'relative';
          timerContainer.style.width = '100%';
          timerContainer.style.height = '6px';
          timerContainer.style.background = '#222';
          timerContainer.style.borderRadius = '3px';
          timerContainer.style.overflow = 'hidden';
          
          const timerFill = document.createElement('div');
          timerFill.id = 'qte-mash-timer';
          timerFill.style.position = 'absolute';
          timerFill.style.top = '0';
          timerFill.style.left = '0';
          timerFill.style.height = '100%';
          timerFill.style.width = '100%';
          timerFill.style.background = '#ffaa00';
          
          timerContainer.appendChild(timerFill);
          
          mashWrap.appendChild(progressContainer);
          mashWrap.appendChild(timerContainer);
          
          container.insertBefore(mashWrap, footerTip);
        }
        
        mashWrap.classList.remove('hidden');
        instrEl.innerText = instructions + " (Mash rapidly!)";
        if (footerTip) footerTip.innerText = "PRESS [SPACE], [E], OR CLICK RAPIDLY!";
        
        const progressFillEl = document.getElementById('qte-mash-fill');
        const timerFillEl = document.getElementById('qte-mash-timer');
        progressFillEl.style.width = '0%';
        timerFillEl.style.width = '100%';
        
        let progress = 0;
        const totalDuration = 4000; // 4 seconds
        const startTime = performance.now();
        let lastTick = performance.now();
        let resolved = false;
        
        const tick = () => {
          if (!active) return;
          const now = performance.now();
          const dt = (now - lastTick) / 1000;
          lastTick = now;
          
          // Decay progress
          progress = Math.max(0, progress - 12 * dt);
          progressFillEl.style.width = progress + '%';
          
          // Timer
          const elapsed = now - startTime;
          const remainingPct = Math.max(0, 100 - (elapsed / totalDuration) * 100);
          timerFillEl.style.width = remainingPct + '%';
          
          if (progress >= 100) {
            handleSuccess();
          } else if (elapsed >= totalDuration) {
            handleFailure();
          } else {
            animId = requestAnimationFrame(tick);
          }
        };
        animId = requestAnimationFrame(tick);
        
        cleanUp = () => {
          active = false;
          cancelAnimationFrame(animId);
          container.classList.add('hidden');
          mashWrap.classList.add('hidden');
          window.removeEventListener('keydown', handleInput);
          window.removeEventListener('mousedown', triggerClick);
          container.removeEventListener('mousedown', triggerClick);
          this.isInQTE = false;
          if (this.inputHandler) this.inputHandler.keys = {};
        };

        const handleSuccess = () => {
          if (resolved) return;
          resolved = true;
          cleanUp();
          window.Casino.SoundManager.playWin();
          successCallback();
        };

        const handleFailure = () => {
          if (resolved) return;
          resolved = true;
          cleanUp();
          window.Casino.SoundManager.playLose();
          if (failureCallback) {
            failureCallback();
          } else {
            this.showNotification("Time ran out! QTE Failed.", "error");
          }
        };
        
        const handleInput = (e) => {
          const key = e.key.toLowerCase();
          if (key === ' ' || key === 'e') {
            e.preventDefault();
            e.stopPropagation();
            window.Casino.SoundManager.playBeep();
            progress = Math.min(100, progress + 16);
            progressFillEl.style.width = progress + '%';
            if (progress >= 100) {
              handleSuccess();
            }
          }
        };
        
        const triggerClick = (e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          window.Casino.SoundManager.playBeep();
          progress = Math.min(100, progress + 16);
          progressFillEl.style.width = progress + '%';
          if (progress >= 100) {
            handleSuccess();
          }
        };
        
        window.addEventListener('keydown', handleInput);
        window.addEventListener('mousedown', triggerClick);
        container.addEventListener('mousedown', triggerClick);
      } else if (mode === 'microgame') {
        let microgameWrap = document.getElementById('qte-microgame-wrap');
        if (!microgameWrap) {
          microgameWrap = document.createElement('div');
          microgameWrap.id = 'qte-microgame-wrap';
          microgameWrap.style.marginBottom = '16px';
          
          const canvas = document.createElement('canvas');
          canvas.id = 'qte-microgame-canvas';
          canvas.width = 280;
          canvas.height = 160;
          canvas.style.background = '#121224';
          canvas.style.borderRadius = '8px';
          canvas.style.border = '2px solid rgba(255,255,255,0.1)';
          canvas.style.cursor = 'pointer';
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto 8px auto';
          
          const timerContainer = document.createElement('div');
          timerContainer.style.position = 'relative';
          timerContainer.style.width = '100%';
          timerContainer.style.height = '6px';
          timerContainer.style.background = '#222';
          timerContainer.style.borderRadius = '3px';
          timerContainer.style.overflow = 'hidden';
          
          const timerFill = document.createElement('div');
          timerFill.id = 'qte-microgame-timer';
          timerFill.style.position = 'absolute';
          timerFill.style.top = '0';
          timerFill.style.left = '0';
          timerFill.style.height = '100%';
          timerFill.style.width = '100%';
          timerFill.style.background = '#ff007f';
          
          timerContainer.appendChild(timerFill);
          microgameWrap.appendChild(canvas);
          microgameWrap.appendChild(timerContainer);
          
          container.insertBefore(microgameWrap, footerTip);
        }
        
        microgameWrap.classList.remove('hidden');
        
        const canvas = document.getElementById('qte-microgame-canvas');
        const ctx = canvas.getContext('2d');
        const timerFillEl = document.getElementById('qte-microgame-timer');
        timerFillEl.style.width = '100%';
        
        // Random subgame choice from expanded Planet-inspired list
        const subgames = [
          'parry', 'crazy_cars', 'wario_whirled', 'diamond_dig', 'dodge_balls', 'log_chop', 'fruit_shoot', 'batter_up',
          'heads_up', 'boing', 'spare_me', 'baseline_bash', 'butterfly_stroke', 'hammer_toss', 'balancing_act',
          'putt_for_dough', 'ski_jump', 'mountain_mountin', 'guy_scraper', 'space_fighter', 'ninja_pipe_cleaner', 'bam_fu'
        ];
        const subgame = subgames[Math.floor(Math.random() * subgames.length)];
        
        let subgameTitle = "MICROGAME";
        let subgameInstructions = "Prepare!";
        
        if (subgame === 'parry') {
          subgameTitle = "⚡ PARRY!";
          subgameInstructions = "Press SPACE/E exactly when rings overlap!";
        } else if (subgame === 'crazy_cars') {
          subgameTitle = "🚗 JUMP!";
          subgameInstructions = "Press SPACE/E/Click to jump over the car!";
        } else if (subgame === 'wario_whirled') {
          subgameTitle = "🎯 STOP!";
          subgameInstructions = "Press SPACE/E/Click when pointing at the green zone!";
        } else if (subgame === 'diamond_dig') {
          subgameTitle = "💎 DIG!";
          subgameInstructions = "Mash SPACE/E/Click to find the diamond!";
        } else if (subgame === 'dodge_balls') {
          subgameTitle = "🎾 DODGE!";
          subgameInstructions = "Use A/D or LEFT/RIGHT to dodge balls!";
        } else if (subgame === 'log_chop') {
          subgameTitle = "🪓 CHOP!";
          subgameInstructions = "Press SPACE/E/Click when log matches the line!";
        } else if (subgame === 'fruit_shoot') {
          subgameTitle = "🍎 SHOOT!";
          subgameInstructions = "Press SPACE/E/Click to shoot the moving apple!";
        } else if (subgame === 'batter_up') {
          subgameTitle = "⚾ SWING!";
          subgameInstructions = "Press SPACE/E/Click when ball hits the sweet spot!";
        } else if (subgame === 'heads_up') {
          subgameTitle = "🍗 CATCH!";
          subgameInstructions = "Use A/D or LEFT/RIGHT to catch the chicken wing!";
        } else if (subgame === 'boing') {
          subgameTitle = "🎪 BOING!";
          subgameInstructions = "Use A/D or LEFT/RIGHT to slide the trampoline!";
        } else if (subgame === 'spare_me') {
          subgameTitle = "🎳 BOWL!";
          subgameInstructions = "Press SPACE/E/Click when aiming at pins!";
        } else if (subgame === 'baseline_bash') {
          subgameTitle = "🎾 RETURN!";
          subgameInstructions = "Press SPACE/E/Click when ball hits baseline!";
        } else if (subgame === 'butterfly_stroke') {
          subgameTitle = "🏊 SWIM!";
          subgameInstructions = "Mash SPACE/E/Click to swim to the wall!";
        } else if (subgame === 'hammer_toss') {
          subgameTitle = "☄️ FLING!";
          subgameInstructions = "Press SPACE/E/Click to launch into orange slice!";
        } else if (subgame === 'balancing_act') {
          subgameTitle = "⚖️ BALANCE!";
          subgameInstructions = "Use A/D or LEFT/RIGHT to keep stack balanced!";
        } else if (subgame === 'putt_for_dough') {
          subgameTitle = "⛳ PUTT!";
          subgameInstructions = "Press SPACE/E/Click when power is in green!";
        } else if (subgame === 'ski_jump') {
          subgameTitle = "⛷️ SKI JUMP!";
          subgameInstructions = "Press SPACE/E/Click exactly at edge of ramp!";
        } else if (subgame === 'mountain_mountin') {
          subgameTitle = "☁️ SUMMIT!";
          subgameInstructions = "Use A/D or LEFT/RIGHT to steer onto clouds!";
        } else if (subgame === 'guy_scraper') {
          subgameTitle = "🏢 LAND!";
          subgameInstructions = "Press SPACE/E/Click to drop onto scraper!";
        } else if (subgame === 'space_fighter') {
          subgameTitle = "🚀 BLAST!";
          subgameInstructions = "Press SPACE/E/Click when locked on target!";
        } else if (subgame === 'ninja_pipe_cleaner') {
          subgameTitle = "⚔️ SLASH!";
          subgameInstructions = "Press corresponding arrow or key to strike ninja!";
        } else if (subgame === 'bam_fu') {
          subgameTitle = "🪓 CHOP!";
          subgameInstructions = "Chop wood! DO NOT chop raccoon!";
        }
        
        instrEl.innerText = subgameInstructions;
        if (footerTip) footerTip.innerText = "GET READY!";
        
        animId = null;
        const totalDuration = 3500; // 3.5 seconds
        const startTime = performance.now();
        
        // Subgame state variables
        let gameScore = 0;
        let gameOver = false;
        
        // State initializations
        let parryRingRadius = 55;
        let parryWindowMin = 13;
        let parryWindowMax = 18;
        let parFlashed = 0;
        
        let playerX = 40;
        let playerY = 120;
        let playerVy = 0;
        let carX = 280;
        let carY = 122;
        let carPassed = false;
        
        let wheelAngle = 0;
        let wheelTargetStart = -0.5;
        let wheelTargetEnd = 0.5;
        let wheelStopped = false;
        
        let digCount = 0;
        let digRequired = 8;
        
        let dodgePlayerX = 140;
        let balls = [];
        let nextBallSpawn = 0;
        
        let logX = -30;
        let logChopTargetX = 140;
        let axeY = 30;
        let axeChopped = false;
        let logChopped = false;
        
        let fruitX = 140;
        let fruitDir = 1;
        let arrowX = 140;
        let arrowY = 140;
        let arrowFired = false;
        let fruitHit = false;
        let shootAngle = 0;
        let shootAngleDir = 1;
        
        let ballX = 140;
        let ballY = 60;
        let ballRadius = 2;
        let batterSwung = false;
        let batterHit = false;
        
        let catchPlayerX = 140;
        let wingX = 40 + Math.random() * 200;
        let wingY = 0;
        let wingVy = 130;
        
        let trampX = 140;
        let jumperX = 140;
        let jumperY = 30;
        let jumperVx = 60 + Math.random() * 60;
        let jumperVy = 0;
        let jumperBounces = 0;
        
        let bowlBallX = 140;
        let bowlBallY = 130;
        let bowlBallFired = false;
        let pinAngle = 0;
        let pinAngleDir = 1;
        
        let tennisBallX = 140;
        let tennisBallY = 20;
        let tennisBallRadius = 1;
        let playerSwung = false;
        let playerHit = false;
        
        let swimX = 20;
        let swimRequired = 10;
        
        let hammerAngle = 0;
        let hammerReleased = false;
        let hammerTargetAngleStart = 4.2;
        let hammerTargetAngleEnd = 5.2;
        
        let balanceX = 140;
        let balanceAngle = 0;
        let balanceDrift = 1.2;
        
        let golfBallX = 40;
        let golfPuttSuccess = false;
        let powerMeterVal = 0;
        let powerMeterDir = 1;
        let puttFired = false;
        
        let skierY = 30;
        let skierX = 30;
        let skierJumped = false;
        
        let mountPlayerX = 140;
        let mountPlayerY = 130;
        let mountPlayerVy = 0;
        let clouds = [
          { x: 100, y: 100, w: 40 },
          { x: 160, y: 70, w: 40 },
          { x: 110, y: 40, w: 40 }
        ];
        
        let guyX = 140;
        let guyY = 20;
        let guyDropped = false;
        let buildingX = 30;
        let buildingDir = 1;
        
        let targetX = 30;
        let targetY = 30;
        let targetVx = 100;
        let targetVy = 60;
        let crosshairLocked = false;
        
        let ninjaIncoming = [];
        let nextNinjaSpawn = 0;
        let ninjaKills = 0;
        let ninjaRequired = 3;
        
        let bamItemX = -30;
        let bamItemType = 'wood';
        let bamChopped = false;
        let bamAxeY = 30;
        let bamAxeChopped = false;
        
        const tick = () => {
          if (!active) return;
          const now = performance.now();
          const elapsed = now - startTime;
          const remainingPct = Math.max(0, 100 - (elapsed / totalDuration) * 100);
          timerFillEl.style.width = remainingPct + '%';
          
          ctx.fillStyle = '#121224';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.font = 'bold 22px "Outfit", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(subgameTitle, 140, 80);
          
          if (subgame === 'parry') {
            ctx.beginPath();
            ctx.arc(140, 80, 15, 0, Math.PI * 2);
            ctx.fillStyle = parFlashed > 0 ? '#39ff14' : '#ff007f';
            ctx.shadowBlur = parFlashed > 0 ? 15 : 0;
            ctx.shadowColor = '#39ff14';
            ctx.fill();
            ctx.shadowBlur = 0;
            
            if (!gameOver) {
              parryRingRadius = Math.max(5, parryRingRadius - 40 * 0.016);
              if (parryRingRadius <= 5) {
                gameOver = true;
                gameScore = -1;
              }
            }
            
            ctx.beginPath();
            ctx.arc(140, 80, parryRingRadius, 0, Math.PI * 2);
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(140, 80, 15, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(57, 255, 20, 0.4)';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.lineWidth = 1;
            
          } else if (subgame === 'crazy_cars') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.moveTo(0, 130);
            ctx.lineTo(280, 130);
            ctx.stroke();
            
            if (!gameOver) {
              playerVy += 650 * 0.016;
              playerY += playerVy * 0.016;
              if (playerY >= 120) {
                playerY = 120;
                playerVy = 0;
              }
              
              carX -= 210 * 0.016;
              
              const playerWidth = 14;
              const playerHeight = 20;
              const carWidth = 24;
              const carHeight = 14;
              
              if (Math.abs((playerX + playerWidth/2) - (carX + carWidth/2)) < (playerWidth + carWidth)/2 &&
                  Math.abs((playerY + playerHeight/2) - (carY + carHeight/2)) < (playerHeight + carHeight)/2) {
                gameOver = true;
                gameScore = -1;
              }
              
              if (carX < -30 && !carPassed) {
                carPassed = true;
                gameScore = 1;
              }
            }
            
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(playerX, playerY, 14, 20);
            ctx.fillStyle = '#fff';
            ctx.fillRect(playerX + 4, playerY + 3, 6, 6);
            
            ctx.fillStyle = '#ff007f';
            ctx.fillRect(carX, carY, 24, 14);
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(carX + 5, carY + 14, 3, 0, Math.PI * 2);
            ctx.arc(carX + 19, carY + 14, 3, 0, Math.PI * 2);
            ctx.fill();
            
          } else if (subgame === 'wario_whirled') {
            ctx.beginPath();
            ctx.arc(140, 80, 45, 0, Math.PI * 2);
            ctx.fillStyle = '#222';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(140, 80);
            ctx.arc(140, 80, 45, -Math.PI/2 + wheelTargetStart, -Math.PI/2 + wheelTargetEnd);
            ctx.closePath();
            ctx.fillStyle = 'rgba(57, 255, 20, 0.4)';
            ctx.fill();
            
            if (!wheelStopped) {
              wheelAngle += 4.5 * 0.016;
            }
            
            ctx.save();
            ctx.translate(140, 80);
            ctx.rotate(wheelAngle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -42);
            ctx.strokeStyle = '#ff007f';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(-5, -35);
            ctx.lineTo(0, -45);
            ctx.lineTo(5, -35);
            ctx.closePath();
            ctx.fillStyle = '#ff007f';
            ctx.fill();
            ctx.restore();
            
          } else if (subgame === 'diamond_dig') {
            ctx.fillStyle = '#3e2723';
            ctx.fillRect(20, 30, 240, 110);
            
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.moveTo(140, 115);
            ctx.lineTo(146, 122);
            ctx.lineTo(140, 130);
            ctx.lineTo(134, 122);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = '#222';
            ctx.fillRect(40, 15, 200, 10);
            const progressWidth = (digCount / digRequired) * 200;
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(40, 15, progressWidth, 10);
            
            ctx.fillStyle = '#bbb';
            const currentShovelY = 30 + (digCount / digRequired) * 70;
            ctx.fillRect(135, currentShovelY, 10, 12);
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(139, currentShovelY - 20, 2, 20);
            
          } else if (subgame === 'dodge_balls') {
            if (!gameOver) {
              if (this.inputHandler && (this.inputHandler.keys['arrowleft'] || this.inputHandler.keys['a'])) {
                dodgePlayerX = Math.max(30, dodgePlayerX - 160 * 0.016);
              }
              if (this.inputHandler && (this.inputHandler.keys['arrowright'] || this.inputHandler.keys['d'])) {
                dodgePlayerX = Math.min(250, dodgePlayerX + 160 * 0.016);
              }
              
              if (now > nextBallSpawn) {
                balls.push({
                  x: 30 + Math.random() * 220,
                  y: 10,
                  vy: 90 + Math.random() * 50
                });
                nextBallSpawn = now + 600 + Math.random() * 400;
              }
              
              balls.forEach(ball => {
                ball.y += ball.vy * 0.016;
                
                const dx = ball.x - dodgePlayerX;
                const dy = ball.y - 125;
                if (Math.sqrt(dx*dx + dy*dy) < 14) {
                  gameOver = true;
                  gameScore = -1;
                }
              });
              
              balls = balls.filter(b => b.y < 170);
            }
            
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(dodgePlayerX - 8, 120, 16, 16);
            ctx.fillStyle = '#fff';
            ctx.fillRect(dodgePlayerX - 4, 124, 8, 4);
            
            ctx.fillStyle = '#ff007f';
            balls.forEach(b => {
              ctx.beginPath();
              ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
              ctx.fill();
            });
            
          } else if (subgame === 'log_chop') {
            ctx.strokeStyle = '#39ff14';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(logChopTargetX, 40);
            ctx.lineTo(logChopTargetX, 130);
            ctx.stroke();
            ctx.lineWidth = 1;
            
            if (!gameOver && !axeChopped) {
              logX += 130 * 0.016;
              if (logX > 290) {
                gameOver = true;
                gameScore = -1;
              }
            }
            
            ctx.fillStyle = '#555';
            ctx.fillRect(10, 115, 260, 10);
            
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(logX - 18, 95, 36, 20);
            ctx.strokeStyle = '#ffe0b2';
            ctx.beginPath();
            ctx.arc(logX, 105, 7, 0, Math.PI * 2);
            ctx.stroke();
            
            if (axeChopped && axeY < 90) {
              axeY += 500 * 0.016;
              if (axeY >= 90) {
                axeY = 90;
                if (Math.abs(logX - logChopTargetX) < 18) {
                  logChopped = true;
                  gameScore = 1;
                } else {
                  gameOver = true;
                  gameScore = -1;
                }
              }
            }
            
            ctx.fillStyle = '#bbb';
            ctx.fillRect(138, axeY, 4, 20);
            ctx.fillStyle = '#777';
            ctx.fillRect(133, axeY + 16, 14, 6);
            
          } else if (subgame === 'fruit_shoot') {
            if (!gameOver && !fruitHit) {
              fruitX += fruitDir * 110 * 0.016;
              if (fruitX > 250) {
                fruitX = 250;
                fruitDir = -1;
              } else if (fruitX < 30) {
                fruitX = 30;
                fruitDir = 1;
              }
            }
            
            if (!arrowFired) {
              shootAngle += shootAngleDir * 2.5 * 0.016;
              if (shootAngle > 0.8) {
                shootAngle = 0.8;
                shootAngleDir = -1;
              } else if (shootAngle < -0.8) {
                shootAngle = -0.8;
                shootAngleDir = 1;
              }
            } else {
              arrowX += Math.sin(shootAngle) * 320 * 0.016;
              arrowY -= Math.cos(shootAngle) * 320 * 0.016;
              
              const dx = arrowX - fruitX;
              const dy = arrowY - 40;
              if (Math.sqrt(dx*dx + dy*dy) < 15) {
                fruitHit = true;
                gameScore = 1;
              }
              
              if (arrowY < -20) {
                gameOver = true;
                gameScore = -1;
              }
            }
            
            ctx.fillStyle = fruitHit ? '#ffe0b2' : '#ff0000';
            ctx.beginPath();
            ctx.arc(fruitX, 40, 10, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#8d6e63';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(fruitX, 30);
            ctx.lineTo(fruitX + 3, 24);
            ctx.stroke();
            ctx.lineWidth = 1;
            
            ctx.save();
            ctx.translate(140, 145);
            ctx.rotate(shootAngle);
            
            ctx.strokeStyle = '#bbb';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -18);
            ctx.stroke();
            ctx.lineWidth = 1;
            
            ctx.strokeStyle = '#ffa726';
            ctx.beginPath();
            ctx.arc(0, 5, 12, Math.PI, 0);
            ctx.stroke();
            ctx.restore();
            
          } else if (subgame === 'batter_up') {
            if (!gameOver && !batterHit) {
              const progress = elapsed / 2200;
              ballX = 140;
              ballY = 40 + progress * 80;
              ballRadius = 1 + progress * 9;
              
              if (ballY > 140) {
                gameOver = true;
                gameScore = -1;
              }
            }
            
            ctx.strokeStyle = '#39ff14';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(140, 120, 12, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 1;
            
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#8d6e63';
            ctx.lineWidth = 4;
            ctx.save();
            ctx.translate(140, 120);
            if (batterSwung) {
              ctx.rotate(Math.PI / 4);
            } else {
              ctx.rotate(-Math.PI / 3);
            }
            ctx.beginPath();
            ctx.moveTo(-10, 0);
            ctx.lineTo(16, 0);
            ctx.stroke();
            ctx.restore();
            ctx.lineWidth = 1;
            
          } else if (subgame === 'heads_up') {
            if (!gameOver) {
              if (this.inputHandler && (this.inputHandler.keys['arrowleft'] || this.inputHandler.keys['a'])) {
                catchPlayerX = Math.max(30, catchPlayerX - 160 * 0.016);
              }
              if (this.inputHandler && (this.inputHandler.keys['arrowright'] || this.inputHandler.keys['d'])) {
                catchPlayerX = Math.min(250, catchPlayerX + 160 * 0.016);
              }
              
              wingY += wingVy * 0.016;
              
              if (wingY >= 130) {
                if (Math.abs(wingX - catchPlayerX) < 18) {
                  gameScore = 1;
                } else {
                  gameOver = true;
                  gameScore = -1;
                }
              }
            }
            
            ctx.fillStyle = '#ffa726';
            ctx.fillRect(catchPlayerX - 15, 130, 30, 6);
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(catchPlayerX - 4, 136, 8, 10);
            
            ctx.fillStyle = '#ff5722';
            ctx.beginPath();
            ctx.arc(wingX, wingY, 6, 0, Math.PI * 2);
            ctx.fill();
            
          } else if (subgame === 'boing') {
            if (!gameOver) {
              if (this.inputHandler && (this.inputHandler.keys['arrowleft'] || this.inputHandler.keys['a'])) {
                trampX = Math.max(35, trampX - 180 * 0.016);
              }
              if (this.inputHandler && (this.inputHandler.keys['arrowright'] || this.inputHandler.keys['d'])) {
                trampX = Math.min(245, trampX + 180 * 0.016);
              }
              
              jumperY += jumperVy * 0.016;
              jumperVy += 400 * 0.016;
              jumperX += jumperVx * 0.016;
              
              if (jumperX > 260) {
                jumperX = 260;
                jumperVx = -Math.abs(jumperVx);
              } else if (jumperX < 20) {
                jumperX = 20;
                jumperVx = Math.abs(jumperVx);
              }
              
              if (jumperY >= 120 && jumperVy > 0) {
                if (Math.abs(jumperX - trampX) < 25) {
                  jumperY = 120;
                  jumperVy = -220;
                  jumperBounces++;
                  window.Casino.SoundManager.playBeep();
                  if (jumperBounces >= 2) {
                    gameScore = 1;
                  }
                } else {
                  gameOver = true;
                  gameScore = -1;
                }
              }
            }
            
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(trampX - 25, 126);
            ctx.lineTo(trampX + 25, 126);
            ctx.stroke();
            ctx.lineWidth = 1;
            
            ctx.fillStyle = '#39ff14';
            ctx.beginPath();
            ctx.arc(jumperX, jumperY, 6, 0, Math.PI * 2);
            ctx.fill();
            
          } else if (subgame === 'spare_me') {
            if (!gameOver) {
              if (!bowlBallFired) {
                pinAngle += pinAngleDir * 3 * 0.016;
                if (pinAngle > 0.8) {
                  pinAngle = 0.8;
                  pinAngleDir = -1;
                } else if (pinAngle < -0.8) {
                  pinAngle = -0.8;
                  pinAngleDir = 1;
                }
              } else {
                bowlBallY -= 200 * 0.016;
                bowlBallX += Math.sin(pinAngle) * 200 * 0.016;
                
                if (bowlBallY <= 40) {
                  if (Math.abs(bowlBallX - 140) < 14) {
                    gameScore = 1;
                  } else {
                    gameOver = true;
                    gameScore = -1;
                  }
                }
              }
            }
            
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(130, 36, 4, 0, Math.PI * 2);
            ctx.arc(140, 36, 4, 0, Math.PI * 2);
            ctx.arc(150, 36, 4, 0, Math.PI * 2);
            ctx.fill();
            
            if (!bowlBallFired) {
              ctx.strokeStyle = 'rgba(255,255,255,0.15)';
              ctx.beginPath();
              ctx.moveTo(140, 130);
              ctx.lineTo(140 + Math.sin(pinAngle) * 80, 130 - Math.cos(pinAngle) * 80);
              ctx.stroke();
            }
            
            ctx.fillStyle = '#9c27b0';
            ctx.beginPath();
            ctx.arc(bowlBallX, bowlBallY, 8, 0, Math.PI * 2);
            ctx.fill();
            
          } else if (subgame === 'baseline_bash') {
            if (!gameOver && !playerHit) {
              const progress = elapsed / 2200;
              tennisBallX = 140;
              tennisBallY = 30 + progress * 90;
              tennisBallRadius = 1 + progress * 8;
              
              if (tennisBallY > 140) {
                gameOver = true;
                gameScore = -1;
              }
            }
            
            ctx.fillStyle = 'rgba(57, 255, 20, 0.2)';
            ctx.fillRect(80, 110, 120, 15);
            ctx.strokeStyle = '#39ff14';
            ctx.strokeRect(80, 110, 120, 15);
            
            ctx.fillStyle = '#ccff00';
            ctx.beginPath();
            ctx.arc(tennisBallX, tennisBallY, tennisBallRadius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(140, 125);
            if (playerSwung) {
              ctx.lineTo(165, 110);
            } else {
              ctx.lineTo(115, 135);
            }
            ctx.stroke();
            ctx.lineWidth = 1;
            
          } else if (subgame === 'butterfly_stroke') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.moveTo(0, 50); ctx.lineTo(280, 50);
            ctx.moveTo(0, 110); ctx.lineTo(280, 110);
            ctx.stroke();
            
            ctx.fillStyle = '#ff007f';
            ctx.fillRect(250, 40, 10, 80);
            
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(swimX, 75, 18, 10);
            ctx.fillStyle = '#ffe0bd';
            ctx.beginPath();
            ctx.arc(swimX + 18, 80, 5, 0, Math.PI * 2);
            ctx.fill();
            
            if (swimX >= 232) {
              gameScore = 1;
            }
            
          } else if (subgame === 'hammer_toss') {
            if (!hammerReleased) {
              hammerAngle += 6 * 0.016;
            }
            
            ctx.beginPath();
            ctx.moveTo(140, 80);
            ctx.arc(140, 80, 45, hammerTargetAngleStart, hammerTargetAngleEnd);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 170, 0, 0.4)';
            ctx.fill();
            
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(140, 80, 10, 0, Math.PI * 2);
            ctx.fill();
            
            const hx = 140 + Math.cos(hammerAngle) * 35;
            const hy = 80 + Math.sin(hammerAngle) * 35;
            ctx.strokeStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(140, 80);
            ctx.lineTo(hx, hy);
            ctx.stroke();
            
            ctx.fillStyle = '#ff007f';
            ctx.beginPath();
            ctx.arc(hx, hy, 4, 0, Math.PI * 2);
            ctx.fill();
            
          } else if (subgame === 'balancing_act') {
            if (!gameOver) {
              if (this.inputHandler && (this.inputHandler.keys['arrowleft'] || this.inputHandler.keys['a'])) {
                balanceAngle -= 0.04;
              }
              if (this.inputHandler && (this.inputHandler.keys['arrowright'] || this.inputHandler.keys['d'])) {
                balanceAngle += 0.04;
              }
              
              balanceAngle += (Math.random() - 0.5) * 0.02 + Math.sign(balanceAngle) * balanceDrift * 0.016;
              balanceDrift += 0.05 * 0.016;
              
              if (Math.abs(balanceAngle) > 0.6) {
                gameOver = true;
                gameScore = -1;
              }
            }
            
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(140, 130, 8, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.save();
            ctx.translate(140, 122);
            ctx.rotate(balanceAngle);
            
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -60);
            ctx.stroke();
            
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(-15, -70, 30, 10);
            ctx.fillStyle = '#ff007f';
            ctx.fillRect(-10, -80, 20, 10);
            ctx.restore();
            ctx.lineWidth = 1;
            
          } else if (subgame === 'putt_for_dough') {
            if (!puttFired) {
              powerMeterVal += powerMeterDir * 160 * 0.016;
              if (powerMeterVal > 100) {
                powerMeterVal = 100;
                powerMeterDir = -1;
              } else if (powerMeterVal < 0) {
                powerMeterVal = 0;
                powerMeterDir = 1;
              }
            } else {
              golfBallX += 160 * 0.016;
              if (golfBallX >= 220) {
                golfBallX = 220;
                if (golfPuttSuccess) {
                  gameScore = 1;
                } else {
                  gameOver = true;
                  gameScore = -1;
                }
              }
            }
            
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(220, 110, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(golfBallX, 110, 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#222';
            ctx.fillRect(40, 40, 200, 12);
            
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(40 + 140, 40, 30, 12);
            
            ctx.fillStyle = '#ff007f';
            ctx.fillRect(40 + powerMeterVal * 2 - 2, 38, 4, 16);
            
          } else if (subgame === 'ski_jump') {
            if (!gameOver && !skierJumped) {
              skierX += 90 * 0.016;
              skierY += 50 * 0.016;
              
              if (skierX > 180) {
                gameOver = true;
                gameScore = -1;
              }
            } else if (skierJumped) {
              skierX += 120 * 0.016;
              skierY -= 15 * 0.016;
              if (skierX >= 260) {
                gameScore = 1;
              }
            }
            
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(10, 20);
            ctx.lineTo(160, 100);
            ctx.lineTo(180, 100);
            ctx.stroke();
            ctx.lineWidth = 1;
            
            ctx.fillStyle = 'rgba(57,255,20,0.3)';
            ctx.fillRect(160, 96, 20, 8);
            
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(skierX - 4, skierY - 10, 8, 10);
            ctx.fillStyle = '#ff007f';
            ctx.fillRect(skierX - 8, skierY, 16, 2);
            
          } else if (subgame === 'mountain_mountin') {
            if (!gameOver) {
              if (this.inputHandler && (this.inputHandler.keys['arrowleft'] || this.inputHandler.keys['a'])) {
                mountPlayerX = Math.max(30, mountPlayerX - 160 * 0.016);
              }
              if (this.inputHandler && (this.inputHandler.keys['arrowright'] || this.inputHandler.keys['d'])) {
                mountPlayerX = Math.min(250, mountPlayerX + 160 * 0.016);
              }
              
              mountPlayerVy += 500 * 0.016;
              mountPlayerY += mountPlayerVy * 0.016;
              
              clouds.forEach(cloud => {
                if (mountPlayerVy > 0 &&
                    Math.abs(mountPlayerY - cloud.y) < 6 &&
                    mountPlayerX >= cloud.x && mountPlayerX <= cloud.x + cloud.w) {
                  mountPlayerY = cloud.y;
                  mountPlayerVy = -250;
                  window.Casino.SoundManager.playBeep();
                }
              });
              
              if (mountPlayerY < 35) {
                gameScore = 1;
              }
              
              if (mountPlayerY > 165) {
                gameOver = true;
                gameScore = -1;
              }
            }
            
            ctx.fillStyle = '#fff';
            clouds.forEach(c => {
              ctx.beginPath();
              ctx.arc(c.x + 8, c.y, 10, 0, Math.PI * 2);
              ctx.arc(c.x + 20, c.y - 4, 12, 0, Math.PI * 2);
              ctx.arc(c.x + 32, c.y, 10, 0, Math.PI * 2);
              ctx.fill();
            });
            
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(mountPlayerX - 5, mountPlayerY - 12, 10, 12);
            
          } else if (subgame === 'guy_scraper') {
            if (!gameOver) {
              if (!guyDropped) {
                guyX += 130 * 0.016;
                if (guyX > 250) {
                  guyX = 250;
                  guyDropped = true;
                }
              } else {
                guyY += 210 * 0.016;
                if (guyY >= 120) {
                  if (Math.abs(guyX - buildingX) < 22) {
                    gameScore = 1;
                  } else {
                    gameOver = true;
                    gameScore = -1;
                  }
                }
              }
              
              buildingX += buildingDir * 90 * 0.016;
              if (buildingX > 200) {
                buildingX = 200;
                buildingDir = -1;
              } else if (buildingX < 40) {
                buildingX = 40;
                buildingDir = 1;
              }
            }
            
            ctx.fillStyle = '#455a64';
            ctx.fillRect(buildingX - 20, 130, 40, 30);
            ctx.fillStyle = '#ffeb3b';
            ctx.fillRect(buildingX - 10, 135, 6, 6);
            ctx.fillRect(buildingX + 4, 135, 6, 6);
            
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(guyX - 5, guyY - 12, 10, 12);
            
          } else if (subgame === 'space_fighter') {
            if (!gameOver && !crosshairLocked) {
              targetX += targetVx * 0.016;
              targetY += targetVy * 0.016;
              
              if (targetX > 240 || targetX < 40) targetVx = -targetVx;
              if (targetY > 110 || targetY < 30) targetVy = -targetVy;
            }
            
            ctx.fillStyle = '#ff007f';
            ctx.fillRect(140 - 15, 70, 30, 10);
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(140 - 5, 66, 10, 4);
            
            ctx.strokeStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(targetX, targetY, 12, 0, Math.PI * 2);
            ctx.moveTo(targetX - 18, targetY); ctx.lineTo(targetX + 18, targetY);
            ctx.moveTo(targetX, targetY - 18); ctx.lineTo(targetX, targetY + 18);
            ctx.stroke();
            
          } else if (subgame === 'ninja_pipe_cleaner') {
            if (!gameOver) {
              if (now > nextNinjaSpawn && ninjaIncoming.length < 1) {
                const dir = Math.random() < 0.4 ? 'left' : (Math.random() < 0.8 ? 'right' : 'up');
                ninjaIncoming.push({
                  dir: dir,
                  dist: 130,
                  speed: 75
                });
                nextNinjaSpawn = now + 900 + Math.random() * 500;
              }
              
              ninjaIncoming.forEach(ninja => {
                ninja.dist -= ninja.speed * 0.016;
                if (ninja.dist <= 15) {
                  gameOver = true;
                  gameScore = -1;
                }
              });
            }
            
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(140 - 8, 80 - 8, 16, 16);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(140 - 8, 80 - 8, 16, 16);
            
            ninjaIncoming.forEach(ninja => {
              let nx = 140;
              let ny = 80;
              if (ninja.dir === 'left') nx = 140 - ninja.dist;
              else if (ninja.dir === 'right') nx = 140 + ninja.dist;
              else if (ninja.dir === 'up') ny = 80 - ninja.dist;
              
              ctx.fillStyle = '#ff0000';
              ctx.beginPath();
              ctx.arc(nx, ny, 6, 0, Math.PI * 2);
              ctx.fill();
            });
            
          } else if (subgame === 'bam_fu') {
            if (!gameOver && !bamChopped) {
              bamItemX += 130 * 0.016;
              if (bamItemX > 290) {
                if (bamItemType === 'raccoon') {
                  bamItemX = -30;
                  bamItemType = Math.random() < 0.65 ? 'wood' : 'raccoon';
                } else {
                  gameOver = true;
                  gameScore = -1;
                }
              }
            }
            
            ctx.strokeStyle = '#ff007f';
            ctx.beginPath();
            ctx.moveTo(140, 50); ctx.lineTo(140, 130);
            ctx.stroke();
            
            if (bamItemType === 'wood') {
              ctx.fillStyle = '#8d6e63';
              ctx.fillRect(bamItemX - 10, 95, 20, 20);
            } else {
              ctx.fillStyle = '#757575';
              ctx.fillRect(bamItemX - 10, 95, 20, 20);
              ctx.fillStyle = '#000';
              ctx.fillRect(bamItemX - 8, 91, 4, 4);
              ctx.fillRect(bamItemX + 4, 91, 4, 4);
            }
            
            if (bamAxeChopped && bamAxeY < 95) {
              bamAxeY += 600 * 0.016;
              if (bamAxeY >= 95) {
                bamAxeY = 95;
                if (Math.abs(bamItemX - 140) < 16) {
                  if (bamItemType === 'wood') {
                    gameScore = 1;
                  } else {
                    gameOver = true;
                    gameScore = -1;
                  }
                } else {
                  gameOver = true;
                  gameScore = -1;
                }
              }
            }
            
            ctx.fillStyle = '#ffea00';
            ctx.fillRect(135, bamAxeY, 10, 14);
          }
          
          if (elapsed >= totalDuration) {
            cleanUp();
            if (gameScore > 0 || (['dodge_balls', 'balancing_act'].includes(subgame) && !gameOver)) {
              window.Casino.SoundManager.playWin();
              successCallback();
            } else {
              window.Casino.SoundManager.playLose();
              if (failureCallback) {
                failureCallback();
              } else {
                this.showNotification("Time ran out! Microgame Failed.", "error");
              }
            }
          } else if (gameOver) {
            cleanUp();
            window.Casino.SoundManager.playLose();
            if (failureCallback) {
              failureCallback();
            } else {
              this.showNotification("Failed the microgame check!", "error");
            }
          } else if (gameScore > 0 && !['crazy_cars', 'log_chop', 'fruit_shoot', 'spare_me', 'butterfly_stroke', 'putt_for_dough', 'ski_jump', 'guy_scraper', 'bam_fu'].includes(subgame)) {
            cleanUp();
            window.Casino.SoundManager.playWin();
            successCallback();
          } else {
            animId = requestAnimationFrame(tick);
          }
        };
        animId = requestAnimationFrame(tick);
        
        cleanUp = () => {
          active = false;
          cancelAnimationFrame(animId);
          container.classList.add('hidden');
          microgameWrap.classList.add('hidden');
          window.removeEventListener('keydown', handleInput);
          canvas.removeEventListener('click', triggerClick);
          this.isInQTE = false;
          if (this.inputHandler) this.inputHandler.keys = {};
        };
        
        const triggerAction = () => {
          if (gameOver || gameScore > 0) return;
          window.Casino.SoundManager.playBeep();
          
          if (subgame === 'parry') {
            if (parryRingRadius >= parryWindowMin && parryRingRadius <= parryWindowMax) {
              gameScore = 1;
              parFlashed = 15;
            } else {
              gameOver = true;
              gameScore = -1;
            }
          } else if (subgame === 'crazy_cars') {
            if (playerY === 120) {
              playerVy = -270;
            }
          } else if (subgame === 'wario_whirled') {
            wheelStopped = true;
            const norm = ((wheelAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            const targetCenter = 1.5 * Math.PI;
            const diff = Math.abs(norm - targetCenter);
            const wrappedDiff = Math.min(diff, 2 * Math.PI - diff);
            if (wrappedDiff <= 0.5) {
              gameScore = 1;
            } else {
              gameOver = true;
              gameScore = -1;
            }
          } else if (subgame === 'diamond_dig') {
            digCount++;
            if (digCount >= digRequired) {
              gameScore = 1;
            }
          } else if (subgame === 'log_chop') {
            axeChopped = true;
          } else if (subgame === 'fruit_shoot') {
            if (!arrowFired) {
              arrowFired = true;
              arrowX = 140;
              arrowY = 140;
            }
          } else if (subgame === 'batter_up') {
            batterSwung = true;
            if (ballY >= 108 && ballY <= 132) {
              batterHit = true;
              gameScore = 1;
            } else {
              gameOver = true;
              gameScore = -1;
            }
          } else if (subgame === 'heads_up') {
            // Steering A/D
          } else if (subgame === 'boing') {
            // Trampoline A/D
          } else if (subgame === 'spare_me') {
            if (!bowlBallFired) {
              bowlBallFired = true;
            }
          } else if (subgame === 'baseline_bash') {
            playerSwung = true;
            if (tennisBallY >= 110 && tennisBallY <= 125) {
              playerHit = true;
              gameScore = 1;
            } else {
              gameOver = true;
              gameScore = -1;
            }
          } else if (subgame === 'butterfly_stroke') {
            swimX += 22;
          } else if (subgame === 'hammer_toss') {
            hammerReleased = true;
            const norm = ((hammerAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            if (norm >= hammerTargetAngleStart && norm <= hammerTargetAngleEnd) {
              gameScore = 1;
            } else {
              gameOver = true;
              gameScore = -1;
            }
          } else if (subgame === 'balancing_act') {
            // Balance A/D
          } else if (subgame === 'putt_for_dough') {
            if (!puttFired) {
              puttFired = true;
              if (powerMeterVal >= 70 && powerMeterVal <= 85) {
                golfPuttSuccess = true;
              }
            }
          } else if (subgame === 'ski_jump') {
            if (!skierJumped) {
              if (skierX >= 155 && skierX <= 180) {
                skierJumped = true;
              } else {
                gameOver = true;
                gameScore = -1;
              }
            }
          } else if (subgame === 'mountain_mountin') {
            // Cloud jumper A/D
          } else if (subgame === 'guy_scraper') {
            if (!guyDropped) {
              guyDropped = true;
            }
          } else if (subgame === 'space_fighter') {
            if (Math.abs(targetX - 140) < 18 && Math.abs(targetY - 75) < 18) {
              crosshairLocked = true;
              gameScore = 1;
            } else {
              gameOver = true;
              gameScore = -1;
            }
          } else if (subgame === 'ninja_pipe_cleaner') {
            if (ninjaIncoming.length > 0) {
              const targetNinja = ninjaIncoming[0];
              if (targetNinja.dist <= 40) {
                ninjaIncoming.shift();
                ninjaKills++;
                if (ninjaKills >= ninjaRequired) {
                  gameScore = 1;
                }
              }
            }
          } else if (subgame === 'bam_fu') {
            bamAxeChopped = true;
          }
        };
        
        const handleInput = (e) => {
          const key = e.key.toLowerCase();
          
          if (subgame === 'ninja_pipe_cleaner' && ['arrowleft', 'arrowright', 'arrowup', 'a', 'd', 'w'].includes(key)) {
            e.preventDefault();
            e.stopPropagation();
            if (ninjaIncoming.length > 0) {
              const targetNinja = ninjaIncoming[0];
              const matchedDir = (key === 'arrowleft' || key === 'a') && targetNinja.dir === 'left' ||
                                 (key === 'arrowright' || key === 'd') && targetNinja.dir === 'right' ||
                                 (key === 'arrowup' || key === 'w') && targetNinja.dir === 'up';
              if (matchedDir && targetNinja.dist <= 40) {
                window.Casino.SoundManager.playBeep();
                ninjaIncoming.shift();
                ninjaKills++;
                if (ninjaKills >= ninjaRequired) {
                  gameScore = 1;
                }
              }
            }
            return;
          }
          
          if (key === ' ' || key === 'e') {
            e.preventDefault();
            e.stopPropagation();
            triggerAction();
          }
        };
        
        const triggerClick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          triggerAction();
        };
        
        window.addEventListener('keydown', handleInput);
        canvas.addEventListener('click', triggerClick);
      }
    }

    handleCellClick(gridX, gridY) {
      if (this.isInMinigame || this.isInQTE) return;

      if (this.buildModeItem) {
        // Send place object command to simulator
        this.sendAction(window.Casino.Protocol.Commands.PLACE_OBJECT, {
          type: this.buildModeItem,
          gridX: gridX,
          gridY: gridY
        });
        // Return to select mode by default after placement
        this.buildModeItem = null;
        const btnSelect = document.getElementById('btn-select');
        if (btnSelect) {
          document.querySelectorAll('.build-btn, .action-btn').forEach(btn => {
            btn.classList.remove('active');
          });
          btnSelect.classList.add('active');
        }
      } else if (this.moveModeItem) {
        // Send move object command to simulator
        this.sendAction(window.Casino.Protocol.Commands.MOVE_OBJECT, {
          objectId: this.moveModeItem.id,
          gridX: gridX,
          gridY: gridY
        });
        this.moveModeItem = null;
      } else {
        // Select mode: Check if click is on a character (Guest or Employee) first
        let clickedChar = null;
        let charRole = '';
        
        // Check guests: round coords to nearest cell
        if (this.state.guests) {
          const matchedGuest = Object.values(this.state.guests).find(g => Math.round(g.gridX) === gridX && Math.round(g.gridY) === gridY);
          if (matchedGuest) {
            clickedChar = matchedGuest;
            charRole = 'guest';
          }
        }
        
        // Check employees
        if (!clickedChar && this.state.employees) {
          const matchedEmp = Object.values(this.state.employees).find(emp => Math.round(emp.gridX) === gridX && Math.round(emp.gridY) === gridY);
          if (matchedEmp) {
            clickedChar = matchedEmp;
            charRole = matchedEmp.role === 'dealer' ? 'Dealer' : 'Waitress';
          }
        }

        if (clickedChar) {
          this.showCharacterDetailsDialog(clickedChar, charRole);
          return;
        }

        // Select mode: Click to see details or manage table upgrades
        const obj = this.getObjectAt(gridX, gridY);
        if (obj) {
          this.showTableUpgradeDialog(obj);
        } else {
          if (window.isMobile) {
            this.movePlayerTo(gridX, gridY);
          }
        }
      }
    }

    movePlayerTo(targetX, targetY) {
      const localPlayer = this.state.players[this.playerId];
      if (!localPlayer) return;

      const cols = this.state.grid.cols;
      const rows = this.state.grid.rows;
      const entranceX = Math.floor(cols / 2);

      const Catalog = window.Casino.GameObjects.Catalog;

      // Mock GridManager interface for Pathfinding A* library
      const clientGridManager = {
        cols: cols,
        rows: rows,
        entranceX: entranceX,
        isCellWalkable: (x, y) => {
          if (x < 0 || x >= cols || y < 0 || y >= rows) return false;
          if (y === 0 || x === 0 || x === cols - 1) return false;
          if (y === rows - 1 && Math.abs(x - entranceX) > 1) return false;

          for (const obj of this.state.grid.objects) {
            const template = Catalog[obj.type];
            if (!template) continue;
            if (x >= obj.gridX && x < obj.gridX + template.width && y >= obj.gridY && y < obj.gridY + template.height) {
              return false;
            }
          }
          return true;
        }
      };

      const path = window.Casino.Pathfinding.findPath(
        clientGridManager,
        localPlayer.gridX,
        localPlayer.gridY,
        targetX,
        targetY,
        false
      );

      if (path && path.length > 0) {
        if (this.playerMoveInterval) {
          clearInterval(this.playerMoveInterval);
        }

        let stepIndex = 0;
        this.playerMoveInterval = setInterval(() => {
          if (stepIndex >= path.length || this.isInMinigame || this.isInQTE) {
            clearInterval(this.playerMoveInterval);
            this.playerMoveInterval = null;
            return;
          }

          const nextStep = path[stepIndex];
          this.sendAction(window.Casino.Protocol.Commands.MOVE_PLAYER, {
            x: nextStep.x,
            y: nextStep.y
          });
          stepIndex++;
        }, 150);
      }
    }

    showCharacterDetailsDialog(char, role) {
      const modal = document.getElementById('character-details-modal');
      if (!modal) return;

      document.getElementById('char-name').innerText = char.name || (role + ' #' + char.id.replace('employee_', '').replace('guest_', ''));
      document.getElementById('char-role').innerText = role.toUpperCase();
      document.getElementById('char-state').innerText = char.state;

      const budgetLabel = document.getElementById('char-budget-label');
      const budgetVal = document.getElementById('char-budget');
      if (role === 'guest') {
        budgetLabel.innerText = 'Budget:';
        budgetVal.innerText = `${char.budget} Chips`;
        budgetVal.style.color = '#00ff66';
      } else {
        budgetLabel.innerText = 'Wage:';
        budgetVal.innerText = role === 'Dealer' ? '10 Chips/min' : '15 Chips/min';
        budgetVal.style.color = '#ffaa00';
      }

      // Update need bars
      const thirstBar = document.getElementById('need-bar-thirst');
      const thirstVal = document.getElementById('need-val-thirst');
      const hungerBar = document.getElementById('need-bar-hunger');
      const hungerVal = document.getElementById('need-val-hunger');
      const bioBar = document.getElementById('need-bar-bio');
      const bioVal = document.getElementById('need-val-bio');
      
      const entRow = document.getElementById('char-entertainment-row');
      const entBar = document.getElementById('need-bar-entertainment');
      const entVal = document.getElementById('need-val-entertainment');

      const thirst = char.needs ? Math.floor(char.needs.thirst) : 100;
      const hunger = char.needs ? Math.floor(char.needs.hunger) : 100;
      const bio = char.needs ? Math.floor(char.needs.bio) : 100;
      const entertainment = (char.needs && char.needs.entertainment !== undefined) ? Math.floor(char.needs.entertainment) : 100;

      thirstBar.style.width = thirst + '%';
      thirstVal.innerText = thirst + '%';
      hungerBar.style.width = hunger + '%';
      hungerVal.innerText = hunger + '%';
      bioBar.style.width = bio + '%';
      bioVal.innerText = bio + '%';

      if (role === 'guest') {
        if (entRow) entRow.style.display = 'flex';
        if (entBar) entBar.style.width = entertainment + '%';
        if (entVal) entVal.innerText = entertainment + '%';
      } else {
        if (entRow) entRow.style.display = 'none';
      }

      // Employee upgrades section
      const upgradesSection = document.getElementById('char-upgrades-section');
      if (upgradesSection) {
        if (role !== 'guest' && role !== 'pickpocket') {
          upgradesSection.style.display = 'flex';
          
          const speedLvl = char.speedLvl || 1;
          const capacityLvl = char.capacityLvl || 1;
          const needsLvl = char.needsLvl || 1;
          
          document.getElementById('char-lvl-speed').innerText = speedLvl;
          document.getElementById('char-lvl-capacity').innerText = capacityLvl;
          document.getElementById('char-lvl-needs').innerText = needsLvl;
          
          const speedCost = speedLvl >= 5 ? 'MAX' : (200 * speedLvl) + 'c';
          const capacityCost = capacityLvl >= 5 ? 'MAX' : (300 * capacityLvl) + 'c';
          const needsCost = needsLvl >= 5 ? 'MAX' : (150 * needsLvl) + 'c';
          
          document.getElementById('char-cost-speed').innerText = speedCost;
          document.getElementById('char-cost-capacity').innerText = capacityCost;
          document.getElementById('char-cost-needs').innerText = needsCost;
          
          // Re-bind click event handlers safely
          const replaceBtn = (id) => {
            const oldEl = document.getElementById(id);
            if (!oldEl) return null;
            const newEl = oldEl.cloneNode(true);
            oldEl.parentNode.replaceChild(newEl, oldEl);
            return newEl;
          };
          
          const btnSpeed = replaceBtn('btn-upgrade-speed');
          const btnCapacity = replaceBtn('btn-upgrade-capacity');
          const btnNeeds = replaceBtn('btn-upgrade-needs');
          
          if (btnSpeed && speedLvl < 5) {
            btnSpeed.disabled = false;
            btnSpeed.onclick = () => {
              const cost = 200 * speedLvl;
              if (this.chips < cost) {
                this.showNotification("Cannot afford speed upgrade!", "error");
                return;
              }
              this.sendAction(window.Casino.Protocol.Commands.UPGRADE_EMPLOYEE, {
                employeeId: char.id,
                upgradeType: 'speed'
              });
              modal.classList.add('hidden');
            };
          } else if (btnSpeed) {
            btnSpeed.disabled = true;
          }
          
          if (btnCapacity && capacityLvl < 5) {
            btnCapacity.disabled = false;
            btnCapacity.onclick = () => {
              const cost = 300 * capacityLvl;
              if (this.chips < cost) {
                this.showNotification("Cannot afford carry upgrade!", "error");
                return;
              }
              this.sendAction(window.Casino.Protocol.Commands.UPGRADE_EMPLOYEE, {
                employeeId: char.id,
                upgradeType: 'capacity'
              });
              modal.classList.add('hidden');
            };
          } else if (btnCapacity) {
            btnCapacity.disabled = true;
          }
          
          if (btnNeeds && needsLvl < 5) {
            btnNeeds.disabled = false;
            btnNeeds.onclick = () => {
              const cost = 150 * needsLvl;
              if (this.chips < cost) {
                this.showNotification("Cannot afford needs upgrade!", "error");
                return;
              }
              this.sendAction(window.Casino.Protocol.Commands.UPGRADE_EMPLOYEE, {
                employeeId: char.id,
                upgradeType: 'needs'
              });
              modal.classList.add('hidden');
            };
          } else if (btnNeeds) {
            btnNeeds.disabled = true;
          }

          const btnBreak = replaceBtn('btn-employee-break');
          if (btnBreak) {
            btnBreak.disabled = !!char.isOnBreak;
            btnBreak.innerText = char.isOnBreak ? '☕ On Break' : '☕ Send on Break';
            btnBreak.onclick = () => {
              this.sendAction(window.Casino.Protocol.Commands.SEND_EMPLOYEE_BREAK, {
                employeeId: char.id
              });
              this.showNotification(`Sent ${role} on break.`, "success");
              modal.classList.add('hidden');
            };
          }
        } else {
          upgradesSection.style.display = 'none';
        }
      }

      modal.classList.remove('hidden');
    }

    showTableUpgradeDialog(obj) {
      const dialog = document.getElementById('table-upgrade-dialog');
      if (!dialog) return;

      const Catalog = window.Casino.GameObjects.Catalog;
      const template = Catalog[obj.type];
      if (!template) return;

      if (!obj.upgradesCount) {
        obj.upgradesCount = { capacity: 0, income: 0 };
      }

      // Upgrade calculations matching server
      const capCost = Math.max(150, Math.floor(template.cost * 0.4)) + obj.upgradesCount.capacity * 100;
      const incCost = Math.max(100, Math.floor(template.cost * 0.3)) + obj.upgradesCount.income * 100;
      
      let totalValue = template.cost;
      const baseCapCost = Math.max(150, Math.floor(template.cost * 0.4));
      const baseIncCost = Math.max(100, Math.floor(template.cost * 0.3));
      for (let i = 0; i < obj.upgradesCount.capacity; i++) {
        totalValue += baseCapCost + i * 100;
      }
      for (let i = 0; i < obj.upgradesCount.income; i++) {
        totalValue += baseIncCost + i * 100;
      }
      const refund = Math.floor(totalValue * 0.5);

      // Populate layout text
      document.getElementById('upgrade-dialog-title').innerText = `${obj.icon} Manage: ${obj.name}`;
      
      const seatRow = document.getElementById('upgrade-seat-row');
      const incomeRow = document.getElementById('upgrade-income-row');
      
      if (template.guestCapacity === 0 && template.tickIncome === 0) {
        if (seatRow) seatRow.style.display = 'none';
        if (incomeRow) incomeRow.style.display = 'none';
        document.getElementById('upgrade-dialog-desc').innerText = `Decorations cannot be upgraded. You can relocate or sell this item.`;
      } else {
        if (seatRow) seatRow.style.display = 'flex';
        if (incomeRow) incomeRow.style.display = 'flex';
        document.getElementById('upgrade-dialog-desc').innerText = `Manage seats and profit limits for this object.`;
        
        document.getElementById('upgrade-seat-count').innerText = `${obj.guestCapacity} seats`;
        document.getElementById('upgrade-seat-cost').innerText = `${capCost.toLocaleString()} Chips`;

        document.getElementById('upgrade-income-val').innerText = `${obj.tickIncome} Chips`;
        document.getElementById('upgrade-income-cost').innerText = `${incCost.toLocaleString()} Chips`;
      }

      const sellBtn = document.getElementById('upgrade-sell-btn');
      sellBtn.innerText = `Sell (+${refund.toLocaleString()})`;

      // Safely rebuild element events (avoiding multiple bindings)
      const replaceBtn = (id) => {
        const oldEl = document.getElementById(id);
        if (!oldEl) return null;
        const newEl = oldEl.cloneNode(true);
        oldEl.parentNode.replaceChild(newEl, oldEl);
        return newEl;
      };

      const btnClose = replaceBtn('upgrade-close-btn');
      const btnSeat = replaceBtn('upgrade-seat-btn');
      const btnIncome = replaceBtn('upgrade-income-btn');
      const btnMove = replaceBtn('upgrade-move-btn');
      const btnSell = replaceBtn('upgrade-sell-btn');

      if (btnClose) {
        btnClose.addEventListener('click', () => {
          dialog.classList.add('hidden');
        });
      }

      if (btnSeat) {
        btnSeat.addEventListener('click', () => {
          if (this.chips < capCost) {
            this.showNotification("Cannot afford capacity upgrade!", "error");
            return;
          }
          this.sendAction(window.Casino.Protocol.Commands.UPGRADE_OBJECT, {
            objectId: obj.id,
            upgradeType: 'capacity'
          });
          dialog.classList.add('hidden');
        });
      }

      if (btnIncome) {
        btnIncome.addEventListener('click', () => {
          if (this.chips < incCost) {
            this.showNotification("Cannot afford limit upgrade!", "error");
            return;
          }
          this.sendAction(window.Casino.Protocol.Commands.UPGRADE_OBJECT, {
            objectId: obj.id,
            upgradeType: 'income'
          });
          dialog.classList.add('hidden');
        });
      }

      if (btnMove) {
        btnMove.addEventListener('click', () => {
          this.moveModeItem = obj;
          this.buildModeItem = null;
          dialog.classList.add('hidden');
          this.showNotification(`Relocating ${obj.name}. Click an empty cell on the floor to place it.`, "info");
        });
      }

      if (btnSell) {
        btnSell.addEventListener('click', () => {
          this.showConfirm("Sell Item?", `Are you sure you want to sell this ${obj.name} for ${refund.toLocaleString()} chips?`, () => {
            this.sendAction(window.Casino.Protocol.Commands.SELL_OBJECT, {
              objectId: obj.id
            });
            dialog.classList.add('hidden');
          });
        });
      }

      dialog.classList.remove('hidden');
    }

    update(dt) {
      // Tick local player buffs
      const localPlayer = this.state.players[this.playerId];
      if (localPlayer && localPlayer.buffs) {
        for (const key in localPlayer.buffs) {
          localPlayer.buffs[key] = Math.max(0, localPlayer.buffs[key] - dt);
          if (localPlayer.buffs[key] <= 0) {
            delete localPlayer.buffs[key];
          }
        }
        this.updateBuffsUI();
      }

      if (this.isInMinigame || this.isInQTE) return;

      // 1. Process player movement keyboard inputs
      const now = performance.now();
      const hasSpeedBuff = localPlayer && localPlayer.buffs && (localPlayer.buffs.speed > 0 || localPlayer.buffs.coffee_buff > 0 || localPlayer.buffs.massage_buff > 0 || localPlayer.buffs.vip_buff > 0);
      const isShift = this.inputHandler.keys['Shift'];
      let cooldown = isShift ? 90 : this.moveCooldown;
      if (hasSpeedBuff) {
        cooldown = cooldown / 2; // Speed buff halves the cooldown!
      }
      if (now - this.lastMoveTime > cooldown) {
        const { dx, dy } = this.inputHandler.getMovementDirection();
        if (dx !== 0 || dy !== 0) {
          if (this.playerMoveInterval) {
            clearInterval(this.playerMoveInterval);
            this.playerMoveInterval = null;
          }
          const player = this.state.players[this.playerId];
          if (player) {
            const targetX = player.gridX + dx;
            const targetY = player.gridY + dy;
            
            // Send action to server
            this.sendAction(window.Casino.Protocol.Commands.MOVE_PLAYER, {
              x: targetX,
              y: targetY
            });
            this.lastMoveTime = now;
          }
        }
      }

      // 2. Interaction check (Display prompt if player stands adjacent to a game)
      const player = this.state.players[this.playerId];
      const promptEl = document.getElementById('interaction-prompt');
      const targetNameEl = document.getElementById('interact-target-name');

      if (player && promptEl && targetNameEl) {
        let promptText = "";
        let hasInteractable = false;

        // Check dirt
        if (this.state.dirtyTiles) {
          const closestDirt = this.state.dirtyTiles.find(t => {
            const dist = Math.sqrt((player.gridX - t.x)**2 + (player.gridY - t.y)**2);
            return dist <= 1.8;
          });
          if (closestDirt) {
            promptText = "🧹 Spilled Dirt (Press E to Sweep)";
            hasInteractable = true;
          }
        }

        // Check pickpockets
        if (!hasInteractable && this.state.employees) {
          const closestPickpocket = Object.values(this.state.employees).find(emp => {
            if (emp.role !== 'pickpocket') return false;
            const dist = Math.sqrt((player.gridX - emp.gridX)**2 + (player.gridY - emp.gridY)**2);
            return dist <= 2.2;
          });
          if (closestPickpocket) {
            promptText = "👮 Pickpocket! (Press E to Apprehend)";
            hasInteractable = true;
          }
        }

        // Check objects
        if (!hasInteractable) {
          let closestObj = this.getClosestObject(player.gridX, player.gridY, 1.8);
          if (closestObj) {
            if (closestObj.isBroken) {
              promptText = `🔧 Broken ${closestObj.name} (Press E to Repair)`;
            } else {
              const isTable = ['roulette', 'craps', 'blackjack', 'ride_the_bus', 'three_card_poker', 'baccarat', 'texas_holdem', 'pai_gow', 'sic_bo', 'caribbean_stud', 'big_six', 'let_it_ride', 'red_dog', 'spanish_21', 'casino_war'].includes(closestObj.type);
              const dealerX = closestObj.gridX + (closestObj.dealerSeat ? closestObj.dealerSeat.rx : 999);
              const dealerY = closestObj.gridY + (closestObj.dealerSeat ? closestObj.dealerSeat.ry : 999);
              const isDealerSeat = (player.gridX === dealerX && player.gridY === dealerY);

              if (isTable && isDealerSeat) {
                const isWheel = ['roulette', 'big_six'].includes(closestObj.type);
                promptText = isWheel ? `🎰 ${closestObj.name} Wheel Slot (Press E to Spin)` : `🤵 ${closestObj.name} Dealer Slot (Press E to Deal)`;
              } else if (['jazz_band', 'hologram', 'fountain'].includes(closestObj.type)) {
                promptText = `🎭 ${closestObj.name} Stage (Press E to Perform)`;
              } else if (['bar', 'restaurant'].includes(closestObj.type)) {
                promptText = `🍻 ${closestObj.name} (Press E to Service Boost)`;
              } else {
                promptText = closestObj.name;
              }
            }
            hasInteractable = true;
          }
        }

        if (hasInteractable) {
          targetNameEl.innerText = promptText;
          promptEl.classList.remove('hidden');
        } else {
          promptEl.classList.add('hidden');
        }
      }
    }

    draw() {
      // Check placement validity for build or move hover preview
      let isPlacementValid = false;
      let previewItemType = this.buildModeItem;
      if (this.moveModeItem) {
        previewItemType = this.moveModeItem.type;
      }

      if (previewItemType) {
        isPlacementValid = this.canPlaceObject(
          previewItemType,
          this.inputHandler.mouseGridX,
          this.inputHandler.mouseGridY,
          this.moveModeItem ? this.moveModeItem.id : null
        );
      }

      // Render the current view frame on canvas
      this.renderer.draw(
        this.state,
        previewItemType,
        this.inputHandler.mouseGridX,
        this.inputHandler.mouseGridY,
        isPlacementValid,
        this.playerId
      );
    }
    getDynamicBuildCost(type) {
      const Catalog = window.Casino.GameObjects.Catalog;
      const template = Catalog[type];
      if (!template) return 0;

      const objects = (this.state.grid && this.state.grid.objects) ? this.state.grid.objects : [];
      const count = objects.filter(o => o.type === type).length;
      return Math.floor(template.cost * Math.pow(1.2, count));
    }

    getDynamicStaffHiringCost(role) {
      let baseCost = 300;
      if (role === 'waitress' || role === 'chef' || role === 'tech_support' || role === 'stocker') baseCost = 400;
      else if (role === 'scientist' || role === 'security') baseCost = 500;
      else if (role === 'manager' || role === 'entertainer') baseCost = 600;

      const employees = this.state.employees ? Object.values(this.state.employees) : [];
      const count = employees.filter(e => e.role === role).length;
      return Math.floor(baseCost * Math.pow(1.2, count));
    }

    showNotification(msg, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast-notification ${type}`;
      toast.innerHTML = `<span>${msg}</span><button class="close-btn" style="font-size:16px; margin-left:12px; background:none; border:none; color:inherit; cursor:pointer;">&times;</button>`;
      
      toast.querySelector('button').onclick = () => toast.remove();
      container.appendChild(toast);

      // Auto-remove
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 3000);
    }

    showConfirm(title, message, onYes, onNo = null) {
      const dialog = document.getElementById('confirm-dialog');
      const titleEl = document.getElementById('confirm-title');
      const msgEl = document.getElementById('confirm-message');
      const yesBtn = document.getElementById('confirm-yes-btn');
      const cancelBtn = document.getElementById('confirm-cancel-btn');

      if (!dialog || !yesBtn || !cancelBtn) return;

      titleEl.innerText = title;
      msgEl.innerText = message;
      dialog.classList.remove('hidden');

      yesBtn.onclick = () => {
        dialog.classList.add('hidden');
        if (onYes) onYes();
      };

      cancelBtn.onclick = () => {
        dialog.classList.add('hidden');
        if (onNo) onNo();
      };
    }

    setupMultiplayerHost() {
      const statusText = document.querySelector('#conn-status .status-text');
      const statusDot = document.querySelector('#conn-status .status-dot');
      const connStatusEl = document.getElementById('conn-status');
      const roomIdContainer = document.getElementById('room-id-container');
      const hudRoomId = document.getElementById('hud-room-id');

      if (statusText) statusText.innerText = "CONNECTING PEER...";
      
      const randomId = 'casino-' + Math.floor(1000 + Math.random() * 9000);
      this.peer = new Peer(randomId);

      this.peer.on('open', (id) => {
        console.log(`[Multiplayer] Opened PeerJS connection. Peer ID: ${id}`);
        if (statusText) statusText.innerText = "HOSTING LOBBY";
        if (statusDot) {
          statusDot.style.background = "#39ff14";
          statusDot.style.boxShadow = "0 0 8px #39ff14";
        }
        if (connStatusEl) {
          connStatusEl.classList.remove('offline');
          connStatusEl.classList.add('online');
          connStatusEl.style.borderColor = "#39ff14";
          connStatusEl.style.color = "#39ff14";
        }
        if (roomIdContainer) roomIdContainer.classList.remove('hidden');
        if (hudRoomId) hudRoomId.innerText = id;

        if (roomIdContainer) {
          roomIdContainer.onclick = () => {
            navigator.clipboard.writeText(id);
            this.showNotification("Room ID copied to clipboard!", "success");
          };
        }

        const sim = new window.Casino.GameSim();
        if (this.loadedStateCache) {
          sim.loadState(this.loadedStateCache);
          this.loadedStateCache = null;
        }
        this.connectToSimulator(sim);
        sim.start();

        // Sync client to host simulation state immediately
        const fullState = sim.getFullState();
        this.state.grid = fullState.grid;
        this.state.economy = fullState.economy;
        this.state.players = fullState.players;
        this.state.guests = fullState.guests;
        this.state.employees = fullState.employees;
        this.state.sizeLevel = fullState.sizeLevel || 1;
        this.state.happiness = fullState.happiness || 1.0;
        this.state.maxGuests = fullState.maxGuests || 10;
        this.state.unlockedTechs = fullState.unlockedTechs || [];
        this.state.currentDay = fullState.currentDay;
        this.state.dayTimer = fullState.dayTimer;
        this.chips = fullState.economy.chips;
        this.updateHUD();

        sim.broadcast = (command, payload) => {
          this.handleServerEvent(command, payload);
          const payloadStr = JSON.stringify({ command, payload });
          for (const conn of this.connections.values()) {
            if (conn.open) {
              conn.send(payloadStr);
            }
          }
        };
      });

      this.peer.on('connection', (conn) => {
        console.log(`[Multiplayer] Incoming guest connection: ${conn.peer}`);
        this.connections.set(conn.peer, conn);

        conn.on('open', () => {
          this.showNotification(`Manager joined: ${conn.peer}`, "success");
          
          if (this.sim) {
            this.sim.addPlayer(conn.peer);
            
            // Send full initial state to the new guest immediately
            conn.send(JSON.stringify({
              command: window.Casino.Protocol.Events.FULL_STATE,
              payload: this.sim.getFullState()
            }));
            
            // Broadcast full state to everyone else to sync the new player's presence
            this.sim.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.sim.getFullState());
          }
        });

        conn.on('data', (dataStr) => {
          try {
            const data = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
            if (data && data.command) {
              if (this.sim) {
                this.sim.receiveCommand(conn.peer, data.command, data.payload);
              }
            }
          } catch (e) {
            console.error("[Multiplayer] Error parsing guest action data:", e);
          }
        });

        conn.on('close', () => {
          console.log(`[Multiplayer] Guest connection closed: ${conn.peer}`);
          this.connections.delete(conn.peer);
          if (this.sim) {
            this.sim.players.delete(conn.peer);
            if (this.sim.clients) {
              this.sim.clients.delete(conn.peer);
            }
            this.sim.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.sim.getFullState());
          }
          this.showNotification(`Manager left lobby: ${conn.peer}`, "info");
        });
      });

      this.peer.on('error', (err) => {
        console.error("[Multiplayer] Host PeerJS error:", err);
        this.showNotification("Multiplayer connection error! Mode set to Solo.", "error");
      });
    }

    setupMultiplayerGuest(hostPeerId) {
      const statusText = document.querySelector('#conn-status .status-text');
      const statusDot = document.querySelector('#conn-status .status-dot');
      const connStatusEl = document.getElementById('conn-status');
      const roomIdContainer = document.getElementById('room-id-container');
      const hudRoomId = document.getElementById('hud-room-id');

      if (statusText) statusText.innerText = "CONNECTING LOBBY...";
      
      this.isMultiplayerGuest = true;
      this.peer = new Peer();

      this.peer.on('open', (myId) => {
        console.log(`[Multiplayer] Guest PeerJS opened with ID: ${myId}. Connecting to host: ${hostPeerId}`);
        
        const conn = this.peer.connect(hostPeerId);
        this.peerConn = conn;

        conn.on('open', () => {
          console.log("[Multiplayer] Connected to Host peer data channel!");
          if (statusText) statusText.innerText = "CONNECTED GUEST";
          if (statusDot) {
            statusDot.style.background = "#ff007f";
            statusDot.style.boxShadow = "0 0 8px #ff007f";
          }
          if (connStatusEl) {
            connStatusEl.classList.remove('offline');
            connStatusEl.classList.add('online');
            connStatusEl.style.borderColor = "#ff007f";
            connStatusEl.style.color = "#ff007f";
          }
          if (roomIdContainer) roomIdContainer.classList.remove('hidden');
          if (hudRoomId) hudRoomId.innerText = hostPeerId;

          this.playerId = myId;
          this.showNotification("Successfully joined casino lobby!", "success");
          this.sendAction(window.Casino.Protocol.Commands.SET_PLAYER_NAME, {
            name: this.playerName,
            color: this.playerSuitColor,
            hairColor: this.playerHairColor
          });
        });

        conn.on('data', (dataStr) => {
          try {
            const data = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
            if (data && data.command) {
              this.handleServerEvent(data.command, data.payload);
            }
          } catch (e) {
            console.error("[Multiplayer] Error parsing host broadcast data:", e);
          }
        });

        conn.on('close', () => {
          console.log("[Multiplayer] Connection to Host closed.");
          this.showNotification("Host disconnected from the lobby!", "error");
          if (statusText) statusText.innerText = "DISCONNECTED";
          if (statusDot) statusDot.style.background = "#ff4d4d";

          this.showConfirm("Host Disconnected", "The host has left the lobby. Do you want to continue playing this casino in Single Player?", () => {
            this.isMultiplayerGuest = false;
            const sim = new window.Casino.GameSim();
            sim.loadState(this.state);
            this.connectToSimulator(sim);
            sim.start();
            this.showNotification("Lobby converted to Single Player!", "success");
            
            if (statusText) statusText.innerText = "PLAYING SOLO";
            if (statusDot) {
              statusDot.style.background = "#39ff14";
              statusDot.style.boxShadow = "0 0 8px #39ff14";
            }
          });
        });
      });

      this.peer.on('error', (err) => {
        console.error("[Multiplayer] Guest PeerJS error:", err);
        this.showNotification("Failed to connect to lobby! Check the Room ID.", "error");
      });
    }

    getObjectAt(gx, gy) {
      if (this.sim && this.sim.gridManager) {
        return this.sim.gridManager.getObjectAt(gx, gy);
      }
      if (this.state.grid && this.state.grid.objects) {
        return this.state.grid.objects.find(obj => 
          gx >= obj.gridX && gx < obj.gridX + obj.width &&
          gy >= obj.gridY && gy < obj.gridY + obj.height
        ) || null;
      }
      return null;
    }

    getClosestObject(gx, gy, maxDistance) {
      if (this.sim && this.sim.gridManager) {
        return this.sim.gridManager.getClosestObject(gx, gy, maxDistance);
      }
      let closest = null;
      let minDist = maxDistance;
      if (this.state.grid && this.state.grid.objects) {
        for (const obj of this.state.grid.objects) {
          let dist = Infinity;
          for (let y = obj.gridY; y < obj.gridY + obj.height; y++) {
            for (let x = obj.gridX; x < obj.gridX + obj.width; x++) {
              const d = Math.sqrt((gx - x)**2 + (gy - y)**2);
              if (d < dist) dist = d;
            }
          }
          if (dist <= minDist) {
            minDist = dist;
            closest = obj;
          }
        }
      }
      return closest;
    }

    canPlaceObject(type, gridX, gridY, ignoreObjId = null) {
      if (!this.state.grid) return false;
      const Catalog = window.Casino.GameObjects.Catalog;
      const template = Catalog[type];
      if (!template) return false;

      const w = template.width;
      const h = template.height;
      const gridW = this.state.grid.cols || 24;
      const gridH = this.state.grid.rows || 16;

      if (gridX < 0 || gridX + w > gridW || gridY < 0 || gridY + h > gridH) {
        return false;
      }

      const entranceX = 2;
      const entranceY = gridH - 1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const gx = gridX + x;
          const gy = gridY + y;
          if (gx >= entranceX - 1 && gx <= entranceX + 1 && gy === entranceY) {
            return false;
          }
        }
      }

      if (this.state.grid.objects) {
        for (const obj of this.state.grid.objects) {
          if (ignoreObjId && obj.id === ignoreObjId) continue;
          const overlapsX = gridX < obj.gridX + obj.width && gridX + w > obj.gridX;
          const overlapsY = gridY < obj.gridY + obj.height && gridY + h > obj.gridY;
          if (overlapsX && overlapsY) {
            return false;
          }
        }
      }

      return true;
    }

    openAmenityShop(objectId) {
      const obj = this.state.grid.objects.find(o => o.id === objectId);
      if (!obj) return;
      
      const shopData = AmenityShopData[obj.type];
      if (!shopData) return;
      
      const modal = document.getElementById('amenity-shop-modal');
      if (!modal) return;
      
      document.getElementById('amenity-shop-title').innerText = shopData.title;
      document.getElementById('amenity-shop-desc').innerText = shopData.desc;
      
      const itemsList = document.getElementById('amenity-shop-items');
      itemsList.innerHTML = '';
      
      // Render buyable items
      shopData.items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.style.display = 'flex';
        itemEl.style.flexDirection = 'column';
        itemEl.style.gap = '4px';
        itemEl.style.background = 'rgba(255,255,255,0.03)';
        itemEl.style.padding = '8px';
        itemEl.style.borderRadius = '6px';
        itemEl.style.border = '1px solid rgba(255,255,255,0.05)';
        
        itemEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:bold; font-size:12px; color:#fff;">${item.name}</span>
            <button class="minigame-btn action" style="padding:4px 8px; font-size:10px;">Buy (${item.cost}c)</button>
          </div>
          <div style="font-size:10px; color:var(--text-secondary);">${item.desc}</div>
        `;
        
        const buyBtn = itemEl.querySelector('button');
        buyBtn.onclick = () => {
          if (this.chips < item.cost) {
            this.showNotification("Insufficient chips!", "error");
            return;
          }
          // Send BUY_BUFF command to server
          this.sendAction(window.Casino.Protocol.Commands.BUY_BUFF, {
            buffType: item.buff,
            cost: item.cost,
            duration: item.duration * 1000 // duration in ms
          });
          modal.classList.add('hidden');
          window.Casino.SoundManager.playPlaceBet();
        };
        
        itemsList.appendChild(itemEl);
      });
      
      // Render QTE options if applicable
      if (['jazz_band', 'hologram', 'fountain', 'bar', 'restaurant'].includes(obj.type)) {
        const qteEl = document.createElement('div');
        qteEl.style.marginTop = '8px';
        qteEl.style.borderTop = '1px solid rgba(255,255,255,0.08)';
        qteEl.style.paddingTop = '8px';
        
        let qteName = '';
        let qteDesc = '';
        let qteTitle = '';
        if (['jazz_band', 'hologram', 'fountain'].includes(obj.type)) {
          qteTitle = "🎭 STAGE PERFORMANCE";
          qteDesc = "Rhythm performance! Hit the GREEN zone!";
          qteName = "Perform Live";
        } else {
          qteTitle = "🍻 SERVICE BOOST";
          qteDesc = "Prepping wagers! Hit the GREEN zone!";
          qteName = "Boost Service";
        }
        
        qteEl.innerHTML = `
          <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px;">${qteDesc}</div>
          <button class="minigame-btn action" style="width:100%; border-color:var(--accent-blue); background:rgba(0,240,255,0.05); color:var(--accent-blue); font-size:11px; padding:6px;">${qteName} (Free)</button>
        `;
        
        const qteBtn = qteEl.querySelector('button');
        qteBtn.onclick = () => {
          modal.classList.add('hidden');
          this.startQTEMinigame(
            qteTitle,
            qteDesc,
            () => {
              this.sendAction(window.Casino.Protocol.Commands.INTERACT, { objectId: obj.id });
              this.showNotification(`${qteName} complete! Station boosted!`, "success");
            }
          );
        };
        
        itemsList.appendChild(qteEl);
      }
      
      // Close button wiring
      document.getElementById('btn-close-amenity-shop').onclick = () => {
        modal.classList.add('hidden');
      };
      
      modal.classList.remove('hidden');
    }

    updateBuffsUI() {
      const container = document.getElementById('hud-buffs-list');
      if (!container) return;
      
      const player = this.state.players[this.playerId];
      if (!player || !player.buffs || Object.keys(player.buffs).length === 0) {
        container.innerHTML = '';
        return;
      }
      
      const buffNames = {
        speed: { name: "⚡ Volt Soda", color: "#00f0ff" },
        luck: { name: "🍀 Lucky Chips", color: "#39ff14" },
        rp: { name: "🧪 Gummy Brain", color: "#e64dff" },
        coffee_buff: { name: "☕ Espresso", color: "#ffaa00" },
        massage_buff: { name: "☯️ Zen Massage", color: "#ff007f" },
        vip_buff: { name: "👑 VIP Lounge", color: "#ffd700" },
        payout: { name: "🍸 Royal Cocktail", color: "#39ff14" },
        restaurant_buff: { name: "🍳 Ribeye Steak", color: "#ffd700" },
        music_buff: { name: "🎵 Concert Ticket", color: "#e64dff" }
      };
      
      container.innerHTML = Object.keys(player.buffs).map(key => {
        const remainingSec = Math.ceil(player.buffs[key] / 1000);
        if (remainingSec <= 0) return '';
        const info = buffNames[key] || { name: key.toUpperCase(), color: "#fff" };
        
        return `
          <div style="font-size:10px; font-weight:bold; color:#000; background:${info.color}; padding:2px 6px; border-radius:4px; box-shadow: 0 0 6px ${info.color}66; display:flex; align-items:center; gap:4px;">
            <span>${info.name}</span>
            <span style="opacity:0.8; font-family:monospace;">${remainingSec}s</span>
          </div>
        `;
      }).join('');
    }
  }

  const AmenityShopData = {
    soda_machine: {
      title: "🥤 Soda Machine Shop",
      desc: "Buy refreshments to boost your energy!",
      items: [
        { name: "Volt Energy Drink", cost: 50, duration: 60, buff: "speed", desc: "⚡ Double Movement Speed for 60s" }
      ]
    },
    vending_machine: {
      title: "🍫 Vending Kiosk",
      desc: "Salty snacks to get you in the zone!",
      items: [
        { name: "Lucky Chips", cost: 60, duration: 60, buff: "luck", desc: "🍀 +15% Minigame Win Luck for 60s" }
      ]
    },
    candy_dispenser: {
      title: "🍬 Candy Dispenser",
      desc: "Sweet sugary treats for brain power!",
      items: [
        { name: "Gummy Brains", cost: 100, duration: 60, buff: "rp", desc: "🧪 2x Research Point (RP) rewards for 60s" }
      ]
    },
    coffee_maker: {
      title: "☕ Coffee Station",
      desc: "Freshly brewed espresso shots!",
      items: [
        { name: "Double Espresso", cost: 150, duration: 60, buff: "coffee_buff", desc: "⚡ +100% Speed & 2x RP for 60s" }
      ]
    },
    bathroom_stall: {
      title: "🚽 Restroom Stall",
      desc: "Clean up and freshen up!",
      items: [
        { name: "Splash of Cold Water", cost: 40, duration: 60, buff: "speed", desc: "⚡ Halves movement cooldown for 60s" }
      ]
    },
    luxury_bathroom: {
      title: "✨ Luxury Restroom",
      desc: "Premium wash station for VIPs!",
      items: [
        { name: "VIP Cologne Splash", cost: 80, duration: 90, buff: "luck", desc: "🍀 +15% Luck & Speed Boost for 90s" }
      ]
    },
    massage_chair: {
      title: "💺 Massage Chair Kiosk",
      desc: "Sit back and relax under vibration rollers!",
      items: [
        { name: "Zen Massage Session", cost: 120, duration: 60, buff: "massage_buff", desc: "☯️ Speed & Luck Boost for 60s" }
      ]
    },
    vip_lounge: {
      title: "🥂 VIP Lounge Bar",
      desc: "Access the elite area for premium benefits!",
      items: [
        { name: "VIP Lounge Pass", cost: 300, duration: 90, buff: "vip_buff", desc: "👑 Double Guest Tips & 2x RP for 90s" }
      ]
    },
    popcorn_cart: {
      title: "🍿 Popcorn Cart",
      desc: "Fresh buttered popcorn smell!",
      items: [
        { name: "Caramel Glazed Popcorn", cost: 80, duration: 60, buff: "luck", desc: "🍀 +10% Minigame Win Luck for 60s" }
      ]
    },
    ice_cream: {
      title: "🍦 Ice Cream Kiosk",
      desc: "Delicious frozen sundaes!",
      items: [
        { name: "Double Cherry Sundae", cost: 90, duration: 60, buff: "massage_buff", desc: "⚡ Speed & Luck Boost for 60s" }
      ]
    },
    bar: {
      title: "🍸 Cocktail Bar Kiosk",
      desc: "Premium mixology station!",
      items: [
        { name: "Royal Gin & Tonic", cost: 110, duration: 60, buff: "payout", desc: "🪙 Double all chip payouts in minigames for 60s" }
      ]
    },
    restaurant: {
      title: "🍳 Gourmet Restaurant",
      desc: "Fine dining for management!",
      items: [
        { name: "Gourmet Ribeye Steak", cost: 200, duration: 60, buff: "restaurant_buff", desc: "👑 Double RP & Double Chip Payouts for 60s" }
      ]
    },
    pizza_oven: {
      title: "🍕 Stone Pizzeria",
      desc: "Fresh hot pizza slices!",
      items: [
        { name: "Super Pepperoni Slice", cost: 130, duration: 90, buff: "rp", desc: "🧪 2x Research Point (RP) rewards for 90s" }
      ]
    },
    jazz_band: {
      title: "🎷 Music Stage Concert",
      desc: "Buy concert tickets or perform live!",
      items: [
        { name: "Front Row VIP Concert Ticket", cost: 250, duration: 60, buff: "music_buff", desc: "🎵 Double Payouts & Luck Boost for 60s" }
      ]
    },
    fountain: {
      title: "⛲ Wishing Fountain",
      desc: "Throw a coin and make a wish!",
      items: [
        { name: "Throw Lucky Golden Coin", cost: 50, duration: 60, buff: "luck", desc: "🍀 +15% Minigame Win Luck for 60s" }
      ]
    },
    arcade_console: {
      title: "🕹️ Retro Arcade Cabinet",
      desc: "Insert coin to play!",
      items: [
        { name: "VIP Game Tokens", cost: 70, duration: 60, buff: "massage_buff", desc: "⚡ Speed & Luck Boost for 60s" }
      ]
    },
    vr_pod: {
      title: "🥽 Virtual Reality Pod",
      desc: "Simulate a cyber world!",
      items: [
        { name: "Cyber Vibe Experience", cost: 140, duration: 60, buff: "coffee_buff", desc: "⚡ +100% Speed & 2x RP for 60s" }
      ]
    },
    hologram: {
      title: "💿 Hologram Projector",
      desc: "Futuristic visual projections!",
      items: [
        { name: "Holo-Matrix Vibe", cost: 100, duration: 60, buff: "rp", desc: "🧪 2x Research Point (RP) rewards for 60s" }
      ]
    },
    gold_statue: {
      title: "👑 Golden Statue Shrine",
      desc: "Rub the statue's hands for positive energy!",
      items: [
        { name: "Rub Golden Statue", cost: 120, duration: 60, buff: "luck", desc: "🍀 +15% Minigame Win Luck for 60s" }
      ]
    },
    glow_sofa: {
      title: "🛋️ Neon Glow Lounge",
      desc: "Relax on neon leather!",
      items: [
        { name: "Relaxing Couch Nap", cost: 60, duration: 60, buff: "speed", desc: "⚡ Halves movement cooldown for 60s" }
      ]
    }
  };

  window.Casino.ClientGame = ClientGame;
})();
