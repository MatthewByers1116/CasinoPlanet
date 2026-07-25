// Guest AI: Models autonomous guest behaviors, pathfinding, and passive income generation
(function() {
  const States = {
    SPAWNED: 'SPAWNED',
    WALKING: 'WALKING',
    GAMBLING: 'GAMBLING',
    WANDERING: 'WANDERING',
    LEAVING: 'LEAVING'
  };

  class GuestAI {
    constructor(id, startX, startY) {
      this.id = id;
      this.gridX = startX;
      this.gridY = startY;
      
      // Interpolation values for smooth rendering on client
      this.renderX = startX;
      this.renderY = startY;

      this.state = States.SPAWNED;
      this.path = null;
      this.pathIndex = 0;
      this.targetObjectId = null;
      this.gambleTimer = 0;
      this.shouldDespawn = false;

      // Guest profile details
      this.budget = Math.floor(50 + Math.random() * 200); // 50 to 250 chips
      this.color = this.getRandomVibrantColor();
      this.name = this.getRandomName();
      
      this.speed = 2.5 + Math.random() * 1.5; // grid cells per second
      this.moveProgress = 0; // 0 to 1 progress between path steps
      this.wanderTimer = 0;

      // Personal needs (100 = satisfied, 0 = depleted)
      this.thirst = 100;
      this.hunger = 100;
      this.bio = 100;
      this.entertainment = 100;
    }

    getRandomVibrantColor() {
      const colors = ['#ff4d4d', '#ff944d', '#ffff4d', '#4dff4d', '#4dffff', '#4d4dff', '#e64dff'];
      return colors[Math.floor(Math.random() * colors.length)];
    }

    getRandomName() {
      const names = ['Sam', 'Alex', 'Taylor', 'Jordan', 'Morgan', 'Casey', 'Robin', 'Pat', 'Chris', 'Jamie'];
      return names[Math.floor(Math.random() * names.length)] + ' #' + Math.floor(Math.random() * 900 + 100);
    }

    chooseNextAction(gridManager, sim) {
      // Release seat if currently held
      if (this.targetObjectId && this.assignedSeatIndex !== undefined && this.assignedSeatIndex !== null) {
        const obj = gridManager.placedObjects.get(this.targetObjectId);
        if (obj && obj.seats) {
          const seat = obj.seats[this.assignedSeatIndex];
          if (seat && seat.guestId === this.id) {
            seat.guestId = null;
          }
        }
      }
      this.assignedSeatIndex = null;

      // If budget is depleted, leave the casino
      if (this.budget <= 0) {
        if (sim) {
          sim.broadcast(window.Casino.Protocol.Events.GUEST_LEFT_REASON, {
            name: this.name,
            reason: 'broke'
          });
        }
        this.startLeaving(gridManager);
        return;
      }

      // Leave chance depends directly on personal needs satisfaction
      const avgNeeds = (this.thirst + this.hunger + this.bio) / 3;
      let leaveChance = 0.01; // Base 1% chance to leave per choice
      if (avgNeeds < 40) {
        // Starving/Dehydrated/Urgent need -> high chance to leave
        leaveChance = 0.20; 
      } else if (avgNeeds < 65) {
        leaveChance = 0.05;
      }
      
      if (Math.random() < leaveChance) {
        let reason = 'satisfied';
        let shouldActuallyLeave = true;
        
        // Find placed objects
        const objects = Array.from(gridManager.placedObjects.values());
        
        if (this.thirst < 30) {
          reason = 'thirsty';
          const hasDrink = objects.some(obj => !obj.isBroken && ['bar', 'soda_machine', 'coffee_maker', 'bubble_tea', 'vip_lounge'].includes(obj.type));
          if (hasDrink) shouldActuallyLeave = false;
        } else if (this.bio < 30) {
          reason = 'bladder';
          const hasBathroom = objects.some(obj => !obj.isBroken && ['bathroom', 'bathroom_stall', 'massage_chair', 'glow_sofa'].includes(obj.type));
          if (hasBathroom) shouldActuallyLeave = false;
        } else if (this.hunger < 30) {
          reason = 'hungry';
          const hasFood = objects.some(obj => !obj.isBroken && ['restaurant', 'vending_machine', 'candy_dispenser', 'popcorn_cart', 'pizza_oven', 'ice_cream', 'vip_lounge'].includes(obj.type));
          if (hasFood) shouldActuallyLeave = false;
        } else if (this.entertainment < 40) {
          reason = 'bored';
        }
        
        if (shouldActuallyLeave) {
          if (sim) {
            sim.broadcast(window.Casino.Protocol.Events.GUEST_LEFT_REASON, {
              name: this.name,
              reason: reason
            });
          }
          this.startLeaving(gridManager);
          return;
        }
      }

      // Find all placed objects
      const objects = Array.from(gridManager.placedObjects.values());

      // Check if happy enough and low on cash to use ATM
      const avgNeedsAtm = (this.thirst + this.hunger + this.bio + this.entertainment) / 4;
      if (this.budget <= 40 && avgNeedsAtm >= 70) {
        const atms = objects.filter(obj => obj.type === 'atm' && !obj.isBroken);
        if (atms.length > 0) {
          let closestAtm = null;
          let minDist = Infinity;
          atms.forEach(a => {
            const d = Math.sqrt((this.gridX - a.gridX)**2 + (this.gridY - a.gridY)**2);
            if (d < minDist) {
              minDist = d;
              closestAtm = a;
            }
          });

          if (closestAtm) {
            this.targetObjectId = closestAtm.id;
            this.state = States.WALKING;
            
            const path = window.Casino.Pathfinding.findPath(
              gridManager,
              this.gridX,
              this.gridY,
              closestAtm.gridX,
              closestAtm.gridY,
              true
            );
            if (path && path.length > 0) {
              this.path = path;
              this.pathIndex = 0;
              this.moveProgress = 0;
              return;
            } else {
              this.targetObjectId = null;
            }
          }
        }
      }
      
      if (objects.length === 0) {
        // No games available, wander around
        this.state = States.WANDERING;
        this.wanderTimer = 2000 + Math.random() * 3000;
        this.targetObjectId = null;
        return;
      }

      // Prioritize need satisfaction if any need is below 55 (or 30 for entertainment)
      let prioritizedTypes = null;
      const needs = [
        { name: 'thirst', val: this.thirst, types: ['bar', 'soda_machine', 'coffee_maker', 'bubble_tea', 'vip_lounge'] },
        { name: 'hunger', val: this.hunger, types: ['restaurant', 'vending_machine', 'candy_dispenser', 'popcorn_cart', 'pizza_oven', 'ice_cream', 'vip_lounge'] },
        { name: 'bio', val: this.bio, types: ['bathroom', 'bathroom_stall', 'massage_chair', 'glow_sofa'] }
      ];
      // Sort by value ascending to find the lowest need
      needs.sort((a, b) => a.val - b.val);

      if (needs[0].val < 55) {
        prioritizedTypes = needs[0].types;
      } else if (this.entertainment < 30) {
        prioritizedTypes = ['slots', 'roulette', 'craps', 'blackjack', 'ride_the_bus', 'three_card_poker', 'elec_roulette', 'elec_blackjack', 'bubble_craps', 'baccarat', 'texas_holdem', 'pai_gow', 'sic_bo', 'caribbean_stud', 'big_six', 'let_it_ride', 'red_dog', 'spanish_21', 'casino_war', 'video_poker', 'elec_sic_bo', 'elec_baccarat', 'plinko', 'lottery', 'jazz_band', 'fountain', 'arcade_console', 'vr_pod', 'vip_lounge', 'hologram'];
      }

      let availableObjects = [];
      if (prioritizedTypes) {
        // Try to find available objects of these types
        availableObjects = objects.filter(obj => {
          if (obj.isBroken) return false;
          if (!prioritizedTypes.includes(obj.type)) return false;
          if (!obj.seats) return obj.guests ? obj.guests.length < obj.guestCapacity : true;
          return obj.seats.some(s => s.guestId === null);
        });

        // Persistent search: if the need is critical (below 45) and we have such amenities but they are busy,
        // wait/wander instead of reverting to playing games immediately
        if (availableObjects.length === 0 && needs[0].val < 45 && needs[0].name !== 'entertainment') {
          const hasAmenity = objects.some(obj => !obj.isBroken && prioritizedTypes.includes(obj.type));
          if (hasAmenity) {
            this.state = States.WANDERING;
            this.wanderTimer = 1000 + Math.random() * 1000;
            this.targetObjectId = null;
            return;
          }
        }
      }

      // Fallback if no prioritized types or none are available (only select game types!)
      if (availableObjects.length === 0) {
        availableObjects = objects.filter(obj => {
          if (obj.isBroken) return false;
          const isGame = ['slots', 'roulette', 'craps', 'blackjack', 'ride_the_bus', 'three_card_poker', 'elec_roulette', 'elec_blackjack', 'bubble_craps', 'baccarat', 'texas_holdem', 'pai_gow', 'sic_bo', 'caribbean_stud', 'big_six', 'let_it_ride', 'red_dog', 'spanish_21', 'casino_war', 'video_poker', 'elec_sic_bo', 'elec_baccarat', 'plinko', 'lottery'].includes(obj.type);
          if (!isGame) return false;

          // Table games require a dealer to accept guests!
          if (['roulette', 'craps', 'blackjack', 'ride_the_bus', 'three_card_poker', 'baccarat', 'texas_holdem', 'pai_gow', 'sic_bo', 'caribbean_stud', 'big_six', 'let_it_ride', 'red_dog', 'spanish_21', 'casino_war'].includes(obj.type)) {
            if (!sim || !sim.isDealerPresent(obj)) {
              return false; // Skip table games if they have no active dealer!
            }
          }

          if (!obj.seats) return obj.guests ? obj.guests.length < obj.guestCapacity : true;
          return obj.seats.some(s => s.guestId === null);
        });
      }
      
      if (availableObjects.length === 0) {
        // All tables are busy, wait and wander
        this.state = States.WANDERING;
        this.wanderTimer = 1500 + Math.random() * 1500;
        return;
      }

      // Pick a random available object
      const chosenObj = availableObjects[Math.floor(Math.random() * availableObjects.length)];
      this.targetObjectId = chosenObj.id;

      // Assign seat
      let targetX = chosenObj.gridX;
      let targetY = chosenObj.gridY;
      let isSolidTarget = true;

      if (chosenObj.seats) {
        const freeSeat = chosenObj.seats.find(s => s.guestId === null);
        if (freeSeat) {
          freeSeat.guestId = this.id;
          this.assignedSeatIndex = chosenObj.seats.indexOf(freeSeat);
          targetX = chosenObj.gridX + freeSeat.rx;
          targetY = chosenObj.gridY + freeSeat.ry;
          isSolidTarget = false; // Pathfinding target is the walkable seat itself!
        }
      }

      // Calculate path to object
      const path = window.Casino.Pathfinding.findPath(
        gridManager, 
        this.gridX, 
        this.gridY, 
        targetX, 
        targetY, 
        isSolidTarget
      );

      if (path && path.length > 0) {
        this.path = path;
        this.pathIndex = 0;
        this.moveProgress = 0;
        this.state = States.WALKING;
      } else {
        // Path blocked or failed! Release seat to prevent locks, and wander to try again
        if (chosenObj.seats && this.assignedSeatIndex !== null) {
          const seat = chosenObj.seats[this.assignedSeatIndex];
          if (seat && seat.guestId === this.id) {
            seat.guestId = null;
          }
        }
        this.assignedSeatIndex = null;
        this.targetObjectId = null;
        
        this.state = States.WANDERING;
        this.wanderTimer = 1000 + Math.random() * 1000;
      }
    }

    startLeaving(gridManager) {
      // Release seat if held
      if (this.targetObjectId && this.assignedSeatIndex !== undefined && this.assignedSeatIndex !== null) {
        const obj = gridManager.placedObjects.get(this.targetObjectId);
        if (obj && obj.seats) {
          const seat = obj.seats[this.assignedSeatIndex];
          if (seat && seat.guestId === this.id) {
            seat.guestId = null;
          }
        }
      }
      this.assignedSeatIndex = null;
      this.state = States.LEAVING;
      this.targetObjectId = null;
      this.happinessOnDeparture = (this.thirst + this.hunger + this.bio + this.entertainment) / 4;

      const path = window.Casino.Pathfinding.findPath(
        gridManager,
        this.gridX,
        this.gridY,
        gridManager.entranceX,
        gridManager.entranceY,
        false
      );

      if (path && path.length > 0) {
        this.path = path;
        this.pathIndex = 0;
        this.moveProgress = 0;
      } else {
        // Can't find exit path (blocked?), force despawn
        this.shouldDespawn = true;
      }
    }

    update(dt, gridManager, economyManager, sim) {
      // DT is in milliseconds
      const dtSeconds = dt / 1000;

      switch (this.state) {
        case States.SPAWNED:
          this.chooseNextAction(gridManager, sim);
          break;

        case States.WANDERING:
          this.wanderTimer -= dt;
          if (this.wanderTimer <= 0) {
            // Check if they want to move to a random adjacent tile to look alive
            const directions = [{x:-1, y:0}, {x:1, y:0}, {x:0, y:-1}, {x:0, y:1}];
            const randDir = directions[Math.floor(Math.random() * directions.length)];
            const tx = this.gridX + randDir.x;
            const ty = this.gridY + randDir.y;
            if (gridManager.isCellWalkable(tx, ty)) {
              this.gridX = tx;
              this.gridY = ty;
            }
            this.chooseNextAction(gridManager, sim);
          }
          break;

        case States.WALKING:
        case States.LEAVING:
          this.tickMovement(dtSeconds, gridManager, sim);
          break;

        case States.GAMBLING:
          this.gambleTimer -= dt;
          if (this.gambleTimer <= 0) {
            this.finishGambling(gridManager, economyManager, sim);
          }
          break;
      }

      // Smooth rendering interpolation
      const lerpSpeed = 0.2;
      this.renderX += (this.gridX - this.renderX) * lerpSpeed;
      this.renderY += (this.gridY - this.renderY) * lerpSpeed;

      // Decay needs over time (dt is in milliseconds)
      const decayRateMultiplier = dt / 1000;
      this.thirst = Math.max(0, this.thirst - 2.0 * decayRateMultiplier);   // thirst decays in 50s
      this.hunger = Math.max(0, this.hunger - 1.5 * decayRateMultiplier);   // hunger decays in 66s
      this.bio = Math.max(0, this.bio - 1.8 * decayRateMultiplier);         // bio decays in 55s

      // Entertainment decay/restore: +10 per sec when gambling, -2.5 per sec otherwise
      if (this.state === States.GAMBLING) {
        this.entertainment = Math.min(100, this.entertainment + 10.0 * decayRateMultiplier);
      } else {
        this.entertainment = Math.max(0, this.entertainment - 2.5 * decayRateMultiplier);
      }
    }

    tickMovement(dtSeconds, gridManager, sim) {
      if (!this.path || this.pathIndex >= this.path.length) {
        this.arriveAtDestination(gridManager, sim);
        return;
      }

      const targetCell = this.path[this.pathIndex];
      
      // Check collision
      if (this.moveProgress === 0 && !gridManager.isCellWalkable(targetCell.x, targetCell.y)) {
        // Recalculate path
        const lastTarget = this.path[this.path.length - 1];
        const newPath = window.Casino.Pathfinding.findPath(
          gridManager,
          this.gridX,
          this.gridY,
          lastTarget.x,
          lastTarget.y,
          this.state === States.LEAVING ? false : true
        );
        if (newPath && newPath.length > 0) {
          this.path = newPath;
          this.pathIndex = 0;
        } else {
          this.arriveAtDestination(gridManager, sim); // cancel move
        }
        return;
      }

      this.moveProgress += this.speed * dtSeconds;
      
      // Set render position smoothly
      const startX = this.pathIndex === 0 ? this.gridX : this.path[this.pathIndex - 1].x;
      const startY = this.pathIndex === 0 ? this.gridY : this.path[this.pathIndex - 1].y;
      this.renderX = startX + (targetCell.x - startX) * Math.min(1, this.moveProgress);
      this.renderY = startY + (targetCell.y - startY) * Math.min(1, this.moveProgress);

      if (this.moveProgress >= 1) {
        this.gridX = targetCell.x;
        this.gridY = targetCell.y;
        this.moveProgress = 0;
        this.pathIndex++;

        // Walk over dirt logic (reduces comfort/needs)
        if (sim && sim.dirtyTiles) {
          const isDirty = sim.dirtyTiles.some(t => t.x === this.gridX && t.y === this.gridY);
          if (isDirty) {
            this.thirst = Math.max(0, this.thirst - 8);
            this.hunger = Math.max(0, this.hunger - 8);
          }
        }

        // Spilling dirt chance (0.5%)
        if (Math.random() < 0.005) {
          if (sim && sim.dirtyTiles) {
            const alreadyDirty = sim.dirtyTiles.some(t => t.x === this.gridX && t.y === this.gridY);
            if (!alreadyDirty) {
              sim.dirtyTiles.push({ x: this.gridX, y: this.gridY });
            }
          }
        }

        if (this.pathIndex >= this.path.length) {
          this.path = null;
          this.arriveAtDestination(gridManager, sim);
        }
      }
    }

    arriveAtDestination(gridManager, sim) {
      if (this.state === States.LEAVING) {
        this.shouldDespawn = true;
        return;
      }

      // Arrived at casino table
      const obj = gridManager.placedObjects.get(this.targetObjectId);
      if (obj) {
        // If they have an assigned seat, verify it is still valid
        let seatValid = true;
        if (obj.seats && this.assignedSeatIndex !== undefined && this.assignedSeatIndex !== null) {
          const seat = obj.seats[this.assignedSeatIndex];
          if (!seat || seat.guestId !== this.id) {
            seatValid = false;
          }
        }

        if (!obj.guests) obj.guests = [];
        if (seatValid && obj.guests.length < obj.guestCapacity) {
          // Register guest at table
          if (!obj.guests.includes(this.id)) {
            obj.guests.push(this.id);
          }
          this.state = States.GAMBLING;
          this.gambleTimer = obj.useTime;
        } else {
          // Release seat
          if (obj.seats && this.assignedSeatIndex !== undefined && this.assignedSeatIndex !== null) {
            const seat = obj.seats[this.assignedSeatIndex];
            if (seat && seat.guestId === this.id) seat.guestId = null;
          }
          this.assignedSeatIndex = null;
          this.chooseNextAction(gridManager, sim);
        }
      } else {
        this.assignedSeatIndex = null;
        this.chooseNextAction(gridManager, sim);
      }
    }

    finishGambling(gridManager, economyManager, sim) {
      const obj = gridManager.placedObjects.get(this.targetObjectId);
      if (obj) {
        // Remove from table slot
        obj.guests = obj.guests.filter(gId => gId !== this.id);
        
        // Release seat
        if (obj.seats && this.assignedSeatIndex !== undefined && this.assignedSeatIndex !== null) {
          const seat = obj.seats[this.assignedSeatIndex];
          if (seat && seat.guestId === this.id) {
            seat.guestId = null;
          }
        }

        // Calculate manager passive income bonus (optimized scan)
        let managerBonus = 0;
        if (sim && sim.employees) {
          for (const emp of sim.employees.values()) {
            if (emp.role === 'manager') {
              const dist = Math.sqrt((emp.gridX - obj.gridX)**2 + (emp.gridY - obj.gridY)**2);
              if (dist <= 4.0) {
                managerBonus = 0.25;
                break;
              }
            }
          }
        }

        // Table game dealer requirement check
        if (['roulette', 'craps', 'blackjack', 'ride_the_bus', 'three_card_poker', 'baccarat', 'texas_holdem', 'pai_gow', 'sic_bo', 'caribbean_stud', 'big_six', 'let_it_ride', 'red_dog', 'spanish_21', 'casino_war'].includes(obj.type)) {
          if (!sim || !sim.isDealerPresent(obj)) {
            // No dealer! Return without paying
            this.assignedSeatIndex = null;
            this.chooseNextAction(gridManager, sim);
            return;
          }

          // Dealer present! Evaluate needs modifier
          let modifier = 0;
          let playerIsDealer = false;
          if (sim) {
            const dealerX = obj.gridX + obj.dealerSeat.rx;
            const dealerY = obj.gridY + obj.dealerSeat.ry;
            for (const player of sim.players.values()) {
              if (player.gridX === dealerX && player.gridY === dealerY) {
                playerIsDealer = true;
                break;
              }
            }
          }

          if (playerIsDealer) {
            modifier = obj.isDealerBoosted ? 0.40 : 0.20;
          } else if (sim && sim.employees && obj.dealerSeat.employeeId !== null) {
            const dealer = sim.employees.get(obj.dealerSeat.employeeId);
            if (dealer) {
              const avg = (dealer.thirst + dealer.hunger + dealer.bio) / 3;
              if (avg >= 75) {
                modifier = 0.20;
              } else if (avg < 40) {
                modifier = -0.20;
              }
            }
          }

          const baseIncome = Math.min(obj.tickIncome, this.budget);
          const finalCost = Math.max(1, Math.floor(baseIncome * (1 + modifier + managerBonus)));
          this.budget -= finalCost;
          economyManager.addChips(finalCost);
          if (sim && typeof sim.recordDayStat === 'function') {
            sim.recordDayStat(obj.type, finalCost);
          }
          this.entertainment = 100; // Playing table games restores fun!

          obj.earnings = obj.earnings || [];
          obj.earnings.push({ time: Date.now(), amount: finalCost });
  
          const ui = window.Casino.clientInstance && window.Casino.clientInstance.minigameUI;
          if (ui && modifier !== 0) {
            const label = modifier > 0 ? 'HAPPY (+20% bonus)' : 'UNHAPPY (-20% penalty)';
            ui.logDebug(`Passive income at "${obj.name}": Guest paid ${finalCost} Chips (Dealer is ${label})`, 'info');
          }
        } else {
          // Slots / amenities / bar / bathroom
          const baseCost = Math.min(obj.tickIncome, this.budget);
          const cost = Math.max(1, Math.floor(baseCost * (1 + managerBonus)));
          this.budget -= cost;
          economyManager.addChips(cost);
          if (sim && typeof sim.recordDayStat === 'function') {
            sim.recordDayStat(obj.type, cost);
          }

          // Spontaneous machine breakdown check (2% chance)
          const breakableTypes = ['slots', 'video_poker', 'plinko', 'lottery', 'elec_roulette', 'elec_blackjack', 'bubble_craps', 'elec_sic_bo', 'elec_baccarat', 'atm', 'arcade_console', 'vr_pod', 'massage_chair'];
          if (breakableTypes.includes(obj.type) && !obj.isBroken) {
            if (Math.random() < 0.02) {
              obj.isBroken = true;
              console.log(`[Server:GuestAI] Machine "${obj.id}" broke down!`);
              if (sim) {
                sim.broadcast(window.Casino.Protocol.Events.GUEST_LEFT_REASON, {
                  name: obj.name,
                  reason: 'broken_machine'
                });
              }
            }
          }

          obj.earnings = obj.earnings || [];
          obj.earnings.push({ time: Date.now(), amount: cost });

          // Restore needs depending on target type
          if (['bar', 'soda_machine', 'coffee_maker', 'bubble_tea', 'vip_lounge'].includes(obj.type)) {
            this.thirst = 100;
          }
          if (['restaurant', 'vending_machine', 'candy_dispenser', 'popcorn_cart', 'pizza_oven', 'ice_cream', 'vip_lounge'].includes(obj.type)) {
            this.hunger = 100;
          }
          if (['bathroom', 'bathroom_stall', 'massage_chair', 'glow_sofa'].includes(obj.type)) {
            this.bio = 100;
          }
          if (['slots', 'video_poker', 'plinko', 'lottery', 'jazz_band', 'fountain', 'arcade_console', 'vr_pod', 'vip_lounge', 'hologram'].includes(obj.type)) {
            this.entertainment = 100;
          }
          if (obj.type === 'atm') {
            const withdrawAmount = 150 + Math.floor(Math.random() * 100);
            this.budget += withdrawAmount;
            
            const fee = 10;
            this.budget -= fee;
            economyManager.addChips(fee);
            if (sim && typeof sim.recordDayStat === 'function') {
              sim.recordDayStat('atm', fee);
            }
            
            obj.earnings = obj.earnings || [];
            obj.earnings.push({ time: Date.now(), amount: fee });

            const ui = window.Casino.clientInstance && window.Casino.clientInstance.minigameUI;
            if (ui) ui.logDebug(`${this.name} withdrew ${withdrawAmount} Chips from ATM (Fee: 10 Chips paid to Casino).`, 'success');
          }
        }
      }

      this.assignedSeatIndex = null;
      this.chooseNextAction(gridManager, sim);
    }

    serialize() {
      return {
        id: this.id,
        gridX: this.gridX,
        gridY: this.gridY,
        renderX: this.renderX,
        renderY: this.renderY,
        state: this.state,
        color: this.color,
        name: this.name,
        budget: this.budget,
        needs: { thirst: this.thirst, hunger: this.hunger, bio: this.bio, entertainment: this.entertainment },
        targetObjectId: this.targetObjectId,
        gambleTimer: this.gambleTimer
      };
    }
  }

  window.Casino.GuestAI = GuestAI;
})();
