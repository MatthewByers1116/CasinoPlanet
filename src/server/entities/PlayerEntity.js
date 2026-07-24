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

    serialize() {
      return {
        id: this.id,
        gridX: this.gridX,
        gridY: this.gridY,
        interactingObjectId: this.interactingObjectId
      };
    }

    deserialize(data) {
      if (!data) return;
      this.id = data.id || this.id;
      this.gridX = data.gridX !== undefined ? data.gridX : this.gridX;
      this.gridY = data.gridY !== undefined ? data.gridY : this.gridY;
      this.interactingObjectId = data.interactingObjectId !== undefined ? data.interactingObjectId : this.interactingObjectId;
    }
  }

  window.Casino.PlayerEntity = PlayerEntity;
})();
