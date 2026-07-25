// Renderer: Renders grid carpet, boundaries, tables, players, and guests on canvas
(function() {
  class Renderer {
    constructor(canvas, cellSize) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cellSize = cellSize;
      this.offsetX = 0;
      this.offsetY = 0;
      
      // Load fonts or setup styling variables
      this.ctx.imageSmoothingEnabled = false;
    }

    clear() {
      this.ctx.fillStyle = '#07070f';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw(state, buildItem, mouseGridX, mouseGridY, isPlacementValid, activePlayerId) {
      this.clear();
      
      this.ctx.save();
      this.ctx.translate(this.offsetX, this.offsetY);
      
      const grid = state.grid;
      const cols = grid.cols;
      const rows = grid.rows;

      // 1. Draw Casino Carpet Grid
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const isEntrance = (y === rows - 1 && Math.abs(x - Math.floor(cols / 2)) <= 1);
          
          if (y === 0 || x === 0 || x === cols - 1 || (y === rows - 1 && !isEntrance)) {
            // Draw wall tiles
            this.ctx.fillStyle = '#22223b';
            this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
            
            // Wall outline
            this.ctx.strokeStyle = '#4a4e69';
            this.ctx.strokeRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);

            // Wall neon strip on the bottom edge of top walls
            if (y === 0) {
              this.ctx.fillStyle = '#ff007f';
              this.ctx.fillRect(x * this.cellSize, (y + 1) * this.cellSize - 3, this.cellSize, 3);
            }
          } else {
            // Draw carpet pattern
            const isAlt = (x + y) % 2 === 0;
            this.ctx.fillStyle = isAlt ? '#16162a' : '#121224';
            this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
            
            // Subtle carpet detail lines
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
            this.ctx.strokeRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);

            if (isEntrance) {
              // Draw entrance doormat
              this.ctx.fillStyle = '#3a2212';
              this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
              this.ctx.fillStyle = '#ffd700';
              this.ctx.font = '8px monospace';
              this.ctx.fillText("WELCOME", x * this.cellSize + 2, y * this.cellSize + 20);
            }
          }
        }
      }

      // 1.1 Draw Dirty Floor Tile Smudges
      if (state.dirtyTiles) {
        state.dirtyTiles.forEach(t => {
          this.ctx.fillStyle = 'rgba(101, 67, 33, 0.45)'; // Muddy puddle brown
          this.ctx.beginPath();
          const cx = t.x * this.cellSize + this.cellSize / 2;
          const cy = t.y * this.cellSize + this.cellSize / 2;
          // Overlay arcs to create irregular splash puddle shape
          this.ctx.arc(cx, cy, this.cellSize * 0.35, 0, Math.PI * 2);
          this.ctx.arc(cx - 4, cy + 3, this.cellSize * 0.22, 0, Math.PI * 2);
          this.ctx.arc(cx + 4, cy - 3, this.cellSize * 0.18, 0, Math.PI * 2);
          this.ctx.fill();
        });
      }

      // 2. Draw Placed Tables/Objects
      state.grid.objects.forEach(obj => {
        const xPx = obj.gridX * this.cellSize;
        const yPx = obj.gridY * this.cellSize;
        const wPx = obj.width * this.cellSize;
        const hPx = obj.height * this.cellSize;

        // Table Shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.fillRect(xPx + 4, yPx + 4, wPx, hPx);

        // Wooden Table Border
        this.ctx.fillStyle = '#4a2c11';
        this.ctx.fillRect(xPx, yPx, wPx, hPx);

        // Inner Felt
        this.ctx.fillStyle = obj.color;
        this.ctx.fillRect(xPx + 4, yPx + 4, wPx - 8, hPx - 8);

        // Neon Glow Outline
        this.ctx.strokeStyle = obj.accentColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(xPx + 1, yPx + 1, wPx - 2, hPx - 2);
        this.ctx.lineWidth = 1;

        // Draw Icon Emoji
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(obj.icon, xPx + wPx / 2, yPx + hPx / 2 - 4);

        // Draw Table Name Label
        let labelName = obj.name.toUpperCase();
        if (obj.width === 1 && obj.height === 1) {
          if (obj.type === 'slots') labelName = 'SLOTS';
          else if (obj.type === 'soda_machine') labelName = 'SODA';
          else if (obj.type === 'vending_machine') labelName = 'SNACKS';
          else if (obj.type === 'bathroom_stall') labelName = 'TOILET';
          else if (obj.type === 'elec_roulette') labelName = 'ROULETTE';
          else if (obj.type === 'elec_blackjack') labelName = 'BLACKJACK';
          else if (obj.type === 'bubble_craps') labelName = 'CRAPS';
          else if (obj.type === 'atm') labelName = 'ATM';
          else if (obj.type === 'video_poker') labelName = 'VP POKER';
          else if (obj.type === 'elec_sic_bo') labelName = 'SIC BO';
          else if (obj.type === 'elec_baccarat') labelName = 'BACCARAT';
          else if (obj.type === 'plinko') labelName = 'PLINKO';
          else if (obj.type === 'lottery') labelName = 'LOTTERY';
          else if (obj.type === 'palm_tree') labelName = 'PALM';
          else if (obj.type === 'arcade_console') labelName = 'ARCADE';
          else if (obj.type === 'candy_dispenser') labelName = 'CANDY';
          else if (obj.type === 'coffee_maker') labelName = 'COFFEE';
          else if (obj.type === 'popcorn_cart') labelName = 'POPCORN';
          else if (obj.type === 'gold_statue') labelName = 'STATUE';
          else if (obj.type === 'hologram') labelName = 'HOLOGRAM';
          else if (obj.type === 'minigame_machine') labelName = 'ARCADE';
          else if (obj.type === 'massage_chair') labelName = 'MASSAGE';
          this.ctx.font = 'bold 8px "Outfit", sans-serif';
        } else {
          this.ctx.font = '7px "Press Start 2P", monospace';
          // Strip " TABLE" suffix for a cleaner premium name label
          if (labelName.endsWith(" TABLE")) {
            labelName = labelName.slice(0, -6);
          }
        }
        
        this.ctx.save();
        this.ctx.fillStyle = '#a0a0c0';
        this.ctx.textAlign = 'center';
        
        // Dynamically scale font horizontally if it exceeds table boundaries (with 3px padding on both sides)
        const maxTextWidth = wPx - 6;
        let textWidth = this.ctx.measureText(labelName).width;
        let scaleX = 1;
        if (textWidth > maxTextWidth) {
          scaleX = maxTextWidth / textWidth;
        }
        
        const textX = xPx + wPx / 2;
        const textY = yPx + hPx - (obj.height === 1 ? 6 : 14);
        
        if (scaleX < 1) {
          this.ctx.translate(textX, textY);
          this.ctx.scale(scaleX, 1);
          this.ctx.fillText(labelName, 0, 0);
        } else {
          this.ctx.fillText(labelName, textX, textY);
        }
        this.ctx.restore();

        // Draw EPS overlay in Detailed Mode
        const clientInstance = window.Casino.clientInstance;
        if (clientInstance && clientInstance.detailedMode) {
          this.ctx.fillStyle = '#39ff14'; // Bright green for profit!
          this.ctx.font = 'bold 9px "Outfit", sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(`+${(obj.eps || 0).toFixed(1)}/s`, xPx + wPx / 2, yPx - 5);
        }

        // Draw Dealer Seat if table game has one
        if (obj.dealerSeat) {
          const dsX = obj.gridX + obj.dealerSeat.rx;
          const dsY = obj.gridY + obj.dealerSeat.ry;
          const dsxPx = dsX * this.cellSize;
          const dsyPx = dsY * this.cellSize;

          // Draw small blue/navy chair for the Dealer
          this.ctx.beginPath();
          this.ctx.arc(dsxPx + this.cellSize / 2, dsyPx + this.cellSize / 2, 7, 0, Math.PI * 2);
          this.ctx.fillStyle = '#1c2434'; // Navy dealer seat
          this.ctx.fill();
          this.ctx.strokeStyle = obj.dealerSeat.employeeId ? '#39ff14' : '#00f0ff'; // Green if dealer is working, Cyan otherwise
          this.ctx.lineWidth = 1.5;
          this.ctx.stroke();
          this.ctx.lineWidth = 1;

          // Dealer stool cushion center details
          this.ctx.fillStyle = '#fff';
          this.ctx.font = '6px Arial';
          this.ctx.fillText("D", dsxPx + this.cellSize / 2, dsyPx + this.cellSize / 2 + 1);
        }

        // Render physical stools/seats on the adjacent carpet tiles
        if (obj.seats) {
          obj.seats.forEach((seat, idx) => {
            const seatX = obj.gridX + seat.rx;
            const seatY = obj.gridY + seat.ry;
            const sxPx = seatX * this.cellSize;
            const syPx = seatY * this.cellSize;

            // Draw a small stool: brown wooden circle with gold/green accent outline
            this.ctx.beginPath();
            this.ctx.arc(sxPx + this.cellSize / 2, syPx + this.cellSize / 2, 7, 0, Math.PI * 2);
            this.ctx.fillStyle = '#5c4033'; // Wood brown stool seat
            this.ctx.fill();
            this.ctx.strokeStyle = seat.guestId ? '#39ff14' : '#ffd700'; // Green if guest is seated, gold otherwise
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
            this.ctx.lineWidth = 1;

            // Stool cushion texture center
            this.ctx.beginPath();
            this.ctx.arc(sxPx + this.cellSize / 2, syPx + this.cellSize / 2, 3, 0, Math.PI * 2);
            this.ctx.fillStyle = '#3e2723';
            this.ctx.fill();
          });
        }

        // Draw Broken Warning Wrench overlay
        if (obj.isBroken) {
          this.ctx.fillStyle = 'rgba(255, 0, 0, 0.25)';
          this.ctx.fillRect(xPx, yPx, wPx, hPx);

          this.ctx.fillStyle = '#ff003c';
          this.ctx.font = '16px Arial';
          this.ctx.textAlign = 'center';
          const bob = Math.sin(performance.now() * 0.01) * 3;
          this.ctx.fillText('🔧', xPx + wPx / 2, yPx + hPx / 2 - 8 + bob);
          
          this.ctx.fillStyle = '#ff4d4d';
          this.ctx.font = 'bold 8px Arial';
          this.ctx.fillText('REPAIR', xPx + wPx / 2, yPx + hPx - 6);
        } else if (obj.isOutOfStock) {
          this.ctx.fillStyle = 'rgba(255, 100, 0, 0.2)';
          this.ctx.fillRect(xPx, yPx, wPx, hPx);

          this.ctx.fillStyle = '#ff6c00';
          this.ctx.font = '14px Arial';
          this.ctx.textAlign = 'center';
          const bob = Math.sin(performance.now() * 0.01) * 3;
          this.ctx.fillText('📦', xPx + wPx / 2, yPx + hPx / 2 - 8 + bob);
          
          this.ctx.fillStyle = '#ffaa00';
          this.ctx.font = 'bold 8px "Outfit", sans-serif';
          this.ctx.fillText('EMPTY', xPx + wPx / 2, yPx + hPx - 6);
        }
      });

      // 3. Draw Guests
      Object.values(state.guests).forEach(guest => {
        const xPx = guest.renderX * this.cellSize + this.cellSize / 2;
        const yPx = guest.renderY * this.cellSize + this.cellSize / 2;

        // Shadow
        this.ctx.beginPath();
        this.ctx.arc(xPx, yPx + 12, 6, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fill();

        // Guest Body (Circular Stardew Valley blob shape)
        this.ctx.beginPath();
        this.ctx.arc(xPx, yPx, 10, 0, Math.PI * 2);
        this.ctx.fillStyle = guest.color;
        this.ctx.fill();
        this.ctx.strokeStyle = '#fff';
        this.ctx.stroke();

        // Guest Head/Face (bobbing up/down slightly based on time)
        const bob = Math.sin(performance.now() * 0.01 + guest.gridX * 2) * 1.5;
        this.ctx.beginPath();
        this.ctx.arc(xPx, yPx - 6 + bob, 6, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ffd1a4'; // Skin tone
        this.ctx.fill();
        this.ctx.strokeStyle = '#000';
        this.ctx.stroke();

        // Name tag and state
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '8px "Outfit", sans-serif';
        this.ctx.fillText(guest.name, xPx, yPx - 20);

        // State indicator
        if (guest.state === 'GAMBLING') {
          this.ctx.fillStyle = '#ffd700';
          this.ctx.font = 'bold 9px "Outfit", sans-serif';
          this.ctx.fillText("🎰 Playing...", xPx, yPx + 24);
        } else if (guest.state === 'LEAVING') {
          this.ctx.fillStyle = '#ff4d4d';
          this.ctx.font = '8px "Outfit", sans-serif';
          this.ctx.fillText("👋 Leaving", xPx, yPx + 24);
        }

        // Draw needs indicator if any need is below 50
        if (guest.needs) {
          const minNeed = Math.min(
            guest.needs.thirst, 
            guest.needs.hunger, 
            guest.needs.bio, 
            guest.needs.entertainment !== undefined ? guest.needs.entertainment : 100
          );
          if (minNeed < 50) {
            let icon = '🍺';
            let barColor = '#00f0ff';
            if (guest.needs.hunger === minNeed) {
              icon = '🍔';
              barColor = '#ffaa00';
            } else if (guest.needs.bio === minNeed) {
              icon = '🚻';
              barColor = '#39ff14';
            } else if (guest.needs.entertainment === minNeed) {
              icon = '🎵';
              barColor = '#e64dff';
            }

            // Draw needs warning bar
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.fillRect(xPx - 12, yPx - 28, 24, 3);
            this.ctx.fillStyle = barColor;
            this.ctx.fillRect(xPx - 12, yPx - 28, Math.max(0, Math.floor(24 * (minNeed / 100))), 3);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '8px "Outfit", sans-serif';
            this.ctx.fillText(icon, xPx, yPx - 34);
          }
        }
      });

      // 3.5 Draw Employees
      if (state.employees) {
        Object.values(state.employees).forEach(emp => {
          const xPx = emp.renderX * this.cellSize + this.cellSize / 2;
          const yPx = emp.renderY * this.cellSize + this.cellSize / 2;

          // Shadow
          this.ctx.beginPath();
          this.ctx.arc(xPx, yPx + 12, 6, 0, Math.PI * 2);
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          this.ctx.fill();

          // Body
          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.arc(xPx, yPx, 10, 0, Math.PI * 2);
          
          let bodyColor = '#e64dff'; // default purple (waitress)
          let icon = '👩‍🍳';
          if (emp.role === 'dealer') {
            bodyColor = '#1c2434';
            icon = '🤵';
          } else if (emp.role === 'chef') {
            bodyColor = '#e67e22';
            icon = '🍳';
          } else if (emp.role === 'scientist') {
            bodyColor = '#2ecc71';
            icon = '🧪';
          } else if (emp.role === 'manager') {
            bodyColor = '#f1c40f';
            icon = '💼';
          } else if (emp.role === 'security') {
            bodyColor = '#2980b9';
            icon = '👮';
          } else if (emp.role === 'tech_support') {
            bodyColor = '#7f8c8d';
            icon = '🔧';
          } else if (emp.role === 'entertainer') {
            bodyColor = '#9b59b6';
            icon = '🎭';
          } else if (emp.role === 'pickpocket') {
            bodyColor = '#111';
            icon = '👤';
          }
          
          this.ctx.fillStyle = bodyColor;
          this.ctx.fill();

          if (emp.role === 'pickpocket') {
            this.ctx.clip();
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(xPx - 12, yPx - 7, 24, 3);
            this.ctx.fillRect(xPx - 12, yPx - 1, 24, 3);
            this.ctx.fillRect(xPx - 12, yPx + 5, 24, 3);
          }
          this.ctx.restore();

          this.ctx.beginPath();
          this.ctx.arc(xPx, yPx, 10, 0, Math.PI * 2);
          this.ctx.strokeStyle = '#fff';
          this.ctx.stroke();

          // Head (bobbing)
          const bob = Math.sin(performance.now() * 0.01 + emp.gridX * 2) * 1.5;
          this.ctx.beginPath();
          this.ctx.arc(xPx, yPx - 6 + bob, 6, 0, Math.PI * 2);
          this.ctx.fillStyle = '#ffd1a4'; // Skin tone
          this.ctx.fill();
          this.ctx.strokeStyle = '#000';
          this.ctx.stroke();

          // Draw dealer hat on bobbing head
          if (emp.role === 'dealer') {
            this.ctx.fillStyle = '#111';
            // Brim
            this.ctx.fillRect(xPx - 8, yPx - 12 + bob, 16, 2);
            // Crown
            this.ctx.fillRect(xPx - 5, yPx - 18 + bob, 10, 6);
            // Hat band
            this.ctx.fillStyle = '#ff007f'; // neon pink
            this.ctx.fillRect(xPx - 5, yPx - 14 + bob, 10, 2);
          }

          // Role icon label
          this.ctx.fillStyle = '#fff';
          this.ctx.font = '8px "Outfit", sans-serif';
          this.ctx.fillText(`${icon} ${emp.role.toUpperCase()}`, xPx, yPx - 18);

          // State indicator
          if (emp.state === 'WORKING') {
            this.ctx.fillStyle = '#39ff14';
            this.ctx.font = 'bold 8px "Outfit", sans-serif';
            this.ctx.fillText("💼 Working", xPx, yPx + 22);
          } else if (emp.state === 'RESTOCKING') {
            this.ctx.fillStyle = '#00f0ff';
            this.ctx.font = '8px "Outfit", sans-serif';
            this.ctx.fillText("🍺 Restock", xPx, yPx + 22);
          } else if (emp.state === 'SATISFYING_NEED') {
            this.ctx.fillStyle = '#ffaa00';
            this.ctx.font = '8px "Outfit", sans-serif';
            this.ctx.fillText("🍕 Break", xPx, yPx + 22);
          } else {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '8px "Outfit", sans-serif';
            this.ctx.fillText("🚶 Wander", xPx, yPx + 22);
          }

          // Waitress carrying drinks counter
          if (emp.role === 'waitress') {
            this.ctx.fillStyle = '#00f0ff';
            this.ctx.font = 'bold 8px "Outfit", sans-serif';
            this.ctx.fillText(`🍹 ${emp.drinks}/5`, xPx, yPx - 26);
          } else if (emp.role === 'chef') {
            this.ctx.fillStyle = '#ffaa00';
            this.ctx.font = 'bold 8px "Outfit", sans-serif';
            this.ctx.fillText(`🍱 ${emp.meals || 0}/5`, xPx, yPx - 26);
          }
        });
      }

      // 4. Draw Players (main player & others)
      Object.values(state.players).forEach(p => {
        const isMainPlayer = (p.id === activePlayerId);
        
        // Use grid position for server authority
        const xPx = p.gridX * this.cellSize + this.cellSize / 2;
        const yPx = p.gridY * this.cellSize + this.cellSize / 2;

        // Shadow
        this.ctx.beginPath();
        this.ctx.arc(xPx, yPx + 12, 7, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.fill();

        // Character Body (Main is Cyan suit, others Purple suit)
        this.ctx.beginPath();
        this.ctx.arc(xPx, yPx, 11, 0, Math.PI * 2);
        this.ctx.fillStyle = isMainPlayer ? '#00f0ff' : '#a020f0';
        this.ctx.fill();
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.lineWidth = 1;

        // Head/Face
        const bob = Math.sin(performance.now() * 0.008) * 1.5;
        this.ctx.beginPath();
        this.ctx.arc(xPx, yPx - 7 + bob, 7, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ffe0bd';
        this.ctx.fill();
        this.ctx.strokeStyle = '#000';
        this.ctx.stroke();

        // Stylish sunglasses (he is a casino manager, after all)
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(xPx - 4, yPx - 9 + bob, 9, 3);
        
        // Hair / Hat (Retro golden crown or hair)
        this.ctx.fillStyle = '#ffb300';
        this.ctx.fillRect(xPx - 5, yPx - 14 + bob, 10, 4);

        // Name tag
        this.ctx.fillStyle = isMainPlayer ? '#00f0ff' : '#39ff14';
        this.ctx.font = 'bold 9px "Outfit", sans-serif';
        const label = isMainPlayer ? `${p.name || "MANAGER"} (YOU)` : (p.name || `P_${p.id.substring(0,4)}`);
        this.ctx.fillText(label, xPx, yPx - 22);

        // Render carrying status
        if (p.holdingDrink) {
          this.ctx.fillStyle = '#00f0ff';
          this.ctx.font = 'bold 8px "Outfit", sans-serif';
          this.ctx.fillText("🍹 Carry Drink", xPx, yPx + 24);
        } else if (p.holdingMeal) {
          this.ctx.fillStyle = '#ffaa00';
          this.ctx.font = 'bold 8px "Outfit", sans-serif';
          this.ctx.fillText("🍱 Carry Food", xPx, yPx + 24);
        }

        // If interacting, draw active link to table
        if (p.interactingObjectId) {
          const obj = state.grid.objects.find(o => o.id === p.interactingObjectId);
          if (obj) {
            this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
            this.ctx.setLineDash([4, 4]);
            this.ctx.beginPath();
            this.ctx.moveTo(xPx, yPx);
            this.ctx.lineTo(obj.gridX * this.cellSize + (obj.width * this.cellSize)/2, obj.gridY * this.cellSize + (obj.height * this.cellSize)/2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
          }
        }
      });

      // 5. Draw Build Mode Placement Preview Box
      if (buildItem) {
        const template = window.Casino.GameObjects.Catalog[buildItem];
        if (template) {
          const w = template.width;
          const h = template.height;
          
          const xPx = mouseGridX * this.cellSize;
          const yPx = mouseGridY * this.cellSize;

          // Box color based on placement validity
          this.ctx.fillStyle = isPlacementValid ? 'rgba(57, 255, 20, 0.3)' : 'rgba(255, 77, 77, 0.3)';
          this.ctx.fillRect(xPx, yPx, w * this.cellSize, h * this.cellSize);

          this.ctx.strokeStyle = isPlacementValid ? '#39ff14' : '#ff4d4d';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(xPx, yPx, w * this.cellSize, h * this.cellSize);
          this.ctx.lineWidth = 1;

          // Draw object icon in preview
          this.ctx.fillStyle = '#fff';
          this.ctx.font = '24px Arial';
          this.ctx.fillText(template.icon, xPx + (w * this.cellSize)/2, yPx + (h * this.cellSize)/2);

          // Draw seats preview outlines
          const candidates = [];
          // Bottom perimeter cells
          for (let x = 0; x < w; x++) candidates.push({ rx: x, ry: h });
          // Right perimeter cells
          for (let y = 0; y < h; y++) candidates.push({ rx: w, ry: y });
          // Top perimeter cells (except dealer seats)
          for (let x = 0; x < w; x++) {
            if (buildItem === 'roulette' && x === 1) continue;
            if (buildItem === 'craps' && x === 2) continue;
            candidates.push({ rx: x, ry: -1 });
          }
          // Left perimeter cells
          for (let y = 0; y < h; y++) candidates.push({ rx: -1, ry: y });

          const maxSlots = template.guestCapacity;
          for (let i = 0; i < maxSlots; i++) {
            const c = candidates[i % candidates.length];
            const seatX = mouseGridX + c.rx;
            const seatY = mouseGridY + c.ry;
            
            const sxPx = seatX * this.cellSize;
            const syPx = seatY * this.cellSize;

            // Draw a semi-transparent stool circle preview
            this.ctx.beginPath();
            this.ctx.arc(sxPx + this.cellSize / 2, syPx + this.cellSize / 2, 7, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(92, 64, 51, 0.4)';
            this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
            this.ctx.setLineDash([2, 2]);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
          }

          // Draw dealer seat preview
          let dealerOffset = null;
          if (buildItem === 'roulette') {
            dealerOffset = { rx: 1, ry: -1 };
          } else if (buildItem === 'craps') {
            dealerOffset = { rx: 2, ry: -1 };
          }

          if (dealerOffset) {
            const seatX = mouseGridX + dealerOffset.rx;
            const seatY = mouseGridY + dealerOffset.ry;
            const sxPx = seatX * this.cellSize;
            const syPx = seatY * this.cellSize;

            this.ctx.beginPath();
            this.ctx.arc(sxPx + this.cellSize / 2, syPx + this.cellSize / 2, 7, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(28, 36, 52, 0.4)';
            this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
            this.ctx.setLineDash([2, 2]);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
          }
        }
      }
      this.ctx.restore();
    }
  }

  window.Casino.Renderer = Renderer;
})();
