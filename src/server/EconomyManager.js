// Economy Manager: Tracks chip balances and handles transaction validations on the simulator
(function() {
  class EconomyManager {
    constructor(initialChips = 1000) {
      this.chips = initialChips;
    }

    addChips(amount) {
      if (isNaN(amount) || amount <= 0) return this.chips;
      this.chips += Math.floor(amount);
      return this.chips;
    }

    deductChips(amount) {
      if (isNaN(amount) || amount <= 0) return true;
      if (this.chips >= amount) {
        this.chips -= Math.floor(amount);
        return true;
      }
      return false;
    }

    canAfford(amount) {
      if (isNaN(amount)) return false;
      return this.chips >= amount;
    }

    getChips() {
      return this.chips;
    }

    serialize() {
      return {
        chips: this.chips
      };
    }

    deserialize(data) {
      if (data && typeof data.chips === 'number') {
        this.chips = data.chips;
      }
    }
  }

  window.Casino.EconomyManager = EconomyManager;
})();
