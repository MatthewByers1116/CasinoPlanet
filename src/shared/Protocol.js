// Protocol Definitions for Client-Server simulation syncing
(function() {
  window.Casino.Protocol = {
    // Commands sent from Client -> Simulator (Server)
    Commands: {
      MOVE_PLAYER: 'MOVE_PLAYER',       // { playerId, x, y }
      PLACE_OBJECT: 'PLACE_OBJECT',     // { type, gridX, gridY }
      INTERACT: 'INTERACT',             // { playerId, objectId }
      LEAVE_INTERACTION: 'LEAVE_INTERACTION', // { playerId }
      PLAY_MINIGAME: 'PLAY_MINIGAME',   // { playerId, gameType, betAmount, betData }
      DEV_GIVE_CHIPS: 'DEV_GIVE_CHIPS',  // { playerId, amount }
      UPGRADE_SIZE: 'UPGRADE_SIZE',       // { playerId }
      UPGRADE_OBJECT: 'UPGRADE_OBJECT',   // { objectId, upgradeType }
      SELL_OBJECT: 'SELL_OBJECT',         // { objectId }
      HIRE_EMPLOYEE: 'HIRE_EMPLOYEE',      // { role }
      UNLOCK_TECH: 'UNLOCK_TECH',          // { techType }
      MOVE_OBJECT: 'MOVE_OBJECT',          // { objectId, gridX, gridY }
      CLEAN_DIRT: 'CLEAN_DIRT',            // { x, y }
      CAPTURE_PICKPOCKET: 'CAPTURE_PICKPOCKET', // { id }
      REPAIR_MACHINE: 'REPAIR_MACHINE',     // { objectId }
      SELECT_DIFFICULTY: 'SELECT_DIFFICULTY', // { difficulty }
      UPGRADE_EMPLOYEE: 'UPGRADE_EMPLOYEE', // { employeeId, upgradeType }
      BUY_BUFF: 'BUY_BUFF',                 // { buffType, cost, duration }
      REFILL_AMENITY: 'REFILL_AMENITY',     // { objectId }
      GRAB_AMENITY_ITEM: 'GRAB_AMENITY_ITEM', // { objectId }
      HAND_NEEDS: 'HAND_NEEDS',              // { guestId, itemType }
      SET_PLAYER_NAME: 'SET_PLAYER_NAME',    // { name }
      SEND_EMPLOYEE_BREAK: 'SEND_EMPLOYEE_BREAK', // { employeeId }
      UNSTUCK_PLAYER: 'UNSTUCK_PLAYER'
    },

    // Events broadcast from Simulator (Server) -> Client
    Events: {
      FULL_STATE: 'FULL_STATE',         // Complete snapshot of grid, entities, and economy
      STATE_UPDATE: 'STATE_UPDATE',     // Delta updates (economy changes, moving guests, etc.)
      PLAYER_MOVED: 'PLAYER_MOVED',     // A specific player moved
      OBJECT_PLACED: 'OBJECT_PLACED',   // Game table was placed
      MINIGAME_PAYOUT: 'MINIGAME_PAYOUT', // Outcome of Roulette / Craps play
      SIZE_UPGRADED: 'SIZE_UPGRADED',   // Server resized grid boundaries
      SOUND_TRIGGER: 'SOUND_TRIGGER',    // Trigger custom game sound effect on client
      GUEST_LEFT_REASON: 'GUEST_LEFT_REASON', // Guest departed with specific complaint
      DAY_REPORT: 'DAY_REPORT'                 // End of day earnings summary
    }
  };

  window.Casino.Config = {
    STARTING_CHIPS: 5000,
    PICKPOCKET_SPAWN_COOLDOWN: 45000, // ms
    PICKPOCKET_SPAWN_CHANCE: 0.15,
    MAX_PICKPOCKETS: 1
  };
})();
