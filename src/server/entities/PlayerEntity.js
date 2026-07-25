// Player Entity: Server-side representation of a player in the casino
(function() {
  class PlayerEntity {
    constructor(id, startX, startY) {
      this.id = id;
      this.name = `P_${id.substring(0, 4)}`;
      this.gridX = startX;
      this.gridY = startY;
      this.targetX = startX; // Used for smooth transition interpolation
      this.targetY = startY;
      this.interactingObjectId = null;
      this.buffs = {}; // Active temporary buffs
      this.holdingDrink = false;
      this.holdingMeal = false;
    }

    move(gridX, gridY, gridManager) {
      // Validate bounds and collisions
      if (gridManager.isCellWalkable(gridX, gridY)) {
        this.gridX = gridX;
        this.gridY = gridY;
        return true;
      }
      return false;
    }

    startInteraction(objectId) {
      this.interactingObjectId = objectId;
    }

    clearInteraction() {
      this.interactingObjectId = null;
    }

    tickBuffs(dt) {
      if (!this.buffs) this.buffs = {};
      for (const key in this.buffs) {
        this.buffs[key] = Math.max(0, this.buffs[key] - dt);
        if (this.buffs[key] <= 0) {
          delete this.buffs[key];
        }
      }
    }

    serialize() {
      return {
        id: this.id,
        name: this.name,
        gridX: this.gridX,
        gridY: this.gridY,
        interactingObjectId: this.interactingObjectId,
        buffs: this.buffs,
        holdingDrink: this.holdingDrink || false,
        holdingMeal: this.holdingMeal || false
      };
    }

    deserialize(data) {
      if (!data) return;
      this.id = data.id || this.id;
      this.name = data.name || this.name;
      this.gridX = data.gridX !== undefined ? data.gridX : this.gridX;
      this.gridY = data.gridY !== undefined ? data.gridY : this.gridY;
      this.interactingObjectId = data.interactingObjectId !== undefined ? data.interactingObjectId : this.interactingObjectId;
      this.buffs = data.buffs || this.buffs || {};
      this.holdingDrink = data.holdingDrink || false;
      this.holdingMeal = data.holdingMeal || false;
    }
  }

  window.Casino.PlayerEntity = PlayerEntity;
})();
