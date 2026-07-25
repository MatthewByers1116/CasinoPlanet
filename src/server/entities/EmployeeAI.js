// Employee AI: Models Dealers and Waitresses needs, tasks, and paths
(function() {
  const States = {
    SPAWNED: 'SPAWNED',
    WALKING: 'WALKING',
    WORKING: 'WORKING',
    RESTOCKING: 'RESTOCKING',
    SATISFYING_NEED: 'SATISFYING_NEED',
    WANDERING: 'WANDERING',
    REFILLING_STAND: 'REFILLING_STAND'
  };

  function findWalkableAdjacent(gridManager, obj) {
    if (!obj) return null;
    const w = obj.width || 1;
    const h = obj.height || 1;
    const x1 = obj.gridX;
    const y1 = obj.gridY;
    const x2 = x1 + w - 1;
    const y2 = y1 + h - 1;
    
    const adjacent = [];
    for (let x = x1; x <= x2; x++) {
      adjacent.push({ x, y: y1 - 1 });
      adjacent.push({ x, y: y2 + 1 });
    }
    for (let y = y1; y <= y2; y++) {
      adjacent.push({ x: x1 - 1, y });
      adjacent.push({ x: x2 + 1, y });
    }
    
    return adjacent.find(c => gridManager.isCellWalkable(c.x, c.y)) || null;
  }

  class EmployeeAI {
    constructor(id, role, startX, startY) {
      this.id = id;
      this.role = role; // 'dealer' | 'waitress'
      this.gridX = startX;
      this.gridY = startY;

      // Interpolation values for client rendering
      this.renderX = startX;
      this.renderY = startY;

      this.state = States.SPAWNED;
      this.path = null;
      this.pathIndex = 0;
      this.speed = 3.0; // Slightly faster than guests
      this.moveProgress = 0;

      this.wanderTimer = 0;
      this.targetObjectId = null;

      // Personal needs
      this.thirst = 100;
      this.hunger = 100;
      this.bio = 100;

      // Waitress & Chef specific state
      this.drinks = 0; // Starts at 0, restocks to capacity
      this.meals = 0; // Starts at 0, restocks to capacity
      this.restockTimer = 0;

      // Need satisfaction timer
      this.consumeTimer = 0;
      this.currentNeedBeingSatisfied = null;

      // Employee Stats Levels (Range 1-5)
      this.speedLvl = 1;
      this.capacityLvl = 1;
      this.needsLvl = 1;

      // Janitor specific fields
      this.targetTileX = null;
      this.targetTileY = null;
      this.cleanTimer = 0;
    }

    update(dt, gridManager, economyManager, sim) {
      const dtSeconds = dt / 1000;

      // 1. Need Decay (disabled in Gambler's Mode to keep dealers at their tables!)
      if (sim && sim.isGamblerMode) {
        this.thirst = 100;
        this.hunger = 100;
        this.bio = 100;
      } else {
        const decayMult = 1 / (this.needsLvl || 1);
        this.thirst = Math.max(0, this.thirst - 0.4 * dtSeconds * decayMult); // thirst decays slower
        this.hunger = Math.max(0, this.hunger - 0.25 * dtSeconds * decayMult); // hunger decays slower
        this.bio = Math.max(0, this.bio - 0.3 * dtSeconds * decayMult); // bio decays slower
      }

      // Update speed dynamically based on level
      this.speed = 3.0 * (1 + ((this.speedLvl || 1) - 1) * 0.2);

      // 2. State Machine
      switch (this.state) {
        case States.SPAWNED:
          this.findJobOrWander(gridManager, sim);
          break;

        case States.WANDERING:
          this.wanderTimer -= dt;
          if (this.wanderTimer <= 0) {
            const directions = [{x:-1, y:0}, {x:1, y:0}, {x:0, y:-1}, {x:0, y:1}];
            const randDir = directions[Math.floor(Math.random() * directions.length)];
            const tx = this.gridX + randDir.x;
            const ty = this.gridY + randDir.y;
            if (gridManager.isCellWalkable(tx, ty)) {
              this.gridX = tx;
              this.gridY = ty;
            }
            this.findJobOrWander(gridManager, sim);
          }
          break;

        case States.WALKING:
          // Waitress and Chef active seeking: if walking to a guest, check if guest moved, and re-path!
          if (this.targetGuestId && (this.role === 'waitress' || this.role === 'chef')) {
            const guest = sim.guests.get(this.targetGuestId);
            if (guest && guest.state !== 'LEAVING') {
              const adj = findWalkableAdjacent(gridManager, guest);
              if (adj) {
                if (!this.path || this.path.length === 0 || 
                    Math.abs(this.path[this.path.length - 1].x - adj.x) > 1 || 
                    Math.abs(this.path[this.path.length - 1].y - adj.y) > 1) {
                  const path = window.Casino.Pathfinding.findPath(
                    gridManager,
                    this.gridX,
                    this.gridY,
                    adj.x,
                    adj.y,
                    false
                  );
                  if (path && path.length > 0) {
                    this.path = path;
                    this.pathIndex = 0;
                    this.moveProgress = 0;
                  }
                }
              }
            } else {
              // Target guest left or is leaving, abort and wander
              this.targetGuestId = null;
              this.path = null;
              this.state = States.WANDERING;
              this.wanderTimer = 500;
              break;
            }
          }

          this.tickMovement(dtSeconds, gridManager, () => {
            // Arrived!
            if (this.currentNeedBeingSatisfied) {
              this.state = States.SATISFYING_NEED;
              this.consumeTimer = 2000; // 2 seconds to consume
            } else if ((this.role === 'waitress' || this.role === 'chef') && this.targetObjectId) {
              const obj = gridManager.placedObjects.get(this.targetObjectId);
              if (obj && (obj.type === 'bar' || obj.type === 'soda_machine' || obj.type === 'restaurant' || obj.type === 'vending_machine')) {
                this.state = States.RESTOCKING;
                this.restockTimer = 2000; // 2 seconds to restock
              } else {
                this.state = States.WANDERING;
                this.wanderTimer = 1000;
              }
            } else if (this.role === 'dealer' && this.targetObjectId) {
              const obj = gridManager.placedObjects.get(this.targetObjectId);
              if (obj && obj.dealerSeat && obj.dealerSeat.employeeId === this.id) {
                this.state = States.WORKING;
              } else {
                this.targetObjectId = null;
                this.state = States.WANDERING;
                this.wanderTimer = 500;
              }
            } else if (this.role === 'tech_support' && this.targetObjectId) {
              const obj = gridManager.placedObjects.get(this.targetObjectId);
              if (obj && obj.isBroken) {
                this.state = States.WORKING;
                this.repairTimer = 0;
              } else {
                this.targetObjectId = null;
                this.state = States.WANDERING;
                this.wanderTimer = 500;
              }
            } else if (this.role === 'stocker' && this.targetObjectId) {
              const obj = gridManager.placedObjects.get(this.targetObjectId);
              if (obj && obj.stock !== null && obj.stock < obj.maxStock) {
                this.state = States.REFILLING_STAND;
                this.refillTimer = 2000;
              } else {
                this.targetObjectId = null;
                this.state = States.WANDERING;
                this.wanderTimer = 500;
              }
            } else if (this.role === 'janitor' && this.targetTileX !== null && this.targetTileY !== null) {
              this.state = States.WORKING;
              this.cleanTimer = 0;
            } else {
              this.state = States.WANDERING;
              this.wanderTimer = 1000;
            }
          });
          break;

        case States.WORKING:
          if (this.role === 'dealer') {
            // Verify table still exists and dealer still holds it
            const obj = gridManager.placedObjects.get(this.targetObjectId);
            if (!obj || !obj.dealerSeat || obj.dealerSeat.employeeId !== this.id) {
              this.targetObjectId = null;
              this.state = States.WANDERING;
              this.wanderTimer = 500;
              break;
            }
            // Just stand still at post!
            this.gridX = obj.gridX + obj.dealerSeat.rx;
            this.gridY = obj.gridY + obj.dealerSeat.ry;
            this.renderX = this.gridX;
            this.renderY = this.gridY;
          } else if (this.role === 'tech_support') {
            const obj = gridManager.placedObjects.get(this.targetObjectId);
            if (!obj || !obj.isBroken) {
              this.targetObjectId = null;
              this.state = States.WANDERING;
              this.wanderTimer = 500;
              break;
            }
            
            // Repair timer
            this.repairTimer += dt;
            if (this.repairTimer >= 3000) { // 3 seconds to repair
              obj.isBroken = false;
              obj.repairTimer = 0;
              obj.needsRepairSoon = false;
              this.targetObjectId = null;
              this.state = States.WANDERING;
              this.wanderTimer = 1000;
              
              const ui = window.Casino.clientInstance && window.Casino.clientInstance.minigameUI;
              if (ui) ui.logDebug(`Mechanic ${this.id} successfully repaired "${obj.name}"!`, 'success');
            }
          } else if (this.role === 'janitor') {
            const stillDirty = sim.dirtyTiles.some(t => t.x === this.targetTileX && t.y === this.targetTileY);
            if (!stillDirty) {
              this.targetTileX = null;
              this.targetTileY = null;
              this.state = States.WANDERING;
              this.wanderTimer = 500;
              break;
            }
            
            this.cleanTimer += dt;
            if (this.cleanTimer >= 2000) { // 2 seconds to clean
              sim.dirtyTiles = sim.dirtyTiles.filter(t => !(t.x === this.targetTileX && t.y === this.targetTileY));
              this.targetTileX = null;
              this.targetTileY = null;
              this.cleanTimer = 0;
              this.state = States.WANDERING;
              this.wanderTimer = 1000;
              
              const ui = window.Casino.clientInstance && window.Casino.clientInstance.minigameUI;
              if (ui) ui.logDebug(`Janitor ${this.id} cleaned up trash on floor!`, 'success');
            }
          }
          break;

        case States.RESTOCKING:
          this.restockTimer -= dt;
          if (this.restockTimer <= 0) {
            const cap = 5 + ((this.capacityLvl || 1) - 1) * 2;
            const obj = gridManager.placedObjects.get(this.targetObjectId);
            if (obj && obj.stock !== undefined && obj.stock !== null) {
              const amountToTake = Math.min(cap, obj.stock);
              obj.stock = Math.max(0, obj.stock - amountToTake);
              obj.isOutOfStock = obj.stock === 0;
              if (this.role === 'waitress') this.drinks = amountToTake;
              if (this.role === 'chef') this.meals = amountToTake;
            } else {
              if (this.role === 'waitress') this.drinks = cap;
              if (this.role === 'chef') this.meals = cap;
            }
            this.targetObjectId = null;
            this.state = States.WANDERING;
            this.wanderTimer = 2000 + Math.random() * 2000;
          }
          break;

        case States.SATISFYING_NEED:
          this.consumeTimer -= dt;
          if (this.consumeTimer <= 0) {
            if (this.currentNeedBeingSatisfied === 'thirst') this.thirst = 100;
            else if (this.currentNeedBeingSatisfied === 'hunger') this.hunger = 100;
            else if (this.currentNeedBeingSatisfied === 'bio') this.bio = 100;

            // Release target object seat
            if (this.targetObjectId) {
              const obj = gridManager.placedObjects.get(this.targetObjectId);
              if (obj && obj.seats && this.assignedSeatIndex !== undefined && this.assignedSeatIndex !== null) {
                const seat = obj.seats[this.assignedSeatIndex];
                if (seat && seat.guestId === this.id) {
                  seat.guestId = null;
                }
              }
            }
            this.assignedSeatIndex = null;
            this.targetObjectId = null;
            this.currentNeedBeingSatisfied = null;
            this.state = States.WANDERING;
            this.wanderTimer = 500;
          }
          break;

        case States.REFILLING_STAND:
          this.refillTimer -= dt;
          if (this.refillTimer <= 0) {
            const obj = gridManager.placedObjects.get(this.targetObjectId);
            if (obj && obj.stock !== null) {
              obj.stock = obj.maxStock;
              obj.isOutOfStock = false;
              const ui = window.Casino.clientInstance && window.Casino.clientInstance.minigameUI;
              if (ui) ui.logDebug(`Stocker ${this.id} refilled "${obj.name}"!`, 'success');
            }
            this.targetObjectId = null;
            this.state = States.WANDERING;
            this.wanderTimer = 1000 + Math.random() * 1000;
          }
          break;
      }

      // Waitress serving scan: check if target guest is close enough
      if (this.role === 'waitress' && this.drinks > 0) {
        if (this.targetGuestId) {
          const guest = sim.guests.get(this.targetGuestId);
          if (guest && guest.state !== 'LEAVING') {
            const dist = Math.sqrt((this.gridX - guest.gridX)**2 + (this.gridY - guest.gridY)**2);
            if (dist <= 1.5) {
              guest.thirst = 100;
              this.drinks--;
              economyManager.addChips(30); // Charge 30 Chips for delivery!
              
              const ui = window.Casino.clientInstance && window.Casino.clientInstance.minigameUI;
              if (ui) ui.logDebug(`Waitress ${this.id} delivered drink to ${guest.name} for 30 Chips.`, 'success');
              
              this.targetGuestId = null;
              this.path = null;
              
              if (this.drinks <= 0) {
                this.findJobOrWander(gridManager, sim);
              } else {
                this.state = States.WANDERING;
                this.wanderTimer = 500;
              }
            }
          } else {
            this.targetGuestId = null;
            this.state = States.WANDERING;
            this.wanderTimer = 500;
          }
        } else {
          // Proximity scan for any nearby thirsty guest
          for (const guest of sim.guests.values()) {
            if (guest.thirst < 60 && guest.state !== 'LEAVING') {
              const dist = Math.sqrt((this.gridX - guest.gridX)**2 + (this.gridY - guest.gridY)**2);
              if (dist <= 1.5) {
                guest.thirst = 100;
                this.drinks--;
                economyManager.addChips(30); // Charge 30 Chips
                
                const ui = window.Casino.clientInstance && window.Casino.clientInstance.minigameUI;
                if (ui) ui.logDebug(`Waitress ${this.id} served nearby guest ${guest.name} for 30 Chips.`, 'success');
                
                if (this.drinks <= 0) {
                  this.targetGuestId = null;
                  this.path = null;
                  this.findJobOrWander(gridManager, sim);
                } else {
                  this.state = States.WANDERING;
                  this.wanderTimer = 500;
                }
                break;
              }
            }
          }
        }
      }

      // Chef food serving scan
      if (this.role === 'chef' && this.meals > 0) {
        if (this.targetGuestId) {
          const guest = sim.guests.get(this.targetGuestId);
          if (guest && guest.state !== 'LEAVING') {
            const dist = Math.sqrt((this.gridX - guest.gridX)**2 + (this.gridY - guest.gridY)**2);
            if (dist <= 1.5) {
              guest.hunger = 100;
              this.meals--;
              economyManager.addChips(40); // Charge 40 Chips for meal delivery!
              
              const ui = window.Casino.clientInstance && window.Casino.clientInstance.minigameUI;
              if (ui) ui.logDebug(`Chef ${this.id} delivered meal to ${guest.name} for 40 Chips.`, 'success');
              
              this.targetGuestId = null;
              this.path = null;
              
              if (this.meals <= 0) {
                this.findJobOrWander(gridManager, sim);
              } else {
                this.state = States.WANDERING;
                this.wanderTimer = 500;
              }
            }
          } else {
            this.targetGuestId = null;
            this.state = States.WANDERING;
            this.wanderTimer = 500;
          }
        } else {
          // Proximity scan for hungry guests
          for (const guest of sim.guests.values()) {
            if (guest.hunger < 60 && guest.state !== 'LEAVING') {
              const dist = Math.sqrt((this.gridX - guest.gridX)**2 + (this.gridY - guest.gridY)**2);
              if (dist <= 1.5) {
                guest.hunger = 100;
                this.meals--;
                economyManager.addChips(40); // Charge 40 Chips
                
                const ui = window.Casino.clientInstance && window.Casino.clientInstance.minigameUI;
                if (ui) ui.logDebug(`Chef ${this.id} served nearby guest ${guest.name} for 40 Chips.`, 'success');
                
                if (this.meals <= 0) {
                  this.findJobOrWander(gridManager, sim);
                } else {
                  this.state = States.WANDERING;
                  this.wanderTimer = 500;
                }
                break;
              }
            }
          }
        }
      }

      // Security Guard behavior
      if (this.role === 'security' && sim && sim.employees) {
        for (const [id, emp] of sim.employees.entries()) {
          if (emp.role === 'pickpocket') {
            const dist = Math.sqrt((emp.gridX - this.gridX)**2 + (emp.gridY - this.gridY)**2);
            if (dist <= 1.5) {
              sim.employees.delete(id);
              console.log(`[Server:EmployeeAI] Security Guard "${this.id}" caught pickpocket "${id}"!`);
              
              sim.broadcast(sim.Protocol?.Events?.GUEST_LEFT_REASON || 'GUEST_LEFT_REASON', {
                name: `Security Guard caught a pickpocket`,
                reason: 'pickpocket_captured_by_staff'
              });
              
              this.state = States.WANDERING;
              this.wanderTimer = 1000;
              this.targetObjectId = null;
              this.path = null;
              break;
            }
          }
        }
      }

      // Stage Entertainer behavior
      if (this.role === 'entertainer' && sim && sim.guests) {
        this.performTimer = (this.performTimer || 0) + dt;
        if (this.performTimer >= 4000) {
          this.performTimer = 0;
          sim.guests.forEach(g => {
            const dist = Math.sqrt((g.gridX - this.gridX)**2 + (g.gridY - this.gridY)**2);
            if (dist <= 5.0) {
              g.entertainment = 100;
            }
          });
        }
      }

      // Pickpocket behavior
      if (this.role === 'pickpocket' && sim) {
        this.stealTimer = (this.stealTimer || 0) + dt;
        if (this.stealTimer >= 8000) {
          this.stealTimer = 0;
          for (const guest of sim.guests.values()) {
            if (guest.budget >= 10 && guest.state !== 'LEAVING') {
              const dist = Math.sqrt((guest.gridX - this.gridX)**2 + (guest.gridY - this.gridY)**2);
              if (dist <= 1.5) {
                guest.budget = Math.max(0, guest.budget - 10);
                sim.broadcast(sim.Protocol?.Events?.GUEST_LEFT_REASON || 'GUEST_LEFT_REASON', {
                  name: guest.name,
                  reason: 'pickpocketed'
                });
                break;
              }
            }
          }
        }
      }

      // Smooth rendering interpolation
      const lerpSpeed = 0.2;
      this.renderX += (this.gridX - this.renderX) * lerpSpeed;
      this.renderY += (this.gridY - this.renderY) * lerpSpeed;
    }

    findJobOrWander(gridManager, sim) {
      const objects = Array.from(gridManager.placedObjects.values());

      // 1. Check if needs are critical and satisfy them first
      if (this.thirst < 25 || this.hunger < 25 || this.bio < 25) {
        if (this.role === 'dealer' && this.targetObjectId) {
          const oldTable = gridManager.placedObjects.get(this.targetObjectId);
          if (oldTable && oldTable.dealerSeat && oldTable.dealerSeat.employeeId === this.id) {
            oldTable.dealerSeat.employeeId = null;
          }
          this.targetObjectId = null;
        }
        let reqTypes = null;
        if (this.thirst < 25) {
          reqTypes = ['bar', 'soda_machine'];
          this.currentNeedBeingSatisfied = 'thirst';
        } else if (this.hunger < 25) {
          reqTypes = ['restaurant', 'vending_machine'];
          this.currentNeedBeingSatisfied = 'hunger';
        } else {
          reqTypes = ['bathroom', 'bathroom_stall'];
          this.currentNeedBeingSatisfied = 'bio';
        }

        const options = objects.filter(obj => reqTypes.includes(obj.type) && obj.seats && obj.seats.some(s => s.guestId === null));
        if (options.length > 0) {
          const chosen = options[Math.floor(Math.random() * options.length)];
          const freeSeat = chosen.seats.find(s => s.guestId === null);
          if (freeSeat) {
            freeSeat.guestId = this.id;
            this.assignedSeatIndex = chosen.seats.indexOf(freeSeat);
            this.targetObjectId = chosen.id;

            const path = window.Casino.Pathfinding.findPath(
              gridManager,
              this.gridX,
              this.gridY,
              chosen.gridX + freeSeat.rx,
              chosen.gridY + freeSeat.ry,
              false
            );
            if (path && path.length > 0) {
              this.path = path;
              this.pathIndex = 0;
              this.moveProgress = 0;
              this.state = States.WALKING;
              return;
            } else {
              freeSeat.guestId = null;
              this.assignedSeatIndex = null;
              this.targetObjectId = null;
            }
          }
        }
        // Fallback: if no empty seats/restrooms available, wander until there is space
        this.currentNeedBeingSatisfied = null;
      }

      // 2. Role-specific tasks
      if (this.role === 'dealer') {
        // Find unstaffed table games
        const openTables = objects.filter(obj => 
          ['roulette', 'craps', 'blackjack', 'ride_the_bus', 'three_card_poker', 'baccarat', 'texas_holdem', 'pai_gow', 'sic_bo', 'caribbean_stud', 'big_six', 'let_it_ride', 'red_dog', 'spanish_21', 'casino_war'].includes(obj.type) && 
          obj.dealerSeat && 
          obj.dealerSeat.employeeId === null
        );

        if (openTables.length > 0) {
          const chosen = openTables[Math.floor(Math.random() * openTables.length)];
          chosen.dealerSeat.employeeId = this.id;
          this.targetObjectId = chosen.id;

          const dx = chosen.gridX + chosen.dealerSeat.rx;
          const dy = chosen.gridY + chosen.dealerSeat.ry;

          const path = window.Casino.Pathfinding.findPath(gridManager, this.gridX, this.gridY, dx, dy, false);
          if (path && path.length > 0) {
            this.path = path;
            this.pathIndex = 0;
            this.moveProgress = 0;
            this.state = States.WALKING;
            return;
          } else {
            // Path blocked, release seat
            chosen.dealerSeat.employeeId = null;
            this.targetObjectId = null;
          }
        }

        // Wander if no open tables
        this.state = States.WANDERING;
        this.wanderTimer = 1000 + Math.random() * 1000;
      } else if (this.role === 'waitress') {
        // If out of drinks, must go to Cocktail Bar or Soda Machine to restock
        if (this.drinks <= 0) {
          const bars = objects.filter(obj => (obj.type === 'bar' || obj.type === 'soda_machine' || obj.type === 'coffee_maker' || obj.type === 'bubble_tea') && !obj.isOutOfStock);
          if (bars.length > 0) {
            // Find closest bar
            let closestBar = null;
            let minDist = Infinity;
            bars.forEach(b => {
              const dist = Math.sqrt((this.gridX - b.gridX)**2 + (this.gridY - b.gridY)**2);
              if (dist < minDist) {
                minDist = dist;
                closestBar = b;
              }
            });
            
            if (closestBar) {
              const adj = findWalkableAdjacent(gridManager, closestBar);
              if (adj) {
                this.targetObjectId = closestBar.id;
                const path = window.Casino.Pathfinding.findPath(
                  gridManager,
                  this.gridX,
                  this.gridY,
                  adj.x,
                  adj.y,
                  false
                );
                if (path && path.length > 0) {
                  this.path = path;
                  this.pathIndex = 0;
                  this.moveProgress = 0;
                  this.state = States.WALKING;
                  return;
                } else {
                  this.targetObjectId = null;
                }
              }
            }
          }
        } else {
          // Find thirsty guests to serve
          const thirstyGuests = Array.from(sim.guests.values()).filter(g => g.thirst < 50 && g.state !== 'LEAVING');
          if (thirstyGuests.length > 0) {
            // Pick random thirsty guest
            const target = thirstyGuests[Math.floor(Math.random() * thirstyGuests.length)];
            const adj = findWalkableAdjacent(gridManager, target);
            if (adj) {
              this.targetGuestId = target.id;
              const path = window.Casino.Pathfinding.findPath(
                gridManager,
                this.gridX,
                this.gridY,
                adj.x,
                adj.y,
                false
              );
              if (path && path.length > 0) {
                this.path = path;
                this.pathIndex = 0;
                this.moveProgress = 0;
                this.state = States.WALKING;
                return;
              } else {
                this.targetGuestId = null;
              }
            }
          }
        }

        this.state = States.WANDERING;
        this.wanderTimer = 1000 + Math.random() * 1000;
      } else if (this.role === 'chef') {
        // If out of meals, must go to Restaurant or Vending Machine to restock
        if (this.meals <= 0) {
          const kitchens = objects.filter(obj => (obj.type === 'restaurant' || obj.type === 'vending_machine' || obj.type === 'candy_dispenser' || obj.type === 'popcorn_cart' || obj.type === 'pizza_oven' || obj.type === 'ice_cream') && !obj.isOutOfStock);
          if (kitchens.length > 0) {
            // Find closest kitchen
            let closestKitchen = null;
            let minDist = Infinity;
            kitchens.forEach(k => {
              const dist = Math.sqrt((this.gridX - k.gridX)**2 + (this.gridY - k.gridY)**2);
              if (dist < minDist) {
                minDist = dist;
                closestKitchen = k;
              }
            });
            
            if (closestKitchen) {
              const adj = findWalkableAdjacent(gridManager, closestKitchen);
              if (adj) {
                this.targetObjectId = closestKitchen.id;
                const path = window.Casino.Pathfinding.findPath(
                  gridManager,
                  this.gridX,
                  this.gridY,
                  adj.x,
                  adj.y,
                  false
                );
                if (path && path.length > 0) {
                  this.path = path;
                  this.pathIndex = 0;
                  this.moveProgress = 0;
                  this.state = States.WALKING;
                  return;
                } else {
                  this.targetObjectId = null;
                }
              }
            }
          }
        } else {
          // Find hungry guests to serve
          const hungryGuests = Array.from(sim.guests.values()).filter(g => g.hunger < 50 && g.state !== 'LEAVING');
          if (hungryGuests.length > 0) {
            const target = hungryGuests[Math.floor(Math.random() * hungryGuests.length)];
            const adj = findWalkableAdjacent(gridManager, target);
            if (adj) {
              this.targetGuestId = target.id;
              const path = window.Casino.Pathfinding.findPath(
                gridManager,
                this.gridX,
                this.gridY,
                adj.x,
                adj.y,
                false
              );
              if (path && path.length > 0) {
                this.path = path;
                this.pathIndex = 0;
                this.moveProgress = 0;
                this.state = States.WALKING;
                return;
              } else {
                this.targetGuestId = null;
              }
            }
          }
        }

        this.state = States.WANDERING;
        this.wanderTimer = 1000 + Math.random() * 1000;
      } else if (this.role === 'tech_support') {
        // Find broken machines
        const brokenObjs = objects.filter(obj => obj.isBroken);
        if (brokenObjs.length > 0) {
          const chosen = brokenObjs[Math.floor(Math.random() * brokenObjs.length)];
          const adj = findWalkableAdjacent(gridManager, chosen);
          if (adj) {
            this.targetObjectId = chosen.id;
            const path = window.Casino.Pathfinding.findPath(
              gridManager,
              this.gridX,
              this.gridY,
              adj.x,
              adj.y,
              false
            );
            if (path && path.length > 0) {
              this.path = path;
              this.pathIndex = 0;
              this.moveProgress = 0;
              this.state = States.WALKING;
              return;
            } else {
              this.targetObjectId = null;
            }
          }
        }
        
        this.state = States.WANDERING;
        this.wanderTimer = 1000 + Math.random() * 1000;
      } else if (this.role === 'stocker') {
        // Find out-of-stock or low-stock objects
        const refillables = objects.filter(obj => 
          ['bar', 'restaurant', 'soda_machine', 'vending_machine', 'candy_dispenser', 'coffee_maker', 'popcorn_cart', 'pizza_oven', 'ice_cream', 'bubble_tea'].includes(obj.type) &&
          obj.stock !== null && obj.stock < obj.maxStock
        );
        if (refillables.length > 0) {
          // Find closest
          let closest = null;
          let minDist = Infinity;
          refillables.forEach(r => {
            const dist = Math.sqrt((this.gridX - r.gridX)**2 + (this.gridY - r.gridY)**2);
            if (dist < minDist) {
              minDist = dist;
              closest = r;
            }
          });
          if (closest) {
            const adj = findWalkableAdjacent(gridManager, closest);
            if (adj) {
              this.targetObjectId = closest.id;
              const path = window.Casino.Pathfinding.findPath(
                gridManager,
                this.gridX,
                this.gridY,
                adj.x,
                adj.y,
                false
              );
              if (path && path.length > 0) {
                this.path = path;
                this.pathIndex = 0;
                this.moveProgress = 0;
                this.state = States.WALKING;
                return;
              } else {
                this.targetObjectId = null;
              }
            }
          }
        }
        this.state = States.WANDERING;
        this.wanderTimer = 1000 + Math.random() * 1000;
      } else if (this.role === 'janitor') {
        // Find closest dirty tile
        if (sim.dirtyTiles && sim.dirtyTiles.length > 0) {
          let closestTile = null;
          let minDist = Infinity;
          sim.dirtyTiles.forEach(t => {
            const dist = Math.sqrt((this.gridX - t.x)**2 + (this.gridY - t.y)**2);
            if (dist < minDist) {
              minDist = dist;
              closestTile = t;
            }
          });
          
          if (closestTile) {
            const path = window.Casino.Pathfinding.findPath(gridManager, this.gridX, this.gridY, closestTile.x, closestTile.y, false);
            if (path && path.length > 0) {
              this.targetTileX = closestTile.x;
              this.targetTileY = closestTile.y;
              this.cleanTimer = 0;
              this.path = path;
              this.pathIndex = 0;
              this.moveProgress = 0;
              this.state = States.WALKING;
              return;
            }
          }
        }
        this.state = States.WANDERING;
        this.wanderTimer = 1000 + Math.random() * 1000;
      } else {
        this.state = States.WANDERING;
        this.wanderTimer = 1000 + Math.random() * 1000;
      }
    }

    tickMovement(dtSeconds, gridManager, onArrived) {
      if (!this.path || this.pathIndex >= this.path.length) {
        onArrived();
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
          false
        );
        if (newPath && newPath.length > 0) {
          this.path = newPath;
          this.pathIndex = 0;
        } else {
          onArrived(); // cancel move
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

        if (this.pathIndex >= this.path.length) {
          this.path = null;
          onArrived();
        }
      }
    }

    serialize() {
      return {
        id: this.id,
        role: this.role,
        gridX: this.gridX,
        gridY: this.gridY,
        renderX: this.renderX,
        renderY: this.renderY,
        state: this.state,
        drinks: this.drinks,
        meals: this.meals,
        needs: { thirst: this.thirst, hunger: this.hunger, bio: this.bio },
        targetObjectId: this.targetObjectId,
        speedLvl: this.speedLvl || 1,
        capacityLvl: this.capacityLvl || 1,
        needsLvl: this.needsLvl || 1
      };
    }
  }

  window.Casino.EmployeeAI = EmployeeAI;
})();
