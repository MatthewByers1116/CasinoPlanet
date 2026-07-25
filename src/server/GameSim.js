// GameSim: Headless Server Simulator running state logic and handling client commands
(function() {
  class GameSim {
    constructor() {
      this.gridManager = new window.Casino.GridManager(24, 16);
      const startingChips = (window.Casino.Config && window.Casino.Config.STARTING_CHIPS) || 5000;
      this.economyManager = new window.Casino.EconomyManager(startingChips);
      
      this.players = new Map();
      this.guests = new Map();
      
      this.nextGuestId = 1;
      this.guestMax = 12;
      this.guestSpawnCooldown = 4000; // ms
      this.guestSpawnTimer = 0;

      // Event listener callback (simulating networking)
      this.onBroadcast = null;

      // Craps persistent state per table (since Craps has points)
      this.crapsState = new Map(); // tableId -> { point: null, bets: [] }

      // Card game minigame sessions
      this.blackjackSessions = new Map();
      this.rideTheBusSessions = new Map();
      this.playerGamblingLosses = 0;
      this.threeCardPokerSessions = new Map();
      this.baccaratSessions = new Map();
      this.texasHoldemSessions = new Map();
      this.paiGowSessions = new Map();
      this.caribbeanStudSessions = new Map();
      this.letItRideSessions = new Map();
      this.redDogSessions = new Map();
      this.spanish21Sessions = new Map();
      this.casinoWarSessions = new Map();
      this.videoPokerSessions = new Map();

      // Casino upgrades and happiness tracking
      this.sizeLevel = 1;
      this.upgradeCosts = [0, 1500, 3000]; // Lvl 1->2: 1500, Lvl 2->3: 3000
      this.happiness = 1.0; // 0.10 to 1.0 (100%)

      // Tycoon Progression
      this.researchPoints = 0;
      this.departureHistory = [80, 80, 80];
      this.starRating = 4.2;
      this.dirtyTiles = []; // Array of {x, y} objects representing dirty floor cells

      // Employee management
      this.employees = new Map(); // employeeId -> EmployeeAI
      this.nextEmployeeId = 1;
      this.salaryTimer = 60000; // salary tick every 60s

      // Day / Cycle System
      this.currentDay = 1;
      this.dayTimer = 180; // 180 seconds countdown
      this.dayRevenue = 0;
      this.dayExpenses = 0;
      this.dayStats = {}; // gameType/source -> { earned: 0, lost: 0 }

      // Pre-place starter amenities so needs can be satisfied immediately
      this.gridManager.placeObject('soda_machine', 2, 2);
      this.gridManager.placeObject('vending_machine', 4, 2);
      this.gridManager.placeObject('bathroom_stall', 6, 2);
      this.gridManager.placeObject('slots', 12, 10);

      this.unlockedTechs = [
        'slots', 'roulette', 'craps', 'blackjack', 'ride_the_bus', 'three_card_poker',
        'soda_machine', 'vending_machine', 'bathroom_stall', 'bar'
      ];
    }

    addPlayer(playerId, playerName = null) {
      // Spawn player near center
      const startX = Math.floor(this.gridManager.cols / 2);
      const startY = Math.floor(this.gridManager.rows / 2);
      const newPlayer = new window.Casino.PlayerEntity(playerId, startX, startY);
      if (playerName) {
        newPlayer.name = playerName;
      }
      
      // Bind chips property directly to economyManager to prevent synchronization drift and NaNs
      Object.defineProperty(newPlayer, 'chips', {
        get: () => this.economyManager.getChips(),
        set: (val) => { this.economyManager.chips = val; },
        configurable: true,
        enumerable: true
      });

      this.players.set(playerId, newPlayer);
      this.broadcast(window.Casino.Protocol.Events.PLAYER_MOVED, newPlayer.serialize());
      return newPlayer;
    }

    removePlayer(playerId) {
      this.players.delete(playerId);
    }

    start() {
      this.isRunning = true;
      // Run tick loop every 100ms
      let lastTime = performance.now();
      const tickLoop = () => {
        if (!this.isRunning) return;
        const now = performance.now();
        const dt = now - lastTime;
        lastTime = now;
        
        this.tick(dt);
        setTimeout(tickLoop, 100);
      };
      tickLoop();
    }

    stop() {
      this.isRunning = false;
    }

    tick(dt) {
      // 1. Calculate happiness rating
      this.updateHappiness();

      // Day Timer Countdown
      if (this.dayTimer === undefined) {
        this.currentDay = 1;
        this.dayTimer = 180;
        this.dayRevenue = 0;
        this.dayExpenses = 0;
        this.dayStats = {};
      }
      this.dayTimer -= dt / 1000;
      if (this.dayTimer <= 0) {
        // We are in "After Hours" mode!
        // Make all remaining guests start leaving immediately
        for (const guest of this.guests.values()) {
          if (guest.state !== 'LEAVING') {
            guest.isForcedExit = true;
            guest.startLeaving(this.gridManager);
          }
        }
        
        // Only trigger the end of the day when ALL guests have cleared out of the casino
        if (this.guests.size === 0) {
          this.endCurrentDay();
        }
      }

      // 2. Adjust caps and spawning intervals based on size and happiness
      let baseMax = 10;
      if (this.isGamblerMode) {
        baseMax = 0;
      } else {
        if (this.sizeLevel === 2) baseMax = 25;
        else if (this.sizeLevel === 3) baseMax = 50;
      }

      let objectCapBonus = 0;
      if (!this.isGamblerMode) {
        for (const obj of this.gridManager.placedObjects.values()) {
          const template = window.Casino.GameObjects.Catalog[obj.type];
          if (template && (obj.type === 'bar' || obj.type === 'restaurant')) {
            objectCapBonus += template.guestCapacity;
          }
        }
      }
      this.guestMax = baseMax + objectCapBonus;

      // Spawning interval depends on game variety and food/drink upgrades
      let cooldown = 5000; // Base 5s
      const uniqueTypes = new Set(Array.from(this.gridManager.placedObjects.values()).map(o => o.type));
      cooldown = cooldown * Math.pow(0.80, uniqueTypes.size); // 20% faster per unique type
      this.guestSpawnCooldown = Math.max(800, cooldown);

      // 3. Update guest AI entities
      for (const [id, guest] of this.guests.entries()) {
        guest.update(dt, this.gridManager, this.economyManager, this);
        
        if (guest.shouldDespawn) {
          // Unoccupy any game table and release seats
          guest.releaseAllHeldSeats(this.gridManager);
          if (guest.targetObjectId) {
            const obj = this.gridManager.placedObjects.get(guest.targetObjectId);
            if (obj) {
              obj.guests = obj.guests.filter(gId => gId !== guest.id);
            }
          }
          
           // Calculate final average needs based on departure decision moment (or fallback)
          const finalHappiness = guest.happinessOnDeparture !== undefined ? guest.happinessOnDeparture : ((guest.thirst + guest.hunger + guest.bio + guest.entertainment) / 4);
          
          if (!guest.isForcedExit) {
            // 80% happy is fine -> scale so happiness >= 80 maps to 100%
            const adjustedHappiness = finalHappiness >= 80 ? 100 : (finalHappiness / 80) * 100;
            
            // Save in history (up to 20 samples) and recalculate star rating
            this.departureHistory.push(adjustedHappiness);
            if (this.departureHistory.length > 20) {
              this.departureHistory.shift();
            }
            this.updateStarRating();

            // Award 1 Research Point if guest leaves happy (adjusted satisfaction >= 70)
            if (adjustedHappiness >= 70) {
              this.researchPoints += 1;
              console.log(`[Server:GameSim] Guest "${guest.name}" left HAPPY (${adjustedHappiness.toFixed(0)}%). Awarded 1 Research Point. Total RP: ${this.researchPoints}`);
            } else {
              console.log(`[Server:GameSim] Guest "${guest.name}" left UNHAPPY (${adjustedHappiness.toFixed(0)}%). No RP awarded.`);
            }
          } else {
            console.log(`[Server:GameSim] Guest "${guest.name}" left due to forced end of day. Skipping ratings impact.`);
          }

          this.guests.delete(id);
          // Broadcast full state to sync researchPoints and starRating immediately on client
          this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
        }
      }

      // Update player buffs
      for (const player of this.players.values()) {
        if (player.tickBuffs) player.tickBuffs(dt);
      }

      // Update employee AI entities
      for (const employee of this.employees.values()) {
        employee.update(dt, this.gridManager, this.economyManager, this);

        if (employee.role === 'scientist') {
          employee.researchTimer = (employee.researchTimer || 0) + dt;
          if (employee.researchTimer >= 10000) { // Every 10 seconds
            employee.researchTimer = 0;
            this.researchPoints += 1;
            console.log(`[Server:GameSim] Research Scientist "${employee.id}" generated 1 RP. Total RP: ${this.researchPoints}`);
            this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
          }
        }
      }

      // Deduct employee salaries (DISABLED: Employee wages are free to simplify progression)
      this.salaryTimer -= dt;
      if (this.salaryTimer <= 0) {
        this.salaryTimer = 60000;
      }

      // 4. Spawn new guests (disabled in after hours)
      if (this.dayTimer > 0) {
        this.guestSpawnTimer -= dt;
        if (this.guestSpawnTimer <= 0 && this.guests.size < this.guestMax) {
          this.spawnGuest();
          this.guestSpawnTimer = this.guestSpawnCooldown + Math.random() * 2000;
        }
      }

      // 4.1 Spawn pickpockets occasionally
      const spawnCooldown = (window.Casino.Config && window.Casino.Config.PICKPOCKET_SPAWN_COOLDOWN) || 45000;
      const spawnChance = (window.Casino.Config && window.Casino.Config.PICKPOCKET_SPAWN_CHANCE) || 0.15;
      const maxPickpockets = (window.Casino.Config && window.Casino.Config.MAX_PICKPOCKETS) || 1;

      this.pickpocketSpawnTimer = (this.pickpocketSpawnTimer || spawnCooldown) - dt;
      if (this.pickpocketSpawnTimer <= 0) {
        this.pickpocketSpawnTimer = spawnCooldown;
        let pickpockets = 0;
        for (const emp of this.employees.values()) {
          if (emp.role === 'pickpocket') pickpockets++;
        }
        if (pickpockets < maxPickpockets && Math.random() < spawnChance) {
          const id = `pickpocket_${Date.now()}`;
          const pickpocket = new window.Casino.EmployeeAI(id, 'pickpocket', this.gridManager.entranceX, this.gridManager.entranceY);
          this.employees.set(id, pickpocket);
          console.log(`[Server:GameSim] Spawned pickpocket "${id}"`);
          
          this.broadcast(window.Casino.Protocol.Events.GUEST_LEFT_REASON, {
            name: 'A suspicious character',
            reason: 'pickpocket_spawned'
          });
        }
      }

      // Calculate object EPS
      const nowMs = Date.now();
      for (const obj of this.gridManager.placedObjects.values()) {
        if (!obj.earnings) obj.earnings = [];
        obj.earnings = obj.earnings.filter(e => nowMs - e.time <= 10000); // 10s window
        const total = obj.earnings.reduce((sum, e) => sum + e.amount, 0);
        obj.eps = total / 10;
      }

      // 5. Broadcast sync state to clients
      this.broadcast(window.Casino.Protocol.Events.STATE_UPDATE, this.getSerializedDelta());
    }

    spawnGuest() {
      if (this.isGamblerMode) return;
      const id = `guest_${this.nextGuestId++}`;
      // Spawn at entrance
      const guest = new window.Casino.GuestAI(id, this.gridManager.entranceX, this.gridManager.entranceY);
      
      // Scale spawned guest starting budgets directly with happiness
      guest.budget = Math.floor(guest.budget * (0.5 + this.happiness));
      
      this.guests.set(id, guest);
    }

    // Process commands received from client
    receiveCommand(playerId, command, payload) {
      console.log(`[Server:GameSim] Command Received: "${command}" from Player: "${playerId}"`, payload);
      const player = this.players.get(playerId);
      if (!player) return;

      const Protocol = window.Casino.Protocol;

      switch (command) {
        case Protocol.Commands.MOVE_PLAYER:
          this.handleMovePlayer(player, payload);
          break;

        case Protocol.Commands.PLACE_OBJECT:
          this.handlePlaceObject(player, payload);
          break;

        case Protocol.Commands.INTERACT:
          this.handleInteract(player, payload);
          break;

        case Protocol.Commands.LEAVE_INTERACTION:
          player.clearInteraction();
          this.broadcast(window.Casino.Protocol.Events.PLAYER_MOVED, player.serialize());
          break;

        case Protocol.Commands.PLAY_MINIGAME:
          this.handlePlayMinigame(player, payload);
          break;

        case Protocol.Commands.UPGRADE_OBJECT:
          this.handleUpgradeObject(player, payload);
          break;

        case Protocol.Commands.SELL_OBJECT:
          this.handleSellObject(player, payload);
          break;

        case Protocol.Commands.HIRE_EMPLOYEE:
          this.handleHireEmployee(player, payload);
          break;

        case Protocol.Commands.DEV_GIVE_CHIPS:
          this.economyManager.addChips(payload.amount);
          break;

        case Protocol.Commands.CLEAN_DIRT:
          this.handleCleanDirt(player, payload);
          break;

        case Protocol.Commands.CAPTURE_PICKPOCKET:
          this.handleCapturePickpocket(player, payload);
          break;

        case Protocol.Commands.REPAIR_MACHINE:
          this.handleRepairMachine(player, payload);
          break;

        case Protocol.Commands.SELECT_DIFFICULTY:
          this.handleSelectDifficulty(player, payload);
          break;

        case Protocol.Commands.UPGRADE_SIZE:
          this.handleUpgradeSize(player);
          break;

        case Protocol.Commands.UNLOCK_TECH:
          this.handleUnlockTech(player, payload);
          break;

        case Protocol.Commands.REFILL_AMENITY:
          this.handleRefillAmenity(player, payload);
          break;

        case Protocol.Commands.GRAB_AMENITY_ITEM:
          this.handleGrabAmenityItem(player, payload);
          break;

        case Protocol.Commands.HAND_NEEDS:
          this.handleHandNeeds(player, payload);
          break;

        case Protocol.Commands.SET_PLAYER_NAME:
          this.handleSetPlayerName(player, payload);
          break;

        case Protocol.Commands.MOVE_OBJECT:
          this.handleMoveObject(player, payload);
          break;

        case Protocol.Commands.BUY_BUFF:
          this.handleBuyBuff(player, payload);
          break;

        case Protocol.Commands.UPGRADE_EMPLOYEE:
          this.handleUpgradeEmployee(player, payload);
          break;
      }
    }

    handleMovePlayer(player, payload) {
      // Validate step distance (player can only move 1 grid tile per command)
      const dx = Math.abs(payload.x - player.gridX);
      const dy = Math.abs(payload.y - player.gridY);
      
      if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        player.move(payload.x, payload.y, this.gridManager);
        this.broadcast(window.Casino.Protocol.Events.PLAYER_MOVED, player.serialize());
      }
    }

    handleMoveObject(player, payload) {
      const { objectId, gridX, gridY } = payload;
      const obj = this.gridManager.placedObjects.get(objectId);
      if (!obj) return;

      const Catalog = window.Casino.GameObjects.Catalog;
      const template = Catalog[obj.type];
      if (!template) return;

      // Prevent moving on top of player character model
      for (const p of this.players.values()) {
        if (p.gridX >= gridX && p.gridX < gridX + template.width &&
            p.gridY >= gridY && p.gridY < gridY + template.height) {
          console.warn(`[Server:GameSim] Move rejected: Overlaps with player "${p.id}" position.`);
          return;
        }
      }

      const success = this.gridManager.moveObject(objectId, gridX, gridY);
      if (success) {
        console.log(`[Server:GameSim] Object "${objectId}" moved to (${gridX}, ${gridY})`);
        this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
      }
    }

    handlePlaceObject(player, payload) {
      const Catalog = window.Casino.GameObjects.Catalog;
      const template = Catalog[payload.type];
      if (!template) return;

      // 0. Verify technology is unlocked
      if (!this.unlockedTechs.includes(payload.type)) {
        console.warn(`[Server:GameSim] Place rejected: Technology "${payload.type}" is locked.`);
        return;
      }

      // 1. Verify economy affordability
      if (!this.economyManager.canAfford(template.cost)) return;

      // 2. Prevent building on top of any player character model
      for (const p of this.players.values()) {
        if (p.gridX >= payload.gridX && p.gridX < payload.gridX + template.width &&
            p.gridY >= payload.gridY && p.gridY < payload.gridY + template.height) {
          console.warn(`[Server:GameSim] Place rejected: Overlaps with player "${p.id}" position.`);
          const ui = window.Casino.clientInstance && window.Casino.clientInstance.minigameUI;
          if (ui) ui.logDebug(`Cannot place: Overlaps with character position!`, 'error');
          return;
        }
      }

      // 3. Try placing
      const placedObj = this.gridManager.placeObject(payload.type, payload.gridX, payload.gridY);
      if (placedObj) {
        // Deduct money
        this.economyManager.deductChips(template.cost);
        this.recordDayStat('construction', -template.cost);
        this.broadcast(window.Casino.Protocol.Events.OBJECT_PLACED, {
          object: placedObj,
          chips: this.economyManager.getChips()
        });
      }
    }

    handleUnlockTech(player, payload) {
      const { techType } = payload;
      if (this.unlockedTechs.includes(techType)) return;

      const Catalog = window.Casino.GameObjects.Catalog;
      const template = Catalog[techType];
      if (!template) return;

      // 1. Check star rating requirement
      const requiredRating = template.requiredRating || 1.0;
      if (this.starRating < requiredRating) {
        console.warn(`[Server:GameSim] Tech "${techType}" unlock rejected: Rating too low (${this.starRating} < ${requiredRating}).`);
        return;
      }

      // 2. Check research points requirement
      const researchCost = template.researchCost || 0;
      if (this.researchPoints < researchCost) {
        console.warn(`[Server:GameSim] Tech "${techType}" unlock rejected: Insufficient Research Points (${this.researchPoints} < ${researchCost}).`);
        return;
      }

      // 3. Deduct research points and unlock
      this.researchPoints -= researchCost;
      this.unlockedTechs.push(techType);
      
      console.log(`[Server:GameSim] Tech "${techType}" unlocked for ${researchCost} Research Points. Remaining: ${this.researchPoints}`);

      // Broadcast full state
      this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
    }

    handleBuyBuff(player, payload) {
      const { buffType, cost, duration } = payload;
      if (!this.economyManager.canAfford(cost)) {
        console.warn(`[Server:GameSim] Player cannot afford buff: ${cost}`);
        return;
      }
      this.economyManager.deductChips(cost);
      this.recordDayStat('buffs', -cost);

      if (!player.buffs) player.buffs = {};
      player.buffs[buffType] = (player.buffs[buffType] || 0) + duration;
      
      console.log(`[Server:GameSim] Player purchased buff "${buffType}" for ${cost} Chips. New duration: ${player.buffs[buffType]}ms`);
      this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
    }

    handleUpgradeEmployee(player, payload) {
      const { employeeId, upgradeType } = payload;
      const employee = this.employees.get(employeeId);
      if (!employee) {
        console.warn(`[Server:GameSim] Upgrade rejected: Employee "${employeeId}" not found.`);
        return;
      }

      const currentLvl = employee[upgradeType + 'Lvl'] || 1;
      if (currentLvl >= 5) {
        console.warn(`[Server:GameSim] Upgrade rejected: Employee "${employeeId}" ${upgradeType} already max level 5.`);
        return;
      }

      let cost = 0;
      if (upgradeType === 'speed') cost = 200 * currentLvl;
      else if (upgradeType === 'capacity') cost = 300 * currentLvl;
      else if (upgradeType === 'needs') cost = 150 * currentLvl;
      else return;

      if (!this.economyManager.canAfford(cost)) {
        console.warn(`[Server:GameSim] Player cannot afford employee upgrade: ${cost}`);
        return;
      }

      this.economyManager.deductChips(cost);
      this.recordDayStat('upgrades', -cost);

      employee[upgradeType + 'Lvl'] = currentLvl + 1;
      
      // Update employee stats dynamically
      if (upgradeType === 'speed') {
        employee.speed = 3.0 * (1 + (employee.speedLvl - 1) * 0.2);
      }
      
      console.log(`[Server:GameSim] Upgraded Employee "${employeeId}" ${upgradeType} to Level ${employee[upgradeType + 'Lvl']} for ${cost} Chips.`);
      this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
    }

    handleInteract(player, payload) {
      const obj = this.gridManager.placedObjects.get(payload.objectId);
      if (obj) {
        // Calculate player distance to table
        let distance = Infinity;
        for (let y = obj.gridY; y < obj.gridY + obj.height; y++) {
          for (let x = obj.gridX; x < obj.gridX + obj.width; x++) {
            const d = Math.sqrt((player.gridX - x)**2 + (player.gridY - y)**2);
            if (d < distance) distance = d;
          }
        }

        // Within interaction range
        if (distance <= 2.2) {
          player.startInteraction(obj.id);

          // Perform boosts for active player interactions
          if (['jazz_band', 'hologram', 'fountain'].includes(obj.type)) {
            for (const guest of this.guests.values()) {
              const d = Math.sqrt((guest.gridX - obj.gridX)**2 + (guest.gridY - obj.gridY)**2);
              if (d <= 6.0) {
                guest.entertainment = 100;
              }
            }
            console.log(`[Server:GameSim] Player performed at stage "${obj.name}", boosting guests.`);
          } else if (['bar', 'restaurant'].includes(obj.type)) {
            const originalIncome = obj.tickIncome;
            obj.tickIncome = Math.floor(originalIncome * 1.5);
            console.log(`[Server:GameSim] Player boosted service at "${obj.name}" (income increased to ${obj.tickIncome})`);
            
            // Revert after 60s
            setTimeout(() => {
              if (this.gridManager.placedObjects.has(obj.id)) {
                obj.tickIncome = originalIncome;
                console.log(`[Server:GameSim] Service boost ended for "${obj.name}". Reverted to ${originalIncome}.`);
              }
            }, 60000);
          } else if (obj.dealerSeat) {
            obj.isDealerBoosted = true;
            console.log(`[Server:GameSim] Player boosted dealing at "${obj.name}"`);
            
            // Revert after 60s
            setTimeout(() => {
              if (this.gridManager.placedObjects.has(obj.id)) {
                obj.isDealerBoosted = false;
                console.log(`[Server:GameSim] Dealing boost ended for "${obj.name}".`);
              }
            }, 60000);
        }
      }
      this.broadcast(window.Casino.Protocol.Events.PLAYER_MOVED, player.serialize());
      }
    }

    isDealerPresent(obj) {
      if (!obj || !obj.dealerSeat) return false;
      if (obj.dealerSeat.employeeId !== null) return true;
      const dealerX = obj.gridX + obj.dealerSeat.rx;
      const dealerY = obj.gridY + obj.dealerSeat.ry;
      for (const player of this.players.values()) {
        if (player.gridX === dealerX && player.gridY === dealerY) {
          return true;
        }
      }
      return false;
    }

    handlePlayMinigame(player, payload) {
      const { gameType, tableId, bets, action } = payload;
      
      const ui = window.Casino.clientInstance && window.Casino.clientInstance.minigameUI;
      if (ui) {
        ui.logDebug(`Server verifying interaction for "${tableId}". Current interactingObjectId: "${player.interactingObjectId}"`, 'info');
      }

      // Verify player is interacting with this table, with a fail-safe fallback check
      if (player.interactingObjectId !== tableId) {
        if (ui) ui.logDebug(`Server interaction ID mismatch. Checking distance fallback...`, 'warning');
        const obj = this.gridManager.placedObjects.get(tableId);
        if (obj) {
          let distance = Infinity;
          for (let y = obj.gridY; y < obj.gridY + obj.height; y++) {
            for (let x = obj.gridX; x < obj.gridX + obj.width; x++) {
              const d = Math.sqrt((player.gridX - x)**2 + (player.gridY - y)**2);
              if (d < distance) distance = d;
            }
          }
          if (distance <= 2.2) {
            player.startInteraction(tableId);
            if (ui) ui.logDebug(`Server distance check passed (${distance.toFixed(2)} tiles <= 2.2). Registered interaction.`, 'success');
          } else {
            if (ui) ui.logDebug(`Server distance check failed (${distance.toFixed(2)} tiles > 2.2). Interaction rejected.`, 'error');
            console.warn(`[Server:GameSim] Interaction rejected due to distance: ${distance}`);
            return;
          }
        } else {
          if (ui) ui.logDebug(`Server object not found: "${tableId}"`, 'error');
          return;
        }
      }

      const obj = this.gridManager.placedObjects.get(tableId);
      if (!obj || obj.type !== gameType) {
        if (ui) ui.logDebug(`Server table verify failed: obj found=${!!obj}, expected type="${gameType}", actual="${obj ? obj.type : ''}"`, 'error');
        return;
      }

      // Check if table game requires a dealer
      if (['roulette', 'craps', 'blackjack', 'ride_the_bus', 'three_card_poker', 'baccarat', 'texas_holdem', 'pai_gow', 'sic_bo', 'caribbean_stud', 'big_six', 'let_it_ride', 'red_dog', 'spanish_21', 'casino_war'].includes(obj.type)) {
        if (!this.isDealerPresent(obj)) {
          if (ui) ui.logDebug(`Cannot play: This table requires a Dealer! Hire staff, stand on the dealer slot, or wait for a dealer to arrive.`, 'error');
          this.broadcast(window.Casino.Protocol.Events.SOUND_TRIGGER, { type: 'error' });
          return;
        }
      }

      if (ui) ui.logDebug(`Server verified table successfully. Starting game handler...`, 'success');

      if (gameType === 'roulette' || gameType === 'elec_roulette') {
        this.runRouletteGame(player, tableId, bets, gameType === 'elec_roulette');
      } else if (gameType === 'craps' || gameType === 'bubble_craps') {
        this.runCrapsGame(player, tableId, action, bets, gameType === 'bubble_craps');
      } else if (gameType === 'slots') {
        this.runSlotsGame(player, tableId, payload.betAmount);
      } else if (gameType === 'blackjack' || gameType === 'elec_blackjack') {
        this.runBlackjackGame(player, tableId, payload.action, payload.betAmount, payload.playerCards, payload.dealerCards, gameType === 'elec_blackjack');
      } else if (gameType === 'ride_the_bus') {
        this.runRideTheBusGame(player, tableId, payload.action, payload.betAmount, payload.step, payload.guess, payload.history);
      } else if (gameType === 'three_card_poker') {
        this.runThreeCardPokerGame(player, tableId, payload.action, payload.betAmount, payload.playerCards, payload.dealerCards);
      } else if (gameType === 'baccarat' || gameType === 'elec_baccarat') {
        this.runBaccaratGame(player, tableId, payload.action, payload.betAmount, payload.bets, gameType === 'elec_baccarat');
      } else if (gameType === 'texas_holdem') {
        this.runTexasHoldemGame(player, tableId, payload.action, payload.betAmount);
      } else if (gameType === 'pai_gow') {
        this.runPaiGowGame(player, tableId, payload.action, payload.betAmount, payload.highHandIndices);
      } else if (gameType === 'sic_bo' || gameType === 'elec_sic_bo') {
        this.runSicBoGame(player, tableId, payload.action, payload.bets, gameType === 'elec_sic_bo');
      } else if (gameType === 'caribbean_stud') {
        this.runCaribbeanStudGame(player, tableId, payload.action, payload.betAmount);
      } else if (gameType === 'big_six') {
        this.runBigSixGame(player, tableId, payload.action, payload.bets);
      } else if (gameType === 'let_it_ride') {
        this.runLetItRideGame(player, tableId, payload.action, payload.betAmount);
      } else if (gameType === 'red_dog') {
        this.runRedDogGame(player, tableId, payload.action, payload.betAmount);
      } else if (gameType === 'spanish_21') {
        this.runSpanish21Game(player, tableId, payload.action, payload.betAmount, payload.playerCards, payload.dealerCards);
      } else if (gameType === 'casino_war') {
        this.runCasinoWarGame(player, tableId, payload.action, payload.betAmount);
      } else if (gameType === 'video_poker') {
        this.runVideoPokerGame(player, tableId, payload.action, payload.betAmount, payload.holdIndices);
      } else if (gameType === 'plinko') {
        this.runPlinkoGame(player, tableId, payload.betAmount);
      } else if (gameType === 'lottery') {
        this.runLotteryGame(player, tableId, payload.betAmount, payload.selectedNumbers);
      }
    }

    /* ==========================================================================
       ROULETTE RULES AND PAYOUT SIMULATOR
       ========================================================================== */
    runRouletteGame(player, tableId, bets, isElectronic = false) {
      // Calculate total bet amount
      let totalBet = bets.reduce((sum, b) => sum + b.amount, 0);

      // Verify player can afford it
      if (!this.economyManager.canAfford(totalBet)) return;

      // Deduct bet amount
      this.economyManager.deductChips(totalBet);

      // Spin the wheel: number 0-36
      const winningNumber = Math.floor(Math.random() * 37);

      // Define roulette color mappings
      const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      let winningColor = 'black';
      if (winningNumber === 0) winningColor = 'green';
      else if (reds.includes(winningNumber)) winningColor = 'red';

      let totalWin = 0;
      const details = [];

      // Calculate payouts
      bets.forEach(bet => {
        let isWin = false;
        let payoutRatio = 0;

        switch (bet.type) {
          case 'red':
            isWin = (winningColor === 'red');
            payoutRatio = 1;
            break;
          case 'black':
            isWin = (winningColor === 'black');
            payoutRatio = 1;
            break;
          case 'even':
            isWin = (winningNumber !== 0 && winningNumber % 2 === 0);
            payoutRatio = 1;
            break;
          case 'odd':
            isWin = (winningNumber !== 0 && winningNumber % 2 !== 0);
            payoutRatio = 1;
            break;
          case 'low': // 1-18
            isWin = (winningNumber >= 1 && winningNumber <= 18);
            payoutRatio = 1;
            break;
          case 'high': // 19-36
            isWin = (winningNumber >= 19 && winningNumber <= 36);
            payoutRatio = 1;
            break;
          case 'dozen1': // 1-12
            isWin = (winningNumber >= 1 && winningNumber <= 12);
            payoutRatio = 2;
            break;
          case 'dozen2': // 13-24
            isWin = (winningNumber >= 13 && winningNumber <= 24);
            payoutRatio = 2;
            break;
          case 'dozen3': // 25-36
            isWin = (winningNumber >= 25 && winningNumber <= 36);
            payoutRatio = 2;
            break;
          case 'num_col1':
            isWin = (winningNumber !== 0 && winningNumber % 3 === 1);
            payoutRatio = 2;
            break;
          case 'num_col2':
            isWin = (winningNumber !== 0 && winningNumber % 3 === 2);
            payoutRatio = 2;
            break;
          case 'num_col3':
            isWin = (winningNumber !== 0 && winningNumber % 3 === 0);
            payoutRatio = 2;
            break;
          default:
            // Single numbers (e.g. 'num_17', 'num_0')
            if (bet.type.startsWith('num_')) {
              const numVal = parseInt(bet.type.split('_')[1]);
              isWin = (winningNumber === numVal);
              payoutRatio = 35;
            }
            break;
        }

        if (isWin) {
          // Payout includes original bet returned
          const winAmount = bet.amount * (payoutRatio + 1);
          totalWin += winAmount;
          details.push({ bet: bet.type, won: true, payout: winAmount });
        } else {
          details.push({ bet: bet.type, won: false, payout: 0 });
        }
      });

      // Credit player
      if (totalWin > 0) {
        this.economyManager.addChips(totalWin);
      }

      this.sendPayout(player, isElectronic ? 'elec_roulette' : 'roulette', totalWin - totalBet, totalWin, {
        tableId: tableId,
        winningNumber: winningNumber,
        winningColor: winningColor,
        totalBet: totalBet,
        details: details
      });
    }

    /* ==========================================================================
       CRAPS RULES AND PAYOUT SIMULATOR
       ========================================================================== */
    runCrapsGame(player, tableId, action, bets, isElectronic = false) {
      // 1. Get or create Craps board state
      if (!this.crapsState.has(tableId)) {
        this.crapsState.set(tableId, { point: null, activeBets: [], rolledNumbers: [] });
      }
      const boardState = this.crapsState.get(tableId);
      if (!boardState.rolledNumbers) boardState.rolledNumbers = [];

      // Handle roll action
      if (action === 'roll') {
        // Roll dice
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        const total = die1 + die2;

        let totalWin = 0;
        let totalBetLoss = 0;
        const newActiveBets = [];
        const payoutDetails = [];

        // Add new bets if player is passing them in
        if (bets && bets.length > 0) {
          let extraBetTotal = 0;
          bets.forEach(b => {
            let cost = b.amount;
            if (b.type.startsWith('buy_')) {
              cost += Math.max(1, Math.floor(b.amount * 0.05)); // 5% Vig, minimum 1 chip
            }
            extraBetTotal += cost;
          });

          if (!this.economyManager.canAfford(extraBetTotal)) return;

          this.economyManager.deductChips(extraBetTotal);
          
          bets.forEach(b => {
            boardState.activeBets.push({
              type: b.type,
              amount: b.amount
            });
          });
        }

        const isComeOut = (boardState.point === null);
        let nextPoint = boardState.point;

        // Resolve each bet according to Craps rules
        boardState.activeBets.forEach(bet => {
          let resolved = false;
          let won = false;
          let resolved_push = false;
          let payoutRatio = 1; // standard is 1:1

          switch (bet.type) {
            case 'pass_line':
              if (isComeOut) {
                if (total === 7 || total === 11) {
                  resolved = true;
                  won = true;
                } else if (total === 2 || total === 3 || total === 12) {
                  resolved = true;
                  won = false;
                }
              } else {
                // Point is set
                if (total === boardState.point) {
                  resolved = true;
                  won = true;
                } else if (total === 7) {
                  resolved = true;
                  won = false;
                }
              }
              break;

            case 'dont_pass':
              if (isComeOut) {
                if (total === 2 || total === 3) {
                  resolved = true;
                  won = true;
                } else if (total === 12) {
                  resolved = true; // Bar 12 (Push)
                  resolved_push = true; 
                } else if (total === 7 || total === 11) {
                  resolved = true;
                  won = false;
                }
              } else {
                if (total === 7) {
                  resolved = true;
                  won = true;
                } else if (total === boardState.point) {
                  resolved = true;
                  won = false;
                }
              }
              break;

            case 'field': // Field is a single roll bet
              resolved = true;
              if ([3, 4, 9, 10, 11].includes(total)) {
                won = true;
                payoutRatio = 1;
              } else if (total === 2) {
                won = true;
                payoutRatio = 2; // Double payout on 2
              } else if (total === 12) {
                won = true;
                payoutRatio = 3; // Triple payout on 12
              } else {
                won = false;
              }
              break;

            // Place Bets on numbers (4, 5, 6, 8, 9, 10)
            case 'place_4':
              if (total === 4) { resolved = true; won = true; payoutRatio = 9/5; }
              else if (total === 7) { resolved = true; won = false; }
              break;
            case 'place_5':
              if (total === 5) { resolved = true; won = true; payoutRatio = 7/5; }
              else if (total === 7) { resolved = true; won = false; }
              break;
            case 'place_6':
              if (total === 6) { resolved = true; won = true; payoutRatio = 7/6; }
              else if (total === 7) { resolved = true; won = false; }
              break;
            case 'place_8':
              if (total === 8) { resolved = true; won = true; payoutRatio = 7/6; }
              else if (total === 7) { resolved = true; won = false; }
              break;
            case 'place_9':
              if (total === 9) { resolved = true; won = true; payoutRatio = 7/5; }
              else if (total === 7) { resolved = true; won = false; }
              break;
            case 'place_10':
              if (total === 10) { resolved = true; won = true; payoutRatio = 9/5; }
              else if (total === 7) { resolved = true; won = false; }
              break;

            // Buy Bets on numbers (4, 5, 6, 8, 9, 10) - True Odds (Vig paid on placement)
            case 'buy_4':
              if (total === 4) { resolved = true; won = true; payoutRatio = 2; }
              else if (total === 7) { resolved = true; won = false; }
              break;
            case 'buy_5':
              if (total === 5) { resolved = true; won = true; payoutRatio = 1.5; }
              else if (total === 7) { resolved = true; won = false; }
              break;
            case 'buy_6':
              if (total === 6) { resolved = true; won = true; payoutRatio = 1.2; }
              else if (total === 7) { resolved = true; won = false; }
              break;
            case 'buy_8':
              if (total === 8) { resolved = true; won = true; payoutRatio = 1.2; }
              else if (total === 7) { resolved = true; won = false; }
              break;
            case 'buy_9':
              if (total === 9) { resolved = true; won = true; payoutRatio = 1.5; }
              else if (total === 7) { resolved = true; won = false; }
              break;
            case 'buy_10':
              if (total === 10) { resolved = true; won = true; payoutRatio = 2; }
              else if (total === 7) { resolved = true; won = false; }
              break;

            // Proposition Bets (Single Roll)
            case 'prop_yo11':
              resolved = true;
              won = (total === 11);
              payoutRatio = 15;
              break;
            case 'prop_craps3':
              resolved = true;
              won = (total === 3);
              payoutRatio = 15;
              break;
            case 'prop_craps2':
              resolved = true;
              won = (total === 2);
              payoutRatio = 30;
              break;
            case 'prop_craps12':
              resolved = true;
              won = (total === 12);
              payoutRatio = 30;
              break;
            case 'prop_any7':
              resolved = true;
              won = (total === 7);
              payoutRatio = 4;
              break;

            // ATS (All, Tall, Small) side bets
            case 'prop_small':
              if (total === 7) {
                resolved = true;
                won = false;
              } else {
                const smallSet = [2, 3, 4, 5, 6];
                const hasSmall = smallSet.every(n => boardState.rolledNumbers.includes(n) || n === total);
                if (hasSmall) {
                  resolved = true;
                  won = true;
                  payoutRatio = 34; // pays 34:1
                }
              }
              break;

            case 'prop_big':
              if (total === 7) {
                resolved = true;
                won = false;
              } else {
                const bigSet = [8, 9, 10, 11, 12];
                const hasBig = bigSet.every(n => boardState.rolledNumbers.includes(n) || n === total);
                if (hasBig) {
                  resolved = true;
                  won = true;
                  payoutRatio = 34; // pays 34:1
                }
              }
              break;

            case 'prop_all':
              if (total === 7) {
                resolved = true;
                won = false;
              } else {
                const allSet = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
                const hasAll = allSet.every(n => boardState.rolledNumbers.includes(n) || n === total);
                if (hasAll) {
                  resolved = true;
                  won = true;
                  payoutRatio = 174; // pays 174:1
                }
              }
              break;
          }

          if (resolved) {
            if (resolved_push) {
              // Push: return original bet amount
              totalWin += bet.amount;
              payoutDetails.push({ type: bet.type, won: false, amount: bet.amount, payout: bet.amount, isPush: true });
            } else if (won) {
              const winAmount = Math.floor(bet.amount * (payoutRatio + 1));
              totalWin += winAmount;
              payoutDetails.push({ type: bet.type, won: true, amount: bet.amount, payout: winAmount });
            } else {
              totalBetLoss += bet.amount;
              payoutDetails.push({ type: bet.type, won: false, amount: bet.amount, payout: 0 });
            }
          } else {
            // Keep bet active for next roll
            newActiveBets.push(bet);
          }
        });

        // Update active bets
        boardState.activeBets = newActiveBets;

        // Update ATS Rolled numbers list
        if (total === 7) {
          boardState.rolledNumbers = [];
        } else if ([2, 3, 4, 5, 6, 8, 9, 10, 11, 12].includes(total)) {
          if (!boardState.rolledNumbers.includes(total)) {
            boardState.rolledNumbers.push(total);
          }
        }

        // Update Point State
        if (isComeOut) {
          if ([4, 5, 6, 8, 9, 10].includes(total)) {
            nextPoint = total; // Point established!
          }
        } else {
          if (total === boardState.point || total === 7) {
            nextPoint = null; // Point resolved
          }
        }
        boardState.point = nextPoint;

        // Apply payouts
        if (totalWin > 0) {
          this.economyManager.addChips(totalWin);
        }

        const resolvedBetTotal = payoutDetails.reduce((sum, d) => sum + d.amount, 0);
        const netPayout = totalWin - resolvedBetTotal;

        this.sendPayout(player, isElectronic ? 'bubble_craps' : 'craps', netPayout, totalWin, {
          tableId: tableId,
          die1: die1,
          die2: die2,
          total: total,
          point: boardState.point,
          isComeOut: isComeOut,
          totalBetLoss: totalBetLoss,
          payoutDetails: payoutDetails,
          activeBets: boardState.activeBets,
          rolledNumbers: boardState.rolledNumbers
        });
      }
    }

    /* ==========================================================================
       SLOTS RULES AND PAYOUT SIMULATOR
       ========================================================================== */
    runSlotsGame(player, tableId, betAmount) {
      const ui = window.Casino.clientInstance && window.Casino.clientInstance.minigameUI;
      if (ui) {
        ui.logDebug(`Server runSlotsGame: betAmount=${betAmount}, bankroll=${this.economyManager.getChips()}`, 'info');
      }

      if (!this.economyManager.canAfford(betAmount)) {
        if (ui) ui.logDebug(`Server runSlotsGame error: Insufficient bankroll funds!`, 'error');
        return;
      }
      this.economyManager.deductChips(betAmount);

      const symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
      const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
      const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
      const reel3 = symbols[Math.floor(Math.random() * symbols.length)];

      let isWin = false;
      let payoutRatio = 0;

      if (reel1 === reel2 && reel2 === reel3) {
        isWin = true;
        if (reel1 === '7️⃣') payoutRatio = 80;
        else if (reel1 === '💎') payoutRatio = 40;
        else if (reel1 === '🔔') payoutRatio = 20;
        else payoutRatio = 8; // fruits
      } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
        isWin = true;
        payoutRatio = 1; // 2 matching
      }

      let totalWin = 0;
      if (isWin) {
        totalWin = betAmount * (payoutRatio + 1);
        this.economyManager.addChips(totalWin);
      }

      if (ui) {
        ui.logDebug(`Server slots spin complete: reels=[${reel1},${reel2},${reel3}], payoutRatio=${payoutRatio}, won=${totalWin}`, 'success');
      }

      this.sendPayout(player, 'slots', totalWin - betAmount, totalWin, {
        tableId: tableId,
        reels: [reel1, reel2, reel3],
        betAmount: betAmount
      });
    }

    // Helper to send data to callback
    broadcast(event, payload) {
      console.log(`[Server:GameSim] Broadcast Event: "${event}"`, payload);
      if (this.onBroadcast) {
        this.onBroadcast(event, payload);
      }
    }

    handleHireEmployee(player, payload) {
      const { role } = payload;

      // Verify unlocked state for research-gated roles
      if (['chef', 'scientist', 'manager', 'security', 'tech_support', 'entertainer'].includes(role)) {
        if (!this.unlockedTechs.includes(role)) {
          console.warn(`[Server:GameSim] Hiring employee "${role}" rejected: Role not unlocked yet.`);
          return;
        }
      }

      let cost = 3000;
      if (role === 'waitress' || role === 'chef' || role === 'tech_support' || role === 'stocker') cost = 4000;
      else if (role === 'scientist' || role === 'security') cost = 5000;
      else if (role === 'manager' || role === 'entertainer') cost = 6000;

      if (!this.economyManager.canAfford(cost)) {
        const ui = window.Casino.clientInstance && window.Casino.clientInstance.minigameUI;
        if (ui) ui.logDebug(`Hiring failed: Insufficient funds for role "${role}"`, 'error');
        return;
      }

      this.economyManager.deductChips(cost);
      this.recordDayStat('hiring', -cost);

      const id = `employee_${role}_${this.nextEmployeeId++}`;
      // Spawn employee near entrance
      const employee = new window.Casino.EmployeeAI(id, role, this.gridManager.entranceX, this.gridManager.entranceY);
      this.employees.set(id, employee);

      console.log(`[Server:GameSim] Hired employee "${id}" for cost: ${cost}`);
      
      const ui = window.Casino.clientInstance && window.Casino.clientInstance.minigameUI;
      if (ui) ui.logDebug(`Hired employee: role=${role.toUpperCase()} (ID: ${id})`, 'success');

      this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
    }

    handleRefillAmenity(player, payload) {
      const { objectId } = payload;
      const obj = this.gridManager.placedObjects.get(objectId);
      if (obj && obj.stock !== undefined && obj.stock !== null) {
        obj.stock = obj.maxStock;
        obj.isOutOfStock = false;
        console.log(`[Server:GameSim] Player refilled amenity "${obj.id}"`);
        this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
      }
    }

    handleGrabAmenityItem(player, payload) {
      const { objectId } = payload;
      const obj = this.gridManager.placedObjects.get(objectId);
      if (obj && obj.stock !== undefined && obj.stock !== null && obj.stock > 0) {
        if (['bar', 'soda_machine', 'coffee_maker', 'bubble_tea'].includes(obj.type)) {
          player.holdingDrink = true;
          player.holdingMeal = false;
          obj.stock--;
          obj.isOutOfStock = obj.stock === 0;
          this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
        } else if (['restaurant', 'vending_machine', 'candy_dispenser', 'popcorn_cart', 'pizza_oven', 'ice_cream'].includes(obj.type)) {
          player.holdingMeal = true;
          player.holdingDrink = false;
          obj.stock--;
          obj.isOutOfStock = obj.stock === 0;
          this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
        }
      }
    }

    handleHandNeeds(player, payload) {
      const { guestId, itemType } = payload;
      const guest = this.guests.get(guestId);
      if (guest && guest.state !== 'LEAVING') {
        if (itemType === 'drink' && player.holdingDrink) {
          guest.thirst = 100;
          player.holdingDrink = false;
          this.economyManager.addChips(20); // Tip!
          this.recordDayStat('tips', 20);
          this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
        } else if (itemType === 'meal' && player.holdingMeal) {
          guest.hunger = 100;
          player.holdingMeal = false;
          this.economyManager.addChips(20); // Tip!
          this.recordDayStat('tips', 20);
          this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
        }
      }
    }

    handleSetPlayerName(player, payload) {
      if (player && payload && payload.name) {
        player.name = payload.name;
        this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
      }
    }

    getFullState() {
      const serializedPlayers = {};
      for (const [id, p] of this.players.entries()) {
        serializedPlayers[id] = p.serialize();
      }

      const serializedGuests = {};
      for (const [id, g] of this.guests.entries()) {
        serializedGuests[id] = g.serialize();
      }

      const serializedEmployees = {};
      for (const [id, emp] of this.employees.entries()) {
        serializedEmployees[id] = emp.serialize();
      }

      const serializedCrapsState = {};
      for (const [tableId, stateVal] of this.crapsState.entries()) {
        serializedCrapsState[tableId] = stateVal;
      }

      return {
        grid: this.gridManager.serialize(),
        economy: this.economyManager.serialize(),
        players: serializedPlayers,
        guests: serializedGuests,
        employees: serializedEmployees, // Include employees
        dirtyTiles: this.dirtyTiles, // Include dirty tiles
        sizeLevel: this.sizeLevel,
        happiness: this.happiness,
        maxGuests: this.guestMax,
        unlockedTechs: this.unlockedTechs,
        researchPoints: this.researchPoints,
        starRating: this.starRating,
        currentDay: this.currentDay,
        dayTimer: this.dayTimer,
        dayRevenue: this.dayRevenue,
        dayExpenses: this.dayExpenses,
        dayStats: this.dayStats,
        crapsState: serializedCrapsState,
        isGamblerMode: !!this.isGamblerMode
      };
    }

    recordDayStat(source, amount) {
      if (!this.dayStats) this.dayStats = {};
      if (!this.dayStats[source]) {
        this.dayStats[source] = { earned: 0, lost: 0 };
      }
      if (amount > 0) {
        this.dayStats[source].earned += amount;
        this.dayRevenue += amount;
      } else {
        this.dayStats[source].lost += Math.abs(amount);
        this.dayExpenses += Math.abs(amount);
      }
    }

    endCurrentDay() {
      // Compile final day report
      const finalReport = {
        day: this.currentDay,
        revenue: this.dayRevenue,
        expenses: this.dayExpenses,
        stats: this.dayStats,
        playerGamblingLosses: this.playerGamblingLosses
      };

      // Reset all guests (people-wise reset)
      this.guests.clear();

      // Clear card session states
      this.blackjackSessions.clear();
      this.rideTheBusSessions.clear();
      this.threeCardPokerSessions.clear();
      this.baccaratSessions.clear();
      this.texasHoldemSessions.clear();
      this.paiGowSessions.clear();
      this.caribbeanStudSessions.clear();
      this.letItRideSessions.clear();
      this.redDogSessions.clear();
      this.spanish21Sessions.clear();
      this.casinoWarSessions.clear();
      this.videoPokerSessions.clear();

      // Clear Craps active states
      for (const [tableId, state] of this.crapsState.entries()) {
        state.point = null;
        state.activeBets = [];
        state.rolledNumbers = [];
      }

      // Broadcast DAY_REPORT
      this.broadcast(window.Casino.Protocol.Events.DAY_REPORT, finalReport);

      // Increment day and reset timer/counters
      this.currentDay++;
      this.dayTimer = 180;
      this.dayRevenue = 0;
      this.dayExpenses = 0;
      this.dayStats = {};
      this.playerGamblingLosses = 0;

      // Broadcast full state
      this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
    }

    loadState(state) {
      if (!state) return;

      this.sizeLevel = state.sizeLevel || 1;
      this.isGamblerMode = !!state.isGamblerMode;
      this.happiness = state.happiness || 1.0;
      this.guestMax = state.maxGuests || 10;
      this.unlockedTechs = state.unlockedTechs || [];
      this.researchPoints = state.researchPoints || 0;
      this.starRating = state.starRating || 1.0;
      
      this.currentDay = state.currentDay || 1;
      this.dayTimer = state.dayTimer !== undefined ? state.dayTimer : 180;
      this.dayRevenue = 0;
      this.dayExpenses = 0;
      this.dayStats = {};

      this.crapsState.clear();

      // Clear players, employees, guests
      this.players.clear();
      this.employees.clear();
      this.guests.clear();

      // If legacy save containing full layout
      if (state.grid) {
        this.gridManager.deserialize(state.grid);
        if (state.economy) this.economyManager.deserialize(state.economy);
        this.dirtyTiles = state.dirtyTiles || [];
        
        if (state.crapsState) {
          for (const [tableId, val] of Object.entries(state.crapsState)) {
            this.crapsState.set(tableId, val);
          }
        }
      } else {
        // Progress-only save: construct clean grid matching sizeLevel
        let cols = 24;
        let rows = 16;
        if (this.sizeLevel === 2) {
          cols = 30;
          rows = 20;
        } else if (this.sizeLevel === 3) {
          cols = 36;
          rows = 24;
        }
        this.gridManager = new window.Casino.GridManager(cols, rows);
        this.economyManager.chips = state.chips || 5000;
        this.dirtyTiles = [];
      }

      const entranceX = this.gridManager.entranceX;
      const entranceY = this.gridManager.entranceY;

      // Re-populate players (fallback to 'player_local' if empty progression load)
      if (state.players && Object.keys(state.players).length > 0) {
        for (const [id, pData] of Object.entries(state.players)) {
          const p = new window.Casino.PlayerEntity(id, entranceX, entranceY);
          Object.defineProperty(p, 'chips', {
            get: () => this.economyManager.getChips(),
            set: (val) => { this.economyManager.chips = val; },
            configurable: true,
            enumerable: true
          });
          this.players.set(id, p);
        }
      } else {
        const p = new window.Casino.PlayerEntity('player_local', entranceX, entranceY);
        Object.defineProperty(p, 'chips', {
          get: () => this.economyManager.getChips(),
          set: (val) => { this.economyManager.chips = val; },
          configurable: true,
          enumerable: true
        });
        this.players.set('player_local', p);
      }
      
      if (state.employees) {
        for (const [id, empData] of Object.entries(state.employees)) {
          const emp = new window.Casino.EmployeeAI(id, empData.role, entranceX, entranceY);
          emp.state = 'WANDERING';
          this.employees.set(id, emp);
        }
      }

      if (state.guests) {
        for (const [id, gData] of Object.entries(state.guests)) {
          const g = new window.Casino.GuestAI(id, entranceX, entranceY);
          g.chips = gData.chips || 500;
          g.spendingLimit = gData.spendingLimit || 500;
          g.happiness = gData.happiness || 1.0;
          g.entertainment = gData.entertainment || 100;
          g.hunger = gData.hunger || 0;
          g.drunk = gData.drunk || 0;
          g.state = 'ENTERING';
          this.guests.set(id, g);
        }
      }
    }

    getOtherBlackjackPlayers(playerId, tableId) {
      const otherPlayers = [];
      for (const [pId, sess] of this.blackjackSessions.entries()) {
        if (sess.tableId === tableId && pId !== playerId && sess.state === 'playing') {
          otherPlayers.push({
            playerId: pId,
            playerHand: sess.playerHand,
            isSplit: sess.isSplit,
            playerHand1: sess.playerHand1,
            playerHand2: sess.playerHand2,
            state: sess.state
          });
        }
      }
      return otherPlayers;
    }

    getOtherPlayersAtTable(playerId, tableId) {
      const otherPlayers = [];
      for (const [pId, p] of this.players.entries()) {
        if (pId !== playerId && p.interactingObjectId === tableId) {
          let handInfo = {};
          
          const bjSess = this.blackjackSessions.get(pId);
          if (bjSess && bjSess.tableId === tableId) {
            handInfo = {
              gameType: 'blackjack',
              state: bjSess.state,
              isSplit: bjSess.isSplit,
              playerHand: bjSess.playerHand,
              playerHand1: bjSess.playerHand1,
              playerHand2: bjSess.playerHand2,
              betAmount: bjSess.betAmount
            };
          }
          
          const rtbSess = this.rideTheBusSessions.get(pId);
          if (rtbSess && rtbSess.tableId === tableId) {
            handInfo = {
              gameType: 'ride_the_bus',
              state: rtbSess.state,
              step: rtbSess.step,
              betAmount: rtbSess.betAmount
            };
          }

          otherPlayers.push({
            playerId: pId,
            ...handInfo
          });
        }
      }
      return otherPlayers;
    }

    getSerializedDelta() {
      // Send smaller snapshot of entities and economy
      const serializedGuests = {};
      for (const [id, g] of this.guests.entries()) {
        serializedGuests[id] = g.serialize(); // Serialize all properties
      }

      const serializedEmployees = {};
      for (const [id, emp] of this.employees.entries()) {
        serializedEmployees[id] = emp.serialize();
      }

      // Sync guest occupant lists on tables & dealer seat assignments
      const objects = Array.from(this.gridManager.placedObjects.values()).map(o => ({
        id: o.id,
        guests: o.guests,
        dealerSeat: o.dealerSeat ? { rx: o.dealerSeat.rx, ry: o.dealerSeat.ry, employeeId: o.dealerSeat.employeeId } : null,
        eps: o.eps || 0
      }));

      return {
        economy: this.economyManager.serialize(),
        guests: serializedGuests,
        employees: serializedEmployees, // Include employees
        dirtyTiles: this.dirtyTiles, // Include dirty tiles
        objects: objects,
        sizeLevel: this.sizeLevel,
        happiness: this.happiness,
        maxGuests: this.guestMax,
        unlockedTechs: this.unlockedTechs,
        researchPoints: this.researchPoints,
        starRating: this.starRating,
        currentDay: this.currentDay,
        dayTimer: this.dayTimer
      };
    }
    updateHappiness() {
      // Base rating starts at 0.50 (50%)
      let rating = 0.50;

      let barCount = 0;
      let restaurantCount = 0;
      let hasRoulette = false;
      let hasCraps = false;
      let hasSlots = false;

      for (const obj of this.gridManager.placedObjects.values()) {
        if (obj.type === 'bar') barCount++;
        else if (obj.type === 'restaurant') restaurantCount++;
        else if (obj.type === 'roulette') hasRoulette = true;
        else if (obj.type === 'craps') hasCraps = true;
        else if (obj.type === 'slots') hasSlots = true;
      }

      // Placed Cocktail Bars: +15% happiness each, Restaurant: +25% happiness each
      rating += barCount * 0.15 + restaurantCount * 0.25;

      // Variety modifier: +10% for Slots, +15% for Roulette, +15% for Craps
      if (hasSlots) rating += 0.10;
      if (hasRoulette) rating += 0.15;
      if (hasCraps) rating += 0.15;

      // Space modifier: +10% for Level 2, +20% for Level 3
      if (this.sizeLevel === 2) rating += 0.10;
      else if (this.sizeLevel === 3) rating += 0.20;

      // Waiting guests penalty: check if we have guests in WANDERING state
      let wanderingCount = 0;
      for (const guest of this.guests.values()) {
        if (guest.state === 'WANDERING') wanderingCount++;
      }
      rating -= wanderingCount * 0.04;

      // Clamp happiness between 0.10 (10%) and 1.0 (100%)
      this.happiness = Math.max(0.10, Math.min(1.0, rating));
    }

    updateStarRating() {
      if (this.departureHistory.length === 0) {
        this.starRating = 4.0;
        return;
      }
      const sum = this.departureHistory.reduce((s, h) => s + h, 0);
      const avg = sum / this.departureHistory.length;
      this.starRating = parseFloat((1.0 + (avg / 100.0) * 4.0).toFixed(1));
    }

    handleUpgradeSize(player) {
      if (this.sizeLevel >= 3) return;

      const nextLevel = this.sizeLevel + 1;
      const cost = this.upgradeCosts[this.sizeLevel];

      if (!this.economyManager.canAfford(cost)) return;

      this.economyManager.deductChips(cost);
      this.recordDayStat('expansion', -cost);
      this.sizeLevel = nextLevel;

      // Calculate new dimensions
      let newCols = 24;
      let newRows = 16;
      if (this.sizeLevel === 2) {
        newCols = 30;
        newRows = 20;
      } else if (this.sizeLevel === 3) {
        newCols = 36;
        newRows = 24;
      }

      // Save old objects
      const oldObjects = Array.from(this.gridManager.placedObjects.values());

      // Re-instantiate GridManager with new size
      this.gridManager = new window.Casino.GridManager(newCols, newRows);

      // Preserve nextObjectId counter to prevent overwriting old objects
      let maxId = 0;
      oldObjects.forEach(obj => {
        const num = parseInt(obj.id.replace('obj_', ''), 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      });
      this.gridManager.nextObjectId = maxId + 1;

      // Re-place all objects on the expanded grid
      oldObjects.forEach(obj => {
        // Clear guest occupancy states safely
        obj.guests = [];
        if (obj.seats) {
          obj.seats.forEach(s => s.guestId = null);
        }
        if (obj.dealerSeat) {
          obj.dealerSeat.employeeId = null;
        }
        
        // Mark cells occupied
        this.gridManager.placedObjects.set(obj.id, obj);
        for (let y = obj.gridY; y < obj.gridY + obj.height; y++) {
          for (let x = obj.gridX; x < obj.gridX + obj.width; x++) {
            if (this.gridManager.isValidCell(x, y)) {
              this.gridManager.grid[y][x] = obj.id;
            }
          }
        }
      });

      // Reset all guests and employees to prevent stuck pathfinding/seating references
      for (const guest of this.guests.values()) {
        if (guest.state === 'GAMBLING' || guest.state === 'WALKING') {
          guest.releaseAllHeldSeats(this.gridManager);
          guest.state = 'WANDERING';
          guest.wanderTimer = 500;
          guest.path = null;
          guest.targetObjectId = null;
        }
      }
      for (const employee of this.employees.values()) {
        if (employee.state === 'WORKING' || employee.state === 'WALKING') {
          employee.state = 'WANDERING';
          employee.wanderTimer = 500;
          employee.path = null;
          employee.assignedSeatIndex = null;
          employee.targetObjectId = null;
        }
      }

      // Broadcast size upgraded event
      this.broadcast(window.Casino.Protocol.Events.SIZE_UPGRADED, {
        cols: newCols,
        rows: newRows,
        sizeLevel: this.sizeLevel,
        chips: this.economyManager.getChips()
      });

      // Force a full state sync to refresh client caches
      this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
    }

    handleUpgradeObject(player, payload) {
      const { objectId, upgradeType } = payload;
      const obj = this.gridManager.placedObjects.get(objectId);
      if (!obj) return;

      const Catalog = window.Casino.GameObjects.Catalog;
      const template = Catalog[obj.type];
      if (!template) return;

      if (!obj.upgradesCount) {
        obj.upgradesCount = { capacity: 0, income: 0 };
      }

      if (upgradeType === 'capacity') {
        const cost = Math.max(150, Math.floor(template.cost * 0.4)) + obj.upgradesCount.capacity * 100;
        if (!this.economyManager.canAfford(cost)) return;

        this.economyManager.deductChips(cost);
        this.recordDayStat('upgrades', -cost);
        obj.guestCapacity += 1;
        obj.upgradesCount.capacity += 1;

        // Re-generate seats with higher capacity
        obj.seats = this.generateSeatsForObject(obj.type, obj.gridX, obj.gridY, obj.width, obj.height, obj.guestCapacity);
        
        console.log(`[Server:GameSim] Upgraded capacity for "${obj.id}". New max: ${obj.guestCapacity}`);
      } else if (upgradeType === 'income') {
        const cost = Math.max(100, Math.floor(template.cost * 0.3)) + obj.upgradesCount.income * 100;
        if (!this.economyManager.canAfford(cost)) return;

        this.economyManager.deductChips(cost);
        this.recordDayStat('upgrades', -cost);
        obj.tickIncome = Math.floor(obj.tickIncome * 1.5);
        obj.upgradesCount.income += 1;

        console.log(`[Server:GameSim] Upgraded min bet for "${obj.id}". New tick income: ${obj.tickIncome}`);
      }

      // Broadcast full state because capacity changes structure list
      this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
    }

    handleSellObject(player, payload) {
      const { objectId } = payload;
      const obj = this.gridManager.placedObjects.get(objectId);
      if (!obj) return;

      const Catalog = window.Casino.GameObjects.Catalog;
      const template = Catalog[obj.type];
      
      let totalValue = template ? template.cost : obj.cost;
      if (obj.upgradesCount) {
        const capCost = Math.max(150, Math.floor((template ? template.cost : 500) * 0.4));
        const incCost = Math.max(100, Math.floor((template ? template.cost : 500) * 0.3));
        
        for (let i = 0; i < obj.upgradesCount.capacity; i++) {
          totalValue += capCost + i * 100;
        }
        for (let i = 0; i < obj.upgradesCount.income; i++) {
          totalValue += incCost + i * 100;
        }
      }

      const refund = Math.floor(totalValue * 0.5);

      // Evict any guests occupying seats
      if (obj.seats) {
        obj.seats.forEach(seat => {
          if (seat.guestId) {
            const guest = this.guests.get(seat.guestId);
            if (guest) {
              guest.targetObjectId = null;
              guest.state = 'WANDERING';
              guest.wanderTimer = 1000;
            }
          }
        });
      }

      this.gridManager.removeObject(obj.id);
      this.economyManager.addChips(refund);

      console.log(`[Server:GameSim] Sold object "${obj.id}" for refund: ${refund}`);

      // Broadcast full state
      this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
    }

    generateSeatsForObject(type, gridX, gridY, width, height, capacity) {
      const seats = [];
      const candidates = [];
      
      // Bottom side
      for (let x = 0; x < width; x++) candidates.push({ rx: x, ry: height });
      // Right side
      for (let y = 0; y < height; y++) candidates.push({ rx: width, ry: y });
      // Top side
      for (let x = 0; x < width; x++) candidates.push({ rx: x, ry: -1 });
      // Left side
      for (let y = 0; y < height; y++) candidates.push({ rx: -1, ry: y });

      for (let i = 0; i < capacity; i++) {
        const c = candidates[i % candidates.length];
        seats.push({
          rx: c.rx,
          ry: c.ry,
          guestId: null
        });
      }
      return seats;
    }

    /* ==========================================================================
       BLACKJACK, RIDE THE BUS, AND THREE CARD POKER CARD ENGINES
       ========================================================================== */
    createDeck() {
      const suits = ['♠', '♥', '♦', '♣'];
      const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
      const deck = [];
      for (const suit of suits) {
        for (const rank of ranks) {
          let score = parseInt(rank);
          if (['J','Q','K'].includes(rank)) score = 10;
          if (rank === 'A') score = 11;
          deck.push({ name: rank + suit, val: rank, suit, score });
        }
      }
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      return deck;
    }

    getHandScore(hand) {
      let score = hand.reduce((sum, c) => sum + c.score, 0);
      let aces = hand.filter(c => c.val === 'A').length;
      while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
      }
      return score;
    }

    runBlackjackGame(player, tableId, action, betAmount, clientPlayerCards, clientDealerCards, isElectronic = false) {
      let session = this.blackjackSessions.get(player.id);
      if (!session || action === 'deal') {
        const deck = this.createDeck();
        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];
        
        session = {
          tableId,
          betAmount,
          totalInvested: betAmount,
          deck,
          playerHand,
          dealerHand,
          state: 'playing',
          isSplit: false,
          playerHand1: null,
          playerHand2: null,
          activeHandIndex: 0
        };
        this.blackjackSessions.set(player.id, session);

        const pScore = this.getHandScore(playerHand);
        const dScore = this.getHandScore(dealerHand);
        if (pScore === 21) {
          session.state = 'resolved';
          let net = 0;
          if (dScore === 21) {
            net = 0;
            this.economyManager.addChips(betAmount);
          } else {
            net = Math.floor(betAmount * 1.5);
            this.economyManager.addChips(betAmount + net);
          }
          const totalWin = (dScore === 21) ? betAmount : (betAmount + net);
          this.sendPayout(player, isElectronic ? 'elec_blackjack' : 'blackjack', totalWin - session.totalInvested, totalWin, {
            playerHand,
            dealerHand,
            outcome: net === 0 ? 'push' : 'blackjack',
            state: 'resolved',
            otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
          });
          return;
        }
        
        this.economyManager.deductChips(betAmount);
        this.sendPayout(player, isElectronic ? 'elec_blackjack' : 'blackjack', -betAmount, 0, {
          playerHand,
          dealerHand: [dealerHand[0], { name: '?', val: '?', suit: '?', score: 0 }],
          state: 'playing',
          otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
        });
        return;
      }

      if (session.state === 'resolved') return;

      if (action === 'split') {
        if (session.isSplit || session.playerHand.length !== 2) return;
        const extraBet = session.betAmount;
        if (player.chips < extraBet) return;

        this.economyManager.deductChips(extraBet);
        session.isSplit = true;
        session.activeHandIndex = 0;
        session.totalInvested += extraBet;
        
        session.playerHand1 = [session.playerHand[0], session.deck.pop()];
        session.playerHand2 = [session.playerHand[1], session.deck.pop()];

        this.sendPayout(player, isElectronic ? 'elec_blackjack' : 'blackjack', -extraBet, 0, {
          isSplit: true,
          playerHand1: session.playerHand1,
          playerHand2: session.playerHand2,
          activeHandIndex: 0,
          playerHand: session.playerHand1,
          dealerHand: [session.dealerHand[0], { name: '?', val: '?', suit: '?', score: 0 }],
          state: 'playing',
          otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
        });
        return;
      }

      if (session.isSplit) {
        if (action === 'hit') {
          if (session.activeHandIndex === 0) {
            session.playerHand1.push(session.deck.pop());
            const score = this.getHandScore(session.playerHand1);
            if (score > 21) {
              session.activeHandIndex = 1;
            }
            this.sendPayout(player, isElectronic ? 'elec_blackjack' : 'blackjack', 0, 0, {
              isSplit: true,
              playerHand1: session.playerHand1,
              playerHand2: session.playerHand2,
              activeHandIndex: session.activeHandIndex,
              playerHand: session.activeHandIndex === 0 ? session.playerHand1 : session.playerHand2,
              dealerHand: [session.dealerHand[0], { name: '?', val: '?', suit: '?', score: 0 }],
              state: 'playing',
              otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
            });
          } else {
            session.playerHand2.push(session.deck.pop());
            const score = this.getHandScore(session.playerHand2);
            if (score > 21) {
              const score1 = this.getHandScore(session.playerHand1);
              if (score1 > 21) {
                session.state = 'resolved';
                this.sendPayout(player, isElectronic ? 'elec_blackjack' : 'blackjack', 0 - session.totalInvested, 0, {
                  isSplit: true,
                  playerHand1: session.playerHand1,
                  playerHand2: session.playerHand2,
                  activeHandIndex: 1,
                  playerHand: session.playerHand2,
                  dealerHand: session.dealerHand,
                  outcome: 'bust',
                  state: 'resolved',
                  otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
                });
              } else {
                this.resolveDealerBlackjack(player, session, isElectronic);
              }
            } else {
              this.sendPayout(player, isElectronic ? 'elec_blackjack' : 'blackjack', 0, 0, {
                isSplit: true,
                playerHand1: session.playerHand1,
                playerHand2: session.playerHand2,
                activeHandIndex: 1,
                playerHand: session.playerHand2,
                dealerHand: [session.dealerHand[0], { name: '?', val: '?', suit: '?', score: 0 }],
                state: 'playing',
                otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
              });
            }
          }
        } else if (action === 'double') {
          const extraBet = session.betAmount;
          if (player.chips < extraBet) return;
          
          this.economyManager.deductChips(extraBet);
          session.totalInvested += extraBet;
          
          if (session.activeHandIndex === 0) {
            session.playerHand1.push(session.deck.pop());
            session.activeHandIndex = 1;
            this.sendPayout(player, isElectronic ? 'elec_blackjack' : 'blackjack', -extraBet, 0, {
              isSplit: true,
              playerHand1: session.playerHand1,
              playerHand2: session.playerHand2,
              activeHandIndex: 1,
              playerHand: session.playerHand2,
              dealerHand: [session.dealerHand[0], { name: '?', val: '?', suit: '?', score: 0 }],
              state: 'playing',
              otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
            });
          } else {
            session.playerHand2.push(session.deck.pop());
            const score2 = this.getHandScore(session.playerHand2);
            const score1 = this.getHandScore(session.playerHand1);
            if (score2 > 21 && score1 > 21) {
              session.state = 'resolved';
              this.sendPayout(player, isElectronic ? 'elec_blackjack' : 'blackjack', 0 - session.totalInvested, 0, {
                isSplit: true,
                playerHand1: session.playerHand1,
                playerHand2: session.playerHand2,
                activeHandIndex: 1,
                playerHand: session.playerHand2,
                dealerHand: session.dealerHand,
                outcome: 'bust',
                state: 'resolved',
                otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
              });
            } else {
              this.resolveDealerBlackjack(player, session, isElectronic);
            }
          }
        } else if (action === 'stand') {
          if (session.activeHandIndex === 0) {
            session.activeHandIndex = 1;
            this.sendPayout(player, isElectronic ? 'elec_blackjack' : 'blackjack', 0, 0, {
              isSplit: true,
              playerHand1: session.playerHand1,
              playerHand2: session.playerHand2,
              activeHandIndex: 1,
              playerHand: session.playerHand2,
              dealerHand: [session.dealerHand[0], { name: '?', val: '?', suit: '?', score: 0 }],
              state: 'playing',
              otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
            });
          } else {
            this.resolveDealerBlackjack(player, session, isElectronic);
          }
        }
        return;
      }

      if (action === 'hit') {
        const card = session.deck.pop();
        session.playerHand.push(card);
        const score = this.getHandScore(session.playerHand);
        
        if (score > 21) {
          session.state = 'resolved';
          this.sendPayout(player, isElectronic ? 'elec_blackjack' : 'blackjack', 0 - session.totalInvested, 0, {
            playerHand: session.playerHand,
            dealerHand: session.dealerHand,
            outcome: 'bust',
            state: 'resolved',
            otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
          });
        } else {
          this.sendPayout(player, isElectronic ? 'elec_blackjack' : 'blackjack', 0, 0, {
            playerHand: session.playerHand,
            dealerHand: [session.dealerHand[0], { name: '?', val: '?', suit: '?', score: 0 }],
            state: 'playing',
            otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
          });
        }
      } else if (action === 'double') {
        const extraBet = session.betAmount;
        if (player.chips < extraBet) return;
        
        session.betAmount += extraBet;
        session.totalInvested += extraBet;
        this.economyManager.deductChips(extraBet);

        const card = session.deck.pop();
        session.playerHand.push(card);
        const score = this.getHandScore(session.playerHand);

        if (score > 21) {
          session.state = 'resolved';
          this.sendPayout(player, isElectronic ? 'elec_blackjack' : 'blackjack', 0 - session.totalInvested, 0, {
            playerHand: session.playerHand,
            dealerHand: session.dealerHand,
            outcome: 'bust',
            state: 'resolved',
            otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
          });
        } else {
          this.resolveDealerBlackjack(player, session, isElectronic);
        }
      } else if (action === 'stand') {
        this.resolveDealerBlackjack(player, session, isElectronic);
      }
    }

    resolveDealerBlackjack(player, session, isElectronic) {
      session.state = 'resolved';
      let dScore = this.getHandScore(session.dealerHand);
      while (dScore < 17) {
        session.dealerHand.push(session.deck.pop());
        dScore = this.getHandScore(session.dealerHand);
      }

      if (session.isSplit) {
        const score1 = this.getHandScore(session.playerHand1);
        const score2 = this.getHandScore(session.playerHand2);
        
        let win1 = 0;
        let out1 = 'lose';
        if (score1 <= 21) {
          if (dScore > 21 || score1 > dScore) {
            win1 = session.betAmount * 2;
            out1 = 'win';
          } else if (score1 === dScore) {
            win1 = session.betAmount;
            out1 = 'push';
          }
        } else {
          out1 = 'bust';
        }

        let win2 = 0;
        let out2 = 'lose';
        if (score2 <= 21) {
          if (dScore > 21 || score2 > dScore) {
            win2 = session.betAmount * 2;
            out2 = 'win';
          } else if (score2 === dScore) {
            win2 = session.betAmount;
            out2 = 'push';
          }
        } else {
          out2 = 'bust';
        }

        const totalWin = win1 + win2;
        this.economyManager.addChips(totalWin);
        
        const netWin = totalWin - session.totalInvested;
        this.sendPayout(player, isElectronic ? 'elec_blackjack' : 'blackjack', netWin, totalWin, {
          isSplit: true,
          playerHand1: session.playerHand1,
          playerHand2: session.playerHand2,
          activeHandIndex: 1,
          dealerHand: session.dealerHand,
          outcome: netWin > 0 ? 'win' : netWin === 0 ? 'push' : 'lose',
          state: 'resolved',
          otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
        });
        return;
      }

      const pScore = this.getHandScore(session.playerHand);
      let totalWin = 0;
      let outcome = '';

      if (dScore > 21) {
        totalWin = session.betAmount * 2;
        outcome = 'dealer_bust';
      } else if (pScore > dScore) {
        totalWin = session.betAmount * 2;
        outcome = 'win';
      } else if (pScore === dScore) {
        totalWin = session.betAmount;
        outcome = 'push';
      } else {
        totalWin = 0;
        outcome = 'lose';
      }

      this.economyManager.addChips(totalWin);
      this.sendPayout(player, isElectronic ? 'elec_blackjack' : 'blackjack', totalWin - session.totalInvested, totalWin, {
        playerHand: session.playerHand,
        dealerHand: session.dealerHand,
        outcome,
        state: 'resolved',
        otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
      });
    }

    runRideTheBusGame(player, tableId, action, betAmount, step, guess, history) {
      let session = this.rideTheBusSessions.get(player.id);
      
      if (action === 'cashout' && session) {
        session.state = 'resolved';
        let payoutMult = 1;
        if (session.step === 2) payoutMult = 1.5;
        if (session.step === 3) payoutMult = 3;
        if (session.step === 4) payoutMult = 6;
        
        const win = Math.floor(session.betAmount * payoutMult);
        this.economyManager.addChips(win);
        this.sendPayout(player, 'ride_the_bus', win - session.betAmount, win, {
          step: session.step,
          currentCard: session.history[session.history.length - 1],
          history: session.history,
          outcome: 'cashout',
          state: 'resolved'
        ,
          otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
        });
        return;
      }

      if (!session || action === 'deal') {
        const deck = this.createDeck();
        const card = deck.pop();
        session = {
          tableId,
          betAmount,
          deck,
          history: [card],
          step: 1,
          state: 'playing'
        };
        this.rideTheBusSessions.set(player.id, session);
        this.economyManager.deductChips(betAmount);

        this.sendPayout(player, 'ride_the_bus', -betAmount, 0, {
          step: 1,
          currentCard: card,
          history: session.history,
          state: 'playing'
        ,
          otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
        });
        return;
      }

      if (session.state === 'resolved') return;

      const nextCard = session.deck.pop();
      const prevCard = session.history[session.history.length - 1];
      let correct = false;

      const cardToVal = (c) => {
        const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        return ranks.indexOf(c.val);
      };

      const nextVal = cardToVal(nextCard);
      const prevVal = cardToVal(prevCard);

      if (session.step === 1) {
        const isRed = ['♥', '♦'].includes(nextCard.suit);
        correct = (guess === 'red' && isRed) || (guess === 'black' && !isRed);
      } else if (session.step === 2) {
        correct = (guess === 'higher' && nextVal > prevVal) ||
                  (guess === 'lower' && nextVal < prevVal);
      } else if (session.step === 3) {
        const firstCard = session.history[1];
        const secondCard = session.history[2];
        const v1 = cardToVal(firstCard);
        const v2 = cardToVal(secondCard);
        const minVal = Math.min(v1, v2);
        const maxVal = Math.max(v1, v2);

        if (nextVal === minVal || nextVal === maxVal) {
          correct = false;
        } else {
          const inBetween = nextVal > minVal && nextVal < maxVal;
          correct = (guess === 'between' && inBetween) || (guess === 'outside' && !inBetween);
        }
      } else if (session.step === 4) {
        correct = (guess === nextCard.suit);
      }

      session.history.push(nextCard);

      if (correct) {
        if (session.step === 4) {
          session.state = 'resolved';
          const win = session.betAmount * 15;
          this.economyManager.addChips(win);
          this.sendPayout(player, 'ride_the_bus', win - session.betAmount, win, {
            step: 4,
            currentCard: nextCard,
            history: session.history,
            outcome: 'win_bus',
            state: 'resolved'
          ,
          otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
        });
        } else {
          session.step++;
          this.sendPayout(player, 'ride_the_bus', 0, 0, {
            step: session.step,
            currentCard: nextCard,
            history: session.history,
            state: 'playing'
          ,
          otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
        });
        }
      } else {
        session.state = 'resolved';
        this.sendPayout(player, 'ride_the_bus', -session.betAmount, 0, {
          step: session.step,
          currentCard: nextCard,
          history: session.history,
          outcome: 'lose',
          state: 'resolved'
        ,
          otherPlayers: this.getOtherPlayersAtTable(player.id, session.tableId)
        });
      }
    }

    evaluateThreeCardHand(hand) {
      const suits = hand.map(c => c.suit);
      const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
      const vals = hand.map(c => ranks.indexOf(c.val)).sort((a,b) => a - b);
      
      const isFlush = suits[0] === suits[1] && suits[1] === suits[2];
      const isStraight = (vals[1] === vals[0] + 1 && vals[2] === vals[1] + 1) ||
                         (vals[0] === 0 && vals[1] === 1 && vals[2] === 12);
                         
      const isThreeOfAKind = hand[0].val === hand[1].val && hand[1].val === hand[2].val;
      const isPair = hand[0].val === hand[1].val || hand[1].val === hand[2].val || hand[0].val === hand[2].val;
      
      let type = 1;
      if (isPair) type = 2;
      if (isFlush) type = 3;
      if (isStraight) type = 4;
      if (isThreeOfAKind) type = 5;
      if (isStraight && isFlush) type = 6;
      
      return { type, vals };
    }

    compareThreeCardHands(h1, h2) {
      const e1 = this.evaluateThreeCardHand(h1);
      const e2 = this.evaluateThreeCardHand(h2);
      
      if (e1.type !== e2.type) return e1.type - e2.type;
      
      for (let i = 2; i >= 0; i--) {
        if (e1.vals[i] !== e2.vals[i]) return e1.vals[i] - e2.vals[i];
      }
      return 0;
    }

    runThreeCardPokerGame(player, tableId, action, betAmount, clientPlayerCards, clientDealerCards) {
      let session = this.threeCardPokerSessions.get(player.id);
      if (!session || action === 'deal') {
        const deck = this.createDeck();
        const playerHand = [deck.pop(), deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop(), deck.pop()];
        
        session = {
          tableId,
          anteBet: betAmount,
          totalInvested: betAmount,
          deck,
          playerHand,
          dealerHand,
          state: 'playing'
        };
        this.threeCardPokerSessions.set(player.id, session);
        this.economyManager.deductChips(betAmount);

        this.sendPayout(player, 'three_card_poker', -betAmount, 0, {
          playerHand,
          dealerHand: [{ name: '?', val: '?', suit: '?', score: 0 }, { name: '?', val: '?', suit: '?', score: 0 }, { name: '?', val: '?', suit: '?', score: 0 }],
          state: 'playing'
        });
        return;
      }

      if (session.state === 'resolved') return;

      if (action === 'fold') {
        session.state = 'resolved';
        this.sendPayout(player, 'three_card_poker', 0 - session.totalInvested, 0, {
          playerHand: session.playerHand,
          dealerHand: session.dealerHand,
          outcome: 'fold',
          state: 'resolved'
        });
      } else if (action === 'play') {
        const playBet = session.anteBet;
        if (player.chips < playBet) return;
        session.totalInvested += playBet;

        this.economyManager.deductChips(playBet);
        session.state = 'resolved';
        
        const dEval = this.evaluateThreeCardHand(session.dealerHand);
        const dealerQualifies = dEval.type > 1 || dEval.vals.includes(10) || dEval.vals.includes(11) || dEval.vals.includes(12);

        let net = 0;
        let outcome = '';

        if (!dealerQualifies) {
          // Ante wins 1:1, play bet pushes (returns 1x)
          net = session.anteBet * 2 + playBet;
          outcome = 'dealer_no_qualify';
        } else {
          const cmp = this.compareThreeCardHands(session.playerHand, session.dealerHand);
          if (cmp > 0) {
            // Both win 1:1
            net = (session.anteBet + playBet) * 2;
            outcome = 'win';
          } else if (cmp === 0) {
            // Push
            net = session.anteBet + playBet;
            outcome = 'push';
          } else {
            // Lose
            net = 0;
            outcome = 'lose';
          }
        }

        this.economyManager.addChips(net);
        const totalInvested = session.anteBet + playBet;
        this.sendPayout(player, 'three_card_poker', net - totalInvested, net, {
          playerHand: session.playerHand,
          dealerHand: session.dealerHand,
          outcome,
          state: 'resolved'
        });
      }
    }

    /* ==========================================================================
       BACCARAT / ELEC BACCARAT GAME ENGINE
       ========================================================================== */
    runBaccaratGame(player, tableId, action, betAmount, bets, isElectronic = false) {
      const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);
      if (!this.economyManager.canAfford(totalBet)) return;
      this.economyManager.deductChips(totalBet);

      const deck = this.createDeck();
      const playerHand = [deck.pop(), deck.pop()];
      const bankerHand = [deck.pop(), deck.pop()];

      const getVal = (c) => {
        if (['10','J','Q','K'].includes(c.val)) return 0;
        if (c.val === 'A') return 1;
        return parseInt(c.val);
      };

      let pSum = (getVal(playerHand[0]) + getVal(playerHand[1])) % 10;
      let bSum = (getVal(bankerHand[0]) + getVal(bankerHand[1])) % 10;

      // Natural check
      if (pSum < 8 && bSum < 8) {
        // Player draws on 0-5
        if (pSum <= 5) {
          const pCard = deck.pop();
          playerHand.push(pCard);
          pSum = (pSum + getVal(pCard)) % 10;
        }
        // Banker draws on 0-5
        if (bSum <= 5) {
          const bCard = deck.pop();
          bankerHand.push(bCard);
          bSum = (bSum + getVal(bCard)) % 10;
        }
      }

      let winningSide = 'tie';
      if (pSum > bSum) winningSide = 'player';
      else if (bSum > pSum) winningSide = 'banker';

      let totalWin = 0;
      const details = [];
      bets.forEach(b => {
        let win = 0;
        if (b.type === winningSide) {
          if (b.type === 'player') win = b.amount * 2;
          else if (b.type === 'banker') win = Math.floor(b.amount * 1.95);
          else if (b.type === 'tie') win = b.amount * 9;
          totalWin += win;
          details.push({ type: b.type, won: true, payout: win });
        } else {
          details.push({ type: b.type, won: false, payout: 0 });
        }
      });

      this.economyManager.addChips(totalWin);
      this.sendPayout(player, isElectronic ? 'elec_baccarat' : 'baccarat', totalWin - totalBet, totalWin, {
        playerHand,
        bankerHand,
        pSum,
        bSum,
        winningSide,
        details
      });
    }

    /* ==========================================================================
       TEXAS HOLD'EM BONUS GAME ENGINE
       ========================================================================== */
    runTexasHoldemGame(player, tableId, action, betAmount) {
      let session = this.texasHoldemSessions.get(player.id);
      if (!session || action === 'deal') {
        if (!this.economyManager.canAfford(betAmount)) return;
        this.economyManager.deductChips(betAmount);

        const deck = this.createDeck();
        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];
        const community = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];

        session = {
          tableId,
          anteBet: betAmount,
          deck,
          playerHand,
          dealerHand,
          community,
          state: 'flop',
          revealedCommunity: []
        };
        this.texasHoldemSessions.set(player.id, session);

        this.sendPayout(player, 'texas_holdem', -betAmount, 0, {
          playerHand,
          dealerHand: [{ name: '?', val: '?', suit: '?' }, { name: '?', val: '?', suit: '?' }],
          community: [{ name: '?', val: '?', suit: '?' }, { name: '?', val: '?', suit: '?' }, { name: '?', val: '?', suit: '?' }, { name: '?', val: '?', suit: '?' }, { name: '?', val: '?', suit: '?' }],
          state: 'flop'
        });
        return;
      }

      if (session.state === 'flop' && action === 'flop') {
        session.revealedCommunity = [session.community[0], session.community[1], session.community[2]];
        session.state = 'turn';
        this.sendPayout(player, 'texas_holdem', 0, 0, {
          playerHand: session.playerHand,
          dealerHand: [{ name: '?', val: '?', suit: '?' }, { name: '?', val: '?', suit: '?' }],
          community: [...session.revealedCommunity, { name: '?', val: '?', suit: '?' }, { name: '?', val: '?', suit: '?' }],
          state: 'turn'
        });
      } else if (session.state === 'turn' && action === 'turn') {
        session.revealedCommunity.push(session.community[3]);
        session.state = 'river';
        this.sendPayout(player, 'texas_holdem', 0, 0, {
          playerHand: session.playerHand,
          dealerHand: [{ name: '?', val: '?', suit: '?' }, { name: '?', val: '?', suit: '?' }],
          community: [...session.revealedCommunity, { name: '?', val: '?', suit: '?' }],
          state: 'river'
        });
      } else if (session.state === 'river' && action === 'river') {
        session.revealedCommunity.push(session.community[4]);
        session.state = 'resolved';

        // Simplify hand evaluation: high card sum comparison
        const getSum = (hand) => hand.reduce((sum, c) => sum + (['J','Q','K','A'].includes(c.val) ? 10 : parseInt(c.val)), 0);
        const pScore = getSum([...session.playerHand, ...session.community]);
        const dScore = getSum([...session.dealerHand, ...session.community]);

        let net = 0;
        let outcome = 'lose';
        if (pScore > dScore) {
          net = session.anteBet * 2;
          outcome = 'win';
          this.economyManager.addChips(net);
        } else if (pScore === dScore) {
          net = session.anteBet;
          outcome = 'push';
          this.economyManager.addChips(net);
        }

        this.sendPayout(player, 'texas_holdem', net - session.anteBet, net, {
          playerHand: session.playerHand,
          dealerHand: session.dealerHand,
          community: session.community,
          outcome,
          state: 'resolved'
        });
      }
    }

    /* ==========================================================================
       PAI GOW POKER GAME ENGINE
       ========================================================================== */
    runPaiGowGame(player, tableId, action, betAmount, highHandIndices) {
      let session = this.paiGowSessions.get(player.id);
      if (!session || action === 'deal') {
        if (!this.economyManager.canAfford(betAmount)) return;
        this.economyManager.deductChips(betAmount);

        const deck = this.createDeck();
        const cards = [];
        for (let i = 0; i < 14; i++) cards.push(deck.pop());
        const playerCards = cards.slice(0, 7);
        const dealerCards = cards.slice(7, 14);

        session = {
          tableId,
          betAmount,
          playerCards,
          dealerCards,
          state: 'playing'
        };
        this.paiGowSessions.set(player.id, session);

        this.sendPayout(player, 'pai_gow', -betAmount, 0, {
          playerCards,
          state: 'playing'
        });
        return;
      }

      if (action === 'split' && session.state === 'playing') {
        session.state = 'resolved';
        const pCards = session.playerCards;
        const dCards = session.dealerCards;

        // Auto split dealer hand: 5 highest cards and 2 lowest cards
        const sortedDealer = [...dCards].sort((a,b) => b.score - a.score);
        const dHigh = sortedDealer.slice(0, 5);
        const dLow = sortedDealer.slice(5, 7);

        // Parse player split selection
        const pHigh = pCards.filter((_, idx) => highHandIndices.includes(idx));
        const pLow = pCards.filter((_, idx) => !highHandIndices.includes(idx));

        const scoreHand = (h) => h.reduce((sum, c) => sum + c.score, 0);
        const pHighVal = scoreHand(pHigh);
        const pLowVal = scoreHand(pLow);
        const dHighVal = scoreHand(dHigh);
        const dLowVal = scoreHand(dLow);

        const highWin = pHighVal > dHighVal;
        const lowWin = pLowVal > dLowVal;

        let net = 0;
        let outcome = 'lose';

        if (highWin && lowWin) {
          net = Math.floor(session.betAmount * 1.95); // 5% commission on wins
          outcome = 'win';
          this.economyManager.addChips(session.betAmount + net);
        } else if (highWin || lowWin) {
          net = 0;
          outcome = 'push';
          this.economyManager.addChips(session.betAmount);
        }

        this.sendPayout(player, 'pai_gow', net, session.betAmount + net, {
          playerCards: session.playerCards,
          dealerCards: session.dealerCards,
          dHigh,
          dLow,
          pHigh,
          pLow,
          outcome,
          state: 'resolved'
        });
      }
    }

    /* ==========================================================================
       SIC BO / ELEC SIC BO GAME ENGINE
       ========================================================================== */
    runSicBoGame(player, tableId, action, bets, isElectronic = false) {
      const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);
      if (!this.economyManager.canAfford(totalBet)) return;
      this.economyManager.deductChips(totalBet);

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const d3 = Math.floor(Math.random() * 6) + 1;
      const sum = d1 + d2 + d3;
      const isTriple = (d1 === d2 && d2 === d3);

      let totalWin = 0;
      const details = [];

      bets.forEach(b => {
        let won = false;
        let odds = 1;

        if (b.type === 'small') {
          won = (sum >= 4 && sum <= 10 && !isTriple);
          odds = 1;
        } else if (b.type === 'big') {
          won = (sum >= 11 && sum <= 17 && !isTriple);
          odds = 1;
        } else if (b.type === 'triple_any') {
          won = isTriple;
          odds = 30;
        } else if (b.type.startsWith('triple_')) {
          const val = parseInt(b.type.split('_')[1]);
          won = (isTriple && d1 === val);
          odds = 180;
        } else if (b.type.startsWith('total_')) {
          const val = parseInt(b.type.split('_')[1]);
          won = (sum === val);
          if ([4,17].includes(sum)) odds = 60;
          else if ([5,16].includes(sum)) odds = 30;
          else if ([6,15].includes(sum)) odds = 17;
          else if ([7,14].includes(sum)) odds = 12;
          else if ([8,13].includes(sum)) odds = 8;
          else if ([9,10,11,12].includes(sum)) odds = 6;
        }

        if (won) {
          const win = b.amount * (odds + 1);
          totalWin += win;
          details.push({ type: b.type, won: true, payout: win });
        } else {
          details.push({ type: b.type, won: false, payout: 0 });
        }
      });

      this.economyManager.addChips(totalWin);
      this.sendPayout(player, isElectronic ? 'elec_sic_bo' : 'sic_bo', totalWin - totalBet, totalWin, {
        dice: [d1, d2, d3],
        sum,
        isTriple,
        details
      });
    }

    /* ==========================================================================
       CARIBBEAN STUD POKER GAME ENGINE
       ========================================================================== */
    runCaribbeanStudGame(player, tableId, action, betAmount) {
      let session = this.caribbeanStudSessions.get(player.id);
      if (!session || action === 'deal') {
        if (!this.economyManager.canAfford(betAmount)) return;
        this.economyManager.deductChips(betAmount);

        const deck = this.createDeck();
        const playerHand = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];

        session = {
          tableId,
          anteBet: betAmount,
          deck,
          playerHand,
          dealerHand,
          state: 'playing'
        };
        this.caribbeanStudSessions.set(player.id, session);

        this.sendPayout(player, 'caribbean_stud', -betAmount, 0, {
          playerHand,
          dealerHand: [dealerHand[0], { name: '?', val: '?', suit: '?' }, { name: '?', val: '?', suit: '?' }, { name: '?', val: '?', suit: '?' }, { name: '?', val: '?', suit: '?' }],
          state: 'playing'
        });
        return;
      }

      if (session.state === 'playing') {
        session.state = 'resolved';
        if (action === 'fold') {
          this.sendPayout(player, 'caribbean_stud', -session.anteBet, 0, {
            playerHand: session.playerHand,
            dealerHand: session.dealerHand,
            outcome: 'fold',
            state: 'resolved'
          });
          return;
        }

        // Play bet is 2x Ante
        const playBet = session.anteBet * 2;
        if (!this.economyManager.canAfford(playBet)) return;
        this.economyManager.deductChips(playBet);

        // Dealer qualifies check: must hold Ace-King or higher
        const sortedDealer = [...session.dealerHand].sort((a,b) => b.score - a.score);
        const hasAce = sortedDealer.some(c => c.val === 'A');
        const hasKing = sortedDealer.some(c => c.val === 'K');
        const qualifies = hasAce && hasKing;

        let net = 0;
        let outcome = 'lose';

        if (!qualifies) {
          net = session.anteBet * 2 + playBet; // Ante pays 1:1, play pushes
          outcome = 'dealer_no_qualify';
          this.economyManager.addChips(net);
        } else {
          const getSum = (h) => h.reduce((sum, c) => sum + c.score, 0);
          if (getSum(session.playerHand) > getSum(session.dealerHand)) {
            net = (session.anteBet + playBet) * 2;
            outcome = 'win';
            this.economyManager.addChips(net);
          }
        }

        const totalInvested = session.anteBet + playBet;
        this.sendPayout(player, 'caribbean_stud', net - totalInvested, net, {
          playerHand: session.playerHand,
          dealerHand: session.dealerHand,
          outcome,
          state: 'resolved'
        });
      }
    }

    /* ==========================================================================
       BIG SIX WHEEL GAME ENGINE
       ========================================================================== */
    runBigSixGame(player, tableId, action, bets) {
      const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);
      if (!this.economyManager.canAfford(totalBet)) return;
      this.economyManager.deductChips(totalBet);

      const segments = [
        '$1','$1','$1','$1','$1','$1','$1','$1','$1','$1','$1','$1','$1','$1','$1','$1','$1','$1','$1','$1','$1','$1','$1',
        '$2','$2','$2','$2','$2','$2','$2','$2','$2','$2','$2','$2','$2','$2','$2',
        '$5','$5','$5','$5','$5','$5','$5','$5',
        '$10','$10','$10','$10',
        '$20','$20',
        'joker',
        'logo'
      ];
      const winningIndex = Math.floor(Math.random() * segments.length);
      const winSegment = segments[winningIndex];

      let totalWin = 0;
      const details = [];

      bets.forEach(b => {
        let won = (b.type === winSegment);
        let odds = 1;
        if (b.type === '$1') odds = 1;
        else if (b.type === '$2') odds = 2;
        else if (b.type === '$5') odds = 5;
        else if (b.type === '$10') odds = 10;
        else if (b.type === '$20') odds = 20;
        else if (['joker','logo'].includes(b.type)) odds = 40;

        if (won) {
          const win = b.amount * (odds + 1);
          totalWin += win;
          details.push({ type: b.type, won: true, payout: win });
        } else {
          details.push({ type: b.type, won: false, payout: 0 });
        }
      });

      this.economyManager.addChips(totalWin);
      this.sendPayout(player, 'big_six', totalWin - totalBet, totalWin, {
        winSegment,
        winningIndex,
        details
      });
    }

    /* ==========================================================================
       LET IT RIDE GAME ENGINE
       ========================================================================== */
    runLetItRideGame(player, tableId, action, betAmount) {
      let session = this.letItRideSessions.get(player.id);
      if (!session || action === 'deal') {
        const tripleBet = betAmount * 3;
        if (!this.economyManager.canAfford(tripleBet)) return;
        this.economyManager.deductChips(tripleBet);

        const deck = this.createDeck();
        const playerHand = [deck.pop(), deck.pop(), deck.pop()];
        const community = [deck.pop(), deck.pop()];

        session = {
          tableId,
          singleBet: betAmount,
          activeBets: [true, true, true],
          deck,
          playerHand,
          community,
          state: 'pull1'
        };
        this.letItRideSessions.set(player.id, session);

        this.sendPayout(player, 'let_it_ride', -tripleBet, 0, {
          playerHand,
          community: [{ name: '?', val: '?', suit: '?' }, { name: '?', val: '?', suit: '?' }],
          activeBets: session.activeBets,
          state: 'pull1'
        });
        return;
      }

      if (session.state === 'pull1') {
        if (action === 'pull') session.activeBets[0] = false;
        session.state = 'pull2';
        this.sendPayout(player, 'let_it_ride', 0, 0, {
          playerHand: session.playerHand,
          community: [session.community[0], { name: '?', val: '?', suit: '?' }],
          activeBets: session.activeBets,
          state: 'pull2'
        });
      } else if (session.state === 'pull2') {
        if (action === 'pull') session.activeBets[1] = false;
        session.state = 'resolved';

        const finalHand = [...session.playerHand, ...session.community];
        const score = finalHand.reduce((sum, c) => sum + c.score, 0);

        // Simple let-it-ride pay table
        let odds = 0;
        if (score >= 45) odds = 50; // Straight flush / Royal flush
        else if (score >= 35) odds = 8;  // Full house / Flush
        else if (score >= 25) odds = 3;  // Straight / 3 of a Kind
        else if (score >= 15) odds = 1;  // Pair of 10s or better

        const activeCount = session.activeBets.filter(b => b).length;
        const totalInvested = session.singleBet * 3;
        const finalBetAmount = session.singleBet * activeCount;
        
        const winnings = finalBetAmount * odds;
        const betRefund = session.singleBet * (3 - activeCount);
        const activeBetReturn = odds > 0 ? finalBetAmount : 0;
        const totalWin = winnings + betRefund + activeBetReturn;

        this.economyManager.addChips(totalWin);
        this.sendPayout(player, 'let_it_ride', totalWin - totalInvested, totalWin, {
          playerHand: session.playerHand,
          community: session.community,
          activeBets: session.activeBets,
          odds,
          state: 'resolved'
        });
      }
    }

    /* ==========================================================================
       RED DOG GAME ENGINE
       ========================================================================== */
    runRedDogGame(player, tableId, action, betAmount) {
      let session = this.redDogSessions.get(player.id);
      if (!session || action === 'deal') {
        if (!this.economyManager.canAfford(betAmount)) return;
        this.economyManager.deductChips(betAmount);

        const deck = this.createDeck();
        const c1 = deck.pop();
        const c2 = deck.pop();

        const cardToVal = (c) => {
          const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
          return ranks.indexOf(c.val) + 2;
        };

        const v1 = cardToVal(c1);
        const v2 = cardToVal(c2);

        let consecutive = Math.abs(v1 - v2) === 1;
        let equal = v1 === v2;
        let spread = equal || consecutive ? 0 : Math.abs(v1 - v2) - 1;

        session = {
          tableId,
          betAmount,
          deck,
          c1,
          c2,
          v1,
          v2,
          spread,
          state: consecutive ? 'consecutive' : (equal ? 'equal' : 'spread')
        };
        this.redDogSessions.set(player.id, session);

        if (consecutive) {
          // Consecutive means Push instantly
          session.state = 'resolved';
          this.economyManager.addChips(betAmount);
          this.sendPayout(player, 'red_dog', 0, betAmount, {
            c1, c2, outcome: 'push', state: 'resolved'
          });
          return;
        }

        if (equal) {
          // Draw third card instantly
          const c3 = deck.pop();
          const v3 = cardToVal(c3);
          session.state = 'resolved';
          let win = 0;
          let outcome = 'lose';
          if (v3 === v1) {
            win = betAmount * 12; // pays 11:1
            outcome = 'triple';
            this.economyManager.addChips(win);
          } else {
            this.economyManager.addChips(0); // lost bet
          }
          this.sendPayout(player, 'red_dog', win - betAmount, win, {
            c1, c2, c3, outcome, state: 'resolved'
          });
          return;
        }

        this.sendPayout(player, 'red_dog', -betAmount, 0, {
          c1, c2, spread, state: 'spread'
        });
        return;
      }

      if (session.state === 'spread') {
        session.state = 'resolved';
        let currentBet = session.betAmount;

        if (action === 'raise') {
          if (!this.economyManager.canAfford(currentBet)) return;
          this.economyManager.deductChips(currentBet);
          currentBet += session.betAmount;
        }

        const c3 = session.deck.pop();
        const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        const v3 = ranks.indexOf(c3.val) + 2;

        const minV = Math.min(session.v1, session.v2);
        const maxV = Math.max(session.v1, session.v2);
        const wins = (v3 > minV && v3 < maxV);

        let odds = 1;
        if (session.spread === 1) odds = 5;
        else if (session.spread === 2) odds = 4;
        else if (session.spread === 3) odds = 2;

        let totalWin = 0;
        let outcome = 'lose';
        if (wins) {
          totalWin = currentBet * (odds + 1);
          outcome = 'win';
          this.economyManager.addChips(totalWin);
        }

        this.sendPayout(player, 'red_dog', totalWin - currentBet, totalWin, {
          c1: session.c1,
          c2: session.c2,
          c3,
          spread: session.spread,
          outcome,
          state: 'resolved'
        });
      }
    }

    /* ==========================================================================
       SPANISH 21 GAME ENGINE
       ========================================================================== */
    runSpanish21Game(player, tableId, action, betAmount, clientPlayerCards, clientDealerCards) {
      let session = this.spanish21Sessions.get(player.id);
      if (!session || action === 'deal') {
        if (!this.economyManager.canAfford(betAmount)) return;
        this.economyManager.deductChips(betAmount);

        // Spanish deck has no 10s
        const fullDeck = this.createDeck();
        const deck = fullDeck.filter(c => c.val !== '10');

        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];

        session = {
          tableId,
          betAmount,
          deck,
          playerHand,
          dealerHand,
          state: 'playing'
        };
        this.spanish21Sessions.set(player.id, session);

        const pScore = this.getHandScore(playerHand);
        if (pScore === 21) {
          session.state = 'resolved';
          const win = Math.floor(betAmount * 2.5); // pays 3:2
          this.economyManager.addChips(win);
          this.sendPayout(player, 'spanish_21', win - betAmount, win, {
            playerHand,
            dealerHand,
            outcome: 'blackjack',
            state: 'resolved'
          });
          return;
        }

        this.sendPayout(player, 'spanish_21', -betAmount, 0, {
          playerHand,
          dealerHand: [dealerHand[0], { name: '?', val: '?', suit: '?' }],
          state: 'playing'
        });
        return;
      }

      if (action === 'hit') {
        const card = session.deck.pop();
        session.playerHand.push(card);
        const score = this.getHandScore(session.playerHand);

        if (score > 21) {
          session.state = 'resolved';
          this.sendPayout(player, 'spanish_21', -session.betAmount, 0, {
            playerHand: session.playerHand,
            dealerHand: session.dealerHand,
            outcome: 'bust',
            state: 'resolved'
          });
        } else if (score === 21) {
          // Spanish 21: Player 21 always wins instantly!
          session.state = 'resolved';
          const win = session.betAmount * 2;
          this.economyManager.addChips(win);
          this.sendPayout(player, 'spanish_21', session.betAmount, win, {
            playerHand: session.playerHand,
            dealerHand: session.dealerHand,
            outcome: 'win',
            state: 'resolved'
          });
        } else {
          this.sendPayout(player, 'spanish_21', 0, 0, {
            playerHand: session.playerHand,
            dealerHand: [session.dealerHand[0], { name: '?', val: '?', suit: '?' }],
            state: 'playing'
          });
        }
      } else if (action === 'stand') {
        session.state = 'resolved';
        let dScore = this.getHandScore(session.dealerHand);
        while (dScore < 17) {
          session.dealerHand.push(session.deck.pop());
          dScore = this.getHandScore(session.dealerHand);
        }

        const pScore = this.getHandScore(session.playerHand);
        let win = 0;
        let outcome = 'lose';

        if (dScore > 21 || pScore > dScore) {
          win = session.betAmount * 2;
          outcome = 'win';
          this.economyManager.addChips(win);
        } else if (pScore === dScore) {
          // Player 21 beats dealer 21, but other ties push
          if (pScore === 21) {
            win = session.betAmount * 2;
            outcome = 'win';
            this.economyManager.addChips(win);
          } else {
            win = session.betAmount;
            outcome = 'push';
            this.economyManager.addChips(win);
          }
        }

        this.sendPayout(player, 'spanish_21', win - session.betAmount, win, {
          playerHand: session.playerHand,
          dealerHand: session.dealerHand,
          outcome,
          state: 'resolved'
        });
      }
    }

    /* ==========================================================================
       CASINO WAR GAME ENGINE
       ========================================================================== */
    runCasinoWarGame(player, tableId, action, betAmount) {
      let session = this.casinoWarSessions.get(player.id);
      if (!session || action === 'deal') {
        if (!this.economyManager.canAfford(betAmount)) return;
        this.economyManager.deductChips(betAmount);

        const deck = this.createDeck();
        const pCard = deck.pop();
        const dCard = deck.pop();

        const cardVal = (c) => {
          const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
          return ranks.indexOf(c.val);
        };

        const pv = cardVal(pCard);
        const dv = cardVal(dCard);

        session = {
          tableId,
          betAmount,
          deck,
          pCard,
          dCard,
          pv,
          dv,
          state: pv === dv ? 'tie' : 'resolved'
        };
        this.casinoWarSessions.set(player.id, session);

        if (pv > dv) {
          const win = betAmount * 2;
          this.economyManager.addChips(win);
          this.sendPayout(player, 'casino_war', betAmount, win, {
            pCard, dCard, outcome: 'win', state: 'resolved'
          });
        } else if (dv > pv) {
          this.sendPayout(player, 'casino_war', -betAmount, 0, {
            pCard, dCard, outcome: 'lose', state: 'resolved'
          });
        } else {
          // Tie! Go to War options
          this.sendPayout(player, 'casino_war', -betAmount, 0, {
            pCard, dCard, state: 'tie'
          });
        }
        return;
      }

      if (session.state === 'tie') {
        session.state = 'resolved';
        if (action === 'surrender') {
          // Surrender: lose half bet
          const refund = Math.floor(session.betAmount * 0.5);
          this.economyManager.addChips(refund);
          this.sendPayout(player, 'casino_war', -refund, refund, {
            pCard: session.pCard,
            dCard: session.dCard,
            outcome: 'surrender',
            state: 'resolved'
          });
        } else if (action === 'war') {
          // War: place another Ante bet
          const warBet = session.betAmount;
          if (!this.economyManager.canAfford(warBet)) return;
          this.economyManager.deductChips(warBet);

          // Burn 3 cards
          session.deck.pop(); session.deck.pop(); session.deck.pop();
          const pCard2 = session.deck.pop();
          const dCard2 = session.deck.pop();

          const cardVal = (c) => {
            const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
            return ranks.indexOf(c.val);
          };

          const pv2 = cardVal(pCard2);
          const dv2 = cardVal(dCard2);

          let totalWin = 0;
          let outcome = 'lose';
          if (pv2 >= dv2) {
            // Player wins war! War bet pays 1:1, original ante pushes (pays 2x total, net +1x)
            totalWin = warBet * 3;
            outcome = 'win_war';
            this.economyManager.addChips(totalWin);
          }

          const totalInvested = session.betAmount + warBet;
          this.sendPayout(player, 'casino_war', totalWin - totalInvested, totalWin, {
            pCard: session.pCard,
            dCard: session.dCard,
            pCard2,
            dCard2,
            outcome,
            state: 'resolved'
          });
        }
      }
    }

    /* ==========================================================================
       VIDEO POKER GAME ENGINE
       ========================================================================== */
    runVideoPokerGame(player, tableId, action, betAmount, holdIndices) {
      let session = this.videoPokerSessions.get(player.id);
      if (!session || action === 'deal') {
        if (!this.economyManager.canAfford(betAmount)) return;
        this.economyManager.deductChips(betAmount);

        const deck = this.createDeck();
        const playerHand = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];

        session = {
          tableId,
          betAmount,
          deck,
          playerHand,
          state: 'draw'
        };
        this.videoPokerSessions.set(player.id, session);

        this.sendPayout(player, 'video_poker', -betAmount, 0, {
          playerHand,
          state: 'draw'
        });
        return;
      }

      if (session.state === 'draw' && action === 'draw') {
        session.state = 'resolved';

        // Draw new cards for unheld slots
        const finalHand = session.playerHand.map((c, idx) => {
          if (holdIndices && holdIndices.includes(idx)) return c;
          return session.deck.pop();
        });

        // Simple hand evaluation based on card values sum/pairs
        const score = finalHand.reduce((sum, c) => sum + c.score, 0);
        let odds = 0;
        let outcome = 'lose';

        if (score >= 45) { odds = 50; outcome = 'Royal Flush'; }
        else if (score >= 38) { odds = 8; outcome = 'Full House'; }
        else if (score >= 30) { odds = 3; outcome = 'Three of a Kind'; }
        else if (score >= 20) { odds = 1; outcome = 'Jacks or Better'; }

        const totalWin = session.betAmount * (odds + (odds > 0 ? 1 : 0));
        if (totalWin > 0) this.economyManager.addChips(totalWin);

        this.sendPayout(player, 'video_poker', totalWin - session.betAmount, totalWin, {
          playerHand: finalHand,
          outcome,
          odds,
          state: 'resolved'
        });
      }
    }

    /* ==========================================================================
       PLINKO GAME ENGINE
       ========================================================================== */
    runPlinkoGame(player, tableId, betAmount) {
      if (!this.economyManager.canAfford(betAmount)) return;
      this.economyManager.deductChips(betAmount);

      // Simulate path: 8 bounce steps (-1 for left, 1 for right)
      const path = [];
      for (let i = 0; i < 8; i++) {
        path.push(Math.random() < 0.5 ? -1 : 1);
      }

      // Pocket index: sum of steps / 2 + 4 (range 0 to 8)
      const stepsSum = path.reduce((sum, x) => sum + x, 0);
      const pocketIndex = (stepsSum / 2) + 4;

      // Payout multipliers: [5x, 2x, 0.5x, 0.2x, 0x, 0.2x, 0.5x, 2x, 5x]
      const multipliers = [5, 2, 0.5, 0.2, 0, 0.2, 0.5, 2, 5];
      const mult = multipliers[pocketIndex];
      const totalWin = Math.floor(betAmount * mult);

      if (totalWin > 0) this.economyManager.addChips(totalWin);

      this.sendPayout(player, 'plinko', totalWin - betAmount, totalWin, {
        path,
        pocketIndex,
        multiplier: mult
      });
    }

    /* ==========================================================================
       KIOSK LOTTERY GAME ENGINE
       ========================================================================== */
    runLotteryGame(player, tableId, betAmount, selectedNumbers) {
      if (!this.economyManager.canAfford(betAmount)) return;
      this.economyManager.deductChips(betAmount);

      // Draw 5 unique numbers from 1 to 20
      const numbers = [];
      while (numbers.length < 5) {
        const n = Math.floor(Math.random() * 20) + 1;
        if (!numbers.includes(n)) numbers.push(n);
      }

      // Count matches
      const matches = selectedNumbers.filter(x => numbers.includes(x)).length;

      // Multipliers: match 0/1: 0x, match 2: 1x, match 3: 4x, match 4: 15x, match 5: 250x
      const multipliers = [0, 0, 1, 4, 15, 250];
      const mult = multipliers[matches];
      const totalWin = betAmount * mult;

      if (totalWin > 0) this.economyManager.addChips(totalWin);

      this.sendPayout(player, 'lottery', totalWin - betAmount, totalWin, {
        winningNumbers: numbers,
        matches,
        multiplier: mult
      });
    }

    sendPayout(player, gameType, netPayout, totalWin, extraData) {
      if (isNaN(netPayout)) netPayout = 0;
      if (isNaN(totalWin)) totalWin = 0;

      // Apply Double Chips payout buff!
      const hasPayoutBuff = player.buffs && (player.buffs.payout > 0 || player.buffs.restaurant_buff > 0 || player.buffs.music_buff > 0);
      if (hasPayoutBuff && netPayout > 0) {
        const bonusChips = netPayout;
        this.economyManager.addChips(bonusChips);
        totalWin += bonusChips;
        netPayout += bonusChips;
        console.log(`[Server:GameSim] Double Chips Payout active! Added bonus of +${bonusChips} Chips!`);
      }

      this.recordDayStat(gameType, -netPayout);

      if (netPayout < 0) {
        this.playerGamblingLosses += Math.abs(netPayout);
      }

      // Player wins award Research Points equal to 1/4 of net profits (min 1 RP on any win!)
      let rpAwarded = 0;
      if (netPayout > 0) {
        rpAwarded = Math.max(1, Math.floor(netPayout * 0.25));
        
        // Double RP buff modifier!
        const hasRpBuff = player.buffs && (player.buffs.rp > 0 || player.buffs.coffee_buff > 0 || player.buffs.vip_buff > 0 || player.buffs.restaurant_buff > 0 || player.buffs.hologram > 0 || player.buffs.pizza_oven > 0);
        if (hasRpBuff) {
          rpAwarded *= 2;
        }

        this.researchPoints += rpAwarded;
        console.log(`[Server:GameSim] Player won ${netPayout} Chips gambling! Awarded ${rpAwarded} Research Points. Total RP: ${this.researchPoints}`);
      }
      
      const payload = {
        playerId: player.id,
        gameType,
        netPayout,
        totalWin,
        rpAwarded,
        researchPoints: this.researchPoints,
        starRating: this.starRating,
        chips: this.economyManager.getChips(),
        tableId: (extraData && extraData.tableId) || player.interactingObjectId,
        ...extraData
      };
      
      this.broadcast(window.Casino.Protocol.Events.MINIGAME_PAYOUT, payload);
    }

    handleCleanDirt(player, payload) {
      const { x, y } = payload;
      const dist = Math.sqrt((player.gridX - x)**2 + (player.gridY - y)**2);
      if (dist <= 2.2) {
        this.dirtyTiles = this.dirtyTiles.filter(t => !(t.x === x && t.y === y));
        console.log(`[Server:GameSim] Player cleaned dirt at (${x}, ${y})`);
        this.broadcast(window.Casino.Protocol.Events.SOUND_TRIGGER, { type: 'beep' });
        this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
      }
    }

    handleCapturePickpocket(player, payload) {
      const { id } = payload;
      const pickpocket = this.employees.get(id);
      if (pickpocket && pickpocket.role === 'pickpocket') {
        const dist = Math.sqrt((player.gridX - pickpocket.gridX)**2 + (player.gridY - pickpocket.gridY)**2);
        if (dist <= 2.5) {
          this.employees.delete(id);
          this.economyManager.addChips(100);
          console.log(`[Server:GameSim] Player captured pickpocket "${id}". Bounty: +100 Chips`);
          
          this.broadcast(window.Casino.Protocol.Events.SOUND_TRIGGER, { type: 'win' });
          this.broadcast(window.Casino.Protocol.Events.GUEST_LEFT_REASON, {
            name: `Player caught a pickpocket!`,
            reason: 'pickpocket_captured_by_staff'
          });
          this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
        }
      }
    }

    handleRepairMachine(player, payload) {
      const { objectId } = payload;
      const obj = this.gridManager.placedObjects.get(objectId);
      if (obj && obj.isBroken) {
        let distance = Infinity;
        for (let y = obj.gridY; y < obj.gridY + obj.height; y++) {
          for (let x = obj.gridX; x < obj.gridX + obj.width; x++) {
            const d = Math.sqrt((player.gridX - x)**2 + (player.gridY - y)**2);
            if (d < distance) distance = d;
          }
        }
        if (distance <= 2.2) {
          obj.isBroken = false;
          console.log(`[Server:GameSim] Player repaired machine "${objectId}"`);
          this.broadcast(window.Casino.Protocol.Events.SOUND_TRIGGER, { type: 'win' });
          this.broadcast(window.Casino.Protocol.Events.GUEST_LEFT_REASON, {
            name: obj.name,
            reason: 'machine_repaired'
          });
          this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
        }
      }
    }

    setupGamblerModeCasino() {
      this.isGamblerMode = true;
      this.sizeLevel = 3;
      this.guestMax = 0;
      this.gridManager = new window.Casino.GridManager(36, 24);
      
      const placements = [
        // Row 1 (y = 2)
        { type: 'slots', x: 2, y: 2 },
        { type: 'roulette', x: 5, y: 2 },
        { type: 'blackjack', x: 10, y: 2 },
        { type: 'craps', x: 14, y: 2 },
        { type: 'ride_the_bus', x: 20, y: 2 },
        { type: 'three_card_poker', x: 24, y: 2 },
        { type: 'baccarat', x: 28, y: 2 },
        { type: 'texas_holdem', x: 32, y: 2 },
        // Row 2 (y = 6)
        { type: 'pai_gow', x: 2, y: 6 },
        { type: 'sic_bo', x: 6, y: 6 },
        { type: 'caribbean_stud', x: 11, y: 6 },
        { type: 'big_six', x: 15, y: 6 },
        { type: 'let_it_ride', x: 19, y: 6 },
        { type: 'red_dog', x: 23, y: 6 },
        { type: 'spanish_21', x: 27, y: 6 },
        { type: 'casino_war', x: 31, y: 6 },
        // Row 3 (y = 10)
        { type: 'video_poker', x: 2, y: 10 },
        { type: 'plinko', x: 5, y: 10 },
        { type: 'lottery', x: 8, y: 10 },
        { type: 'elec_roulette', x: 11, y: 10 },
        { type: 'elec_blackjack', x: 16, y: 10 },
        { type: 'bubble_craps', x: 20, y: 10 },
        { type: 'elec_sic_bo', x: 25, y: 10 },
        { type: 'elec_baccarat', x: 30, y: 10 },
        // Amenities (y = 14)
        { type: 'soda_machine', x: 2, y: 14 },
        { type: 'vending_machine', x: 5, y: 14 },
        { type: 'candy_dispenser', x: 8, y: 14 },
        { type: 'coffee_maker', x: 11, y: 14 },
        { type: 'bathroom_stall', x: 14, y: 14 },
        { type: 'luxury_bathroom', x: 17, y: 14 },
        { type: 'massage_chair', x: 21, y: 14 },
        { type: 'atm', x: 24, y: 14 }
      ];

      placements.forEach(p => {
        const obj = this.gridManager.placeObject(p.type, p.x, p.y);
        if (obj && obj.dealerSeat) {
          // Spawn a permanent dealer at their post!
          const empId = `employee_dealer_perm_${this.nextEmployeeId++}`;
          const dealerX = obj.gridX + obj.dealerSeat.rx;
          const dealerY = obj.gridY + obj.dealerSeat.ry;
          const emp = new window.Casino.EmployeeAI(empId, 'dealer', dealerX, dealerY);
          emp.state = 'WORKING';
          emp.targetObjectId = obj.id;
          obj.dealerSeat.employeeId = empId;
          this.employees.set(empId, emp);
        }
      });

      // Spawn permanent support staff
      const entranceX = this.gridManager.entranceX;
      const entranceY = this.gridManager.entranceY;

      for (let i = 0; i < 3; i++) {
        const wId = `employee_waitress_perm_${this.nextEmployeeId++}`;
        const w = new window.Casino.EmployeeAI(wId, 'waitress', entranceX, entranceY);
        w.state = 'WANDERING';
        this.employees.set(wId, w);

        const cId = `employee_chef_perm_${this.nextEmployeeId++}`;
        const c = new window.Casino.EmployeeAI(cId, 'chef', entranceX, entranceY);
        c.state = 'WANDERING';
        this.employees.set(cId, c);

        const tId = `employee_tech_perm_${this.nextEmployeeId++}`;
        const t = new window.Casino.EmployeeAI(tId, 'tech_support', entranceX, entranceY);
        t.state = 'WANDERING';
        this.employees.set(tId, t);
        
        const sId = `employee_sec_perm_${this.nextEmployeeId++}`;
        const s = new window.Casino.EmployeeAI(sId, 'security', entranceX, entranceY);
        s.state = 'WANDERING';
        this.employees.set(sId, s);
      }
    }

    handleSelectDifficulty(player, payload) {
      const difficulty = payload.difficulty;
      let chips = 5000;
      let rp = 0;
      if (difficulty === 'easy') {
        chips = 1000000;
        rp = 1000000;
      } else if (difficulty === 'hard') {
        chips = 1500;
      } else if (difficulty === 'gambler') {
        chips = 25000;
        rp = 0;
        this.setupGamblerModeCasino();
        // Set player coordinates to entrance
        player.gridX = this.gridManager.entranceX;
        player.gridY = this.gridManager.entranceY;
        console.log(`[Server:GameSim] Selected Gambler Mode. Initialized pre-placed staffed casino.`);
        this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
        return;
      }
      
      this.economyManager.chips = chips;
      this.researchPoints = rp;
      console.log(`[Server:GameSim] Selected difficulty: "${difficulty}". Starting chips: ${chips}, starting RP: ${rp}`);
      this.broadcast(window.Casino.Protocol.Events.FULL_STATE, this.getFullState());
    }
  }

  window.Casino.GameSim = GameSim;
})();
