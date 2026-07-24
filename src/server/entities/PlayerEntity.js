// Player Entity: Server-side representation of a player in the casino
(function() {
  class PlayerEntity {
    constructor(id, startX, startY) {
      this.id = id;
      this.gridX = startX;
      this.gridY = startY;
      this.targetX = startX; // Used for smooth transition interpolation
      this.targetY = startY;
      this.interactingObjectId = null;
      this.buffs = {}; // Active temporary buffs
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
        gridX: this.gridX,
        gridY: this.gridY,
        interactingObjectId: this.interactingObjectId,
        buffs: this.buffs
      };
    }

    deserialize(data) {
      if (!data) return;
      this.id = data.id || this.id;
      this.gridX = data.gridX !== undefined ? data.gridX : this.gridX;
      this.gridY = data.gridY !== undefined ? data.gridY : this.gridY;
      this.interactingObjectId = data.interactingObjectId !== undefined ? data.interactingObjectId : this.interactingObjectId;
      this.buffs = data.buffs || this.buffs || {};
    }
  }

  window.Casino.PlayerEntity = PlayerEntity;
})();
