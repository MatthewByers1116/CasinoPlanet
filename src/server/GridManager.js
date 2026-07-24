// Grid Manager: Handles 2D grid layout, collisions, and game object placements on the simulator
(function() {
  class GridManager {
    constructor(cols = 24, rows = 16) {
      this.cols = cols;
      this.rows = rows;
      
      // Initialize 2D grid array: null means empty/walkable, otherwise stores the object ID occupying it
      this.grid = [];
      for (let r = 0; r < this.rows; r++) {
        this.grid.push(new Array(this.cols).fill(null));
      }

      // Map of objectId -> placedObject
      this.placedObjects = new Map();
      this.nextObjectId = 1;

      // Define non-walkable boundaries (like walls, entrance, receptionist desk)
      // For now, let's keep it simple: outer edges are walls except the entrance at the bottom
      this.entranceX = Math.floor(cols / 2);
      this.entranceY = rows - 1;
    }

    isValidCell(x, y) {
      return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
    }

    isCellWalkable(x, y) {
      if (!this.isValidCell(x, y)) return false;
      
      // Left and right walls, top wall are solid.
      if (y === 0 || x === 0 || x === this.cols - 1) return false;
      // Bottom wall is solid EXCEPT for the 2-tile entrance in the middle
      if (y === this.rows - 1 && Math.abs(x - this.entranceX) > 1) return false;

      // Check if occupied by any placed object
      return this.grid[y][x] === null;
    }

    canPlaceObject(type, gridX, gridY) {
      const Catalog = window.Casino.GameObjects.Catalog;
      const template = Catalog[type];
      if (!template) return false;

      const w = template.width;
      const h = template.height;

      // Collect all coordinates occupied by other tables' seats
      const occupiedSeats = new Set();
      for (const obj of this.placedObjects.values()) {
        if (obj.seats) {
          obj.seats.forEach(s => {
            occupiedSeats.add(`${obj.gridX + s.rx},${obj.gridY + s.ry}`);
          });
        }
      }

      // 0. Spacing check: Ensure at least 1-tile gap (including diagonals) from any other object's body
      for (let y = gridY - 1; y <= gridY + h; y++) {
        for (let x = gridX - 1; x <= gridX + w; x++) {
          if (this.isValidCell(x, y)) {
            if (x >= gridX && x < gridX + w && y >= gridY && y < gridY + h) {
              continue;
            }
            if (this.grid[y][x] !== null) return false;
          }
        }
      }

      // 1. Verify new table cells
      for (let y = gridY; y < gridY + h; y++) {
        for (let x = gridX; x < gridX + w; x++) {
          if (!this.isValidCell(x, y)) return false;
          
          // Cannot place on walls/boundaries
          if (y === 0 || y === this.rows - 1 || x === 0 || x === this.cols - 1) return false;

          // Cannot block the entrance pathway
          if (y >= this.rows - 3 && Math.abs(x - this.entranceX) <= 2) return false;

          // Must not be occupied by another table
          if (this.grid[y][x] !== null) return false;

          // Must not occupy another table's seat
          if (occupiedSeats.has(`${x},${y}`)) return false;
        }
      }

      // 2. Generate seats candidates for the new table and verify
      const candidates = [];
      // Bottom perimeter cells
      for (let x = 0; x < w; x++) candidates.push({ rx: x, ry: h });
      // Right perimeter cells
      for (let y = 0; y < h; y++) candidates.push({ rx: w, ry: y });
      // Top perimeter cells
      for (let x = 0; x < w; x++) candidates.push({ rx: x, ry: -1 });
      // Left perimeter cells
      for (let y = 0; y < h; y++) candidates.push({ rx: -1, ry: y });

      const capacity = template.guestCapacity;
      for (let i = 0; i < capacity; i++) {
        const c = candidates[i % candidates.length];
        const sx = gridX + c.rx;
        const sy = gridY + c.ry;

        // Seat must fit inside grid boundaries
        if (!this.isValidCell(sx, sy)) return false;

        // Seat cell must be walkable (not wall, top wall, reception, or occupied by another table)
        if (!this.isCellWalkable(sx, sy)) return false;

        // Seat must not overlap with another table's seat
        if (occupiedSeats.has(`${sx},${sy}`)) return false;

        // Seat must not block entrance pathway
        if (sy >= this.rows - 3 && Math.abs(sx - this.entranceX) <= 2) return false;
      }

      // 3. Verify dealer seat is walkable for table games
      if (['roulette', 'blackjack', 'ride_the_bus', 'three_card_poker'].includes(type)) {
        const dsX = gridX + 1;
        const dsY = gridY - 1;
        if (!this.isCellWalkable(dsX, dsY)) return false;
      } else if (type === 'craps') {
        const dsX = gridX + 2;
        const dsY = gridY - 1;
        if (!this.isCellWalkable(dsX, dsY)) return false;
      }

      return true;
    }

    placeObject(type, gridX, gridY) {
      if (!this.canPlaceObject(type, gridX, gridY)) return null;

      const objectId = `obj_${this.nextObjectId++}`;
      const newObject = window.Casino.GameObjects.createPlaced(objectId, type, gridX, gridY);

      if (!newObject) return null;

      // Register the object
      this.placedObjects.set(objectId, newObject);

      // Mark grid cells
      for (let y = gridY; y < gridY + newObject.height; y++) {
        for (let x = gridX; x < gridX + newObject.width; x++) {
          this.grid[y][x] = objectId;
        }
      }

      return newObject;
    }

    removeObject(objectId) {
      const obj = this.placedObjects.get(objectId);
      if (!obj) return false;

      // Clear grid cells
      for (let y = obj.gridY; y < obj.gridY + obj.height; y++) {
        for (let x = obj.gridX; x < obj.gridX + obj.width; x++) {
          if (this.grid[y][x] === objectId) {
            this.grid[y][x] = null;
          }
        }
      }

      // Evict any guests occupying this object
      obj.guests = [];

      this.placedObjects.delete(objectId);
      return true;
    }

    moveObject(objectId, newGridX, newGridY) {
      const obj = this.placedObjects.get(objectId);
      if (!obj) return false;

      // 1. Temporarily clear grid cells of the object
      for (let y = obj.gridY; y < obj.gridY + obj.height; y++) {
        for (let x = obj.gridX; x < obj.gridX + obj.width; x++) {
          if (this.grid[y][x] === objectId) {
            this.grid[y][x] = null;
          }
        }
      }

      // 2. Check if it can be placed at the new position
      if (!this.canPlaceObject(obj.type, newGridX, newGridY)) {
        // Restore old occupied cells
        for (let y = obj.gridY; y < obj.gridY + obj.height; y++) {
          for (let x = obj.gridX; x < obj.gridX + obj.width; x++) {
            this.grid[y][x] = objectId;
          }
        }
        return false;
      }

      // 3. Update the object's position
      obj.gridX = newGridX;
      obj.gridY = newGridY;

      // Update seats positions
      if (obj.seats) {
        const candidates = [];
        for (let x = 0; x < obj.width; x++) candidates.push({ rx: x, ry: obj.height });
        for (let y = 0; y < obj.height; y++) candidates.push({ rx: obj.width, ry: y });
        for (let x = 0; x < obj.width; x++) candidates.push({ rx: x, ry: -1 });
        for (let y = 0; y < obj.height; y++) candidates.push({ rx: -1, ry: y });
        
        for (let i = 0; i < obj.seats.length; i++) {
          const c = candidates[i % candidates.length];
          obj.seats[i].rx = c.rx;
          obj.seats[i].ry = c.ry;
        }
      }

      // Update dealerSeat if present
      if (obj.dealerSeat) {
        if (['roulette', 'blackjack', 'ride_the_bus', 'three_card_poker'].includes(obj.type)) {
          obj.dealerSeat.rx = 1;
          obj.dealerSeat.ry = -1;
        } else if (obj.type === 'craps') {
          obj.dealerSeat.rx = 2;
          obj.dealerSeat.ry = -1;
        }
      }

      // 4. Mark the new grid cells
      for (let y = newGridY; y < newGridY + obj.height; y++) {
        for (let x = newGridX; x < newGridX + obj.width; x++) {
          this.grid[y][x] = objectId;
        }
      }

      return true;
    }

    getObjectAt(x, y) {
      if (!this.isValidCell(x, y)) return null;
      const objectId = this.grid[y][x];
      if (!objectId) return null;
      return this.placedObjects.get(objectId) || null;
    }

    getClosestObject(gridX, gridY, range = 1.5) {
      // Find objects within a tile distance range
      let closestObj = null;
      let minDistance = Infinity;

      for (const obj of this.placedObjects.values()) {
        // Calculate shortest distance to any bounding cell of the object
        for (let oy = obj.gridY; oy < obj.gridY + obj.height; oy++) {
          for (let ox = obj.gridX; ox < obj.gridX + obj.width; ox++) {
            const dx = gridX - ox;
            const dy = gridY - oy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistance && dist <= range) {
              minDistance = dist;
              closestObj = obj;
            }
          }
        }
      }
      return closestObj;
    }

    serialize() {
      return {
        cols: this.cols,
        rows: this.rows,
        objects: Array.from(this.placedObjects.values())
      };
    }

    deserialize(data) {
      if (!data) return;
      this.cols = data.cols || this.cols;
      this.rows = data.rows || this.rows;

      // Reset grid
      this.grid = [];
      for (let r = 0; r < this.rows; r++) {
        this.grid.push(new Array(this.cols).fill(null));
      }
      this.placedObjects.clear();

      // Place objects
      if (data.objects) {
        data.objects.forEach(obj => {
          this.placedObjects.set(obj.id, obj);
          for (let y = obj.gridY; y < obj.gridY + obj.height; y++) {
            for (let x = obj.gridX; x < obj.gridX + obj.width; x++) {
              if (this.isValidCell(x, y)) {
                this.grid[y][x] = obj.id;
              }
            }
          }
        });
      }
    }
  }

  window.Casino.GridManager = GridManager;
})();
