# Casino Planet Automated Test Run Report

Generated on: 2026-07-27T19:04:00.255Z
Codebase Root: `D:\\CasinoPlanetProject`
Testing Environment: Browser (Chrome/Edge/Firefox)

## Test Suites Results Summary

| Test Suite / Case | Status | Notes |
| --- | --- | --- |
| Lobby Settings & Difficulty Selection | âœ… PASS | |
| AI ticks & Pathfinding | âœ… PASS | |
| Spacing & Layout Correctness | âœ… PASS | |
| Minigame Gameplay Loop: slots | âœ… PASS | |
| Minigame Gameplay Loop: blackjack | âœ… PASS | |
| Minigame Gameplay Loop: craps | âœ… PASS | |
| Minigame Gameplay Loop: ride_the_bus | âœ… PASS | |
| Minigame Gameplay Loop: three_card_poker | âœ… PASS | |
| Minigame Gameplay Loop: baccarat | âœ… PASS | |
| Minigame Gameplay Loop: texas_holdem | âœ… PASS | |
| Minigame Gameplay Loop: pai_gow | âœ… PASS | |
| Minigame Gameplay Loop: sic_bo | âœ… PASS | |
| Minigame Gameplay Loop: caribbean_stud | âœ… PASS | |
| Minigame Gameplay Loop: big_six | âœ… PASS | |
| Minigame Gameplay Loop: let_it_ride | âœ… PASS | |
| Minigame Gameplay Loop: red_dog | âœ… PASS | |
| Minigame Gameplay Loop: spanish_21 | âœ… PASS | |
| Minigame Gameplay Loop: casino_war | âœ… PASS | |
| Minigame Gameplay Loop: video_poker | âœ… PASS | |
| Minigame Gameplay Loop: plinko | âœ… PASS | |
| Minigame Gameplay Loop: lottery | âœ… PASS | |
| Minigame Gameplay Loop: elec_roulette | âœ… PASS | |
| Minigame Gameplay Loop: bubble_craps | âœ… PASS | |
| Minigame Gameplay Loop: minigame_machine | âœ… PASS | |
| Player Buff Shop Purchase & Multipliers | âœ… PASS | |
| Employee Upgrades & Leveling Stats | âœ… PASS | |
| Visual Overlap & HUD Responsive Layout | âœ… PASS | |
| Upgrade Dialog Interaction & Soda Machine | âœ… PASS | |
| UI Interactive Elements Clickability Check | âœ… PASS | |
| Multiplayer Lobby Sync & Concurrent Interactions | âœ… PASS | |
| Chaos Monkey Autoplay Fuzzer | âœ… PASS | |

## Detailed Step Logs
* **[LOG]**: [Server:GameSim] Broadcast Event: "STATE_UPDATE" {"economy":{"chips":5000},"guests":{"guest_1":{"id":"guest_1","gridX":12,"gridY":15,"renderX":12,"renderY":15,"state":"SPAWNED","color":"#4dff4d","name":"Jordan #616","budget":174,"needs":{"thirst":100,"hunger":100,"bio":100,"entertainment":100},"targetObjectId":null,"gambleTimer":0}},"employees":{},"dirtyTiles":[],"objects":[{"id":"obj_1","guests":[],"dealerSeat":null,"eps":0,"stock":10,"maxStock":10,"isOutOfStock":false},{"id":"obj_2","guests":[],"dealerSeat":null,"eps":0,"stock":10,"maxStock":10,"isOutOfStock":false},{"id":"obj_3","guests":[],"dealerSeat":null,"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_4","guests":[],"dealerSeat":null,"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false}],"sizeLevel":1,"happiness":0.6,"maxGuests":10,"unlockedTechs":["slots","roulette","craps","blackjack","ride_the_bus","three_card_poker","soda_machine","vending_machine","bathroom_stall","bar"],"researchPoints":0,"starRating":4.2,"currentDay":1,"dayTimer":180}

* **[LOG]**: [Server:GameSim] Broadcast Event: "PLAYER_MOVED" {"id":"player-1","name":"P_play","gridX":12,"gridY":8,"interactingObjectId":null,"buffs":{},"holdingDrink":false,"holdingMeal":false,"color":"#00f0ff","hairColor":"#ffb300","gamblingStats":{"totalWon":0,"totalLost":0,"netProfit":0}}

* **[LOG]**: [Server:GameSim] Selected difficulty: "easy". Starting chips: 1000000, starting RP: 1000000

* **[LOG]**: [Server:GameSim] Broadcast Event: "FULL_STATE" {"grid":{"cols":24,"rows":16,"objects":[{"id":"obj_1","type":"soda_machine","name":"Shoddy Soda Machine","gridX":2,"gridY":2,"width":1,"height":1,"color":"#b22222","accentColor":"#ffaa00","icon":"ðŸ¥¤","guestCapacity":1,"tickIncome":1,"useTime":800,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":10,"stock":10,"isOutOfStock":false,"earnings":[],"eps":0},{"id":"obj_2","type":"vending_machine","name":"Shoddy Vending Machine","gridX":4,"gridY":2,"width":1,"height":1,"color":"#3e2723","accentColor":"#ffd700","icon":"ðŸ«","guestCapacity":1,"tickIncome":2,"useTime":800,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":10,"stock":10,"isOutOfStock":false,"earnings":[],"eps":0},{"id":"obj_3","type":"bathroom_stall","name":"Shoddy Bathroom Stall","gridX":6,"gridY":2,"width":1,"height":1,"color":"#37474f","accentColor":"#00e676","icon":"ðŸš½","guestCapacity":1,"tickIncome":1,"useTime":1500,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":null,"stock":null,"isOutOfStock":false,"earnings":[],"eps":0},{"id":"obj_4","type":"slots","name":"Slot Machine","gridX":12,"gridY":10,"width":1,"height":1,"color":"#222222","accentColor":"#7928ca","icon":"ðŸŽ°","guestCapacity":1,"tickIncome":1,"useTime":1500,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":null,"stock":null,"isOutOfStock":false,"earnings":[],"eps":0}]},"economy":{"chips":1000000},"players":{"player-1":{"id":"player-1","name":"P_play","gridX":12,"gridY":8,"interactingObjectId":null,"buffs":{},"holdingDrink":false,"holdingMeal":false,"color":"#00f0ff","hairColor":"#ffb300","gamblingStats":{"totalWon":0,"totalLost":0,"netProfit":0}}},"guests":{"guest_1":{"id":"guest_1","gridX":12,"gridY":15,"renderX":12,"renderY":15,"state":"SPAWNED","color":"#4dff4d","name":"Jordan #616","budget":174,"needs":{"thirst":100,"hunger":100,"bio":100,"entertainment":100},"targetObjectId":null,"gambleTimer":0}},"employees":{},"dirtyTiles":[],"sizeLevel":1,"happiness":0.6,"maxGuests":10,"unlockedTechs":["slots","roulette","craps","blackjack","ride_the_bus","three_card_poker","soda_machine","vending_machine","bathroom_stall","bar"],"researchPoints":1000000,"starRating":4.2,"currentDay":1,"dayTimer":180,"dayRevenue":0,"dayExpenses":0,"dayStats":{},"crapsState":{},"isGamblerMode":false}

* **[LOG]**: [Server:GameSim] Selected Gambler Mode. Initialized pre-placed staffed casino.

* **[LOG]**: [Server:GameSim] Broadcast Event: "FULL_STATE" {"grid":{"cols":36,"rows":24,"objects":[{"id":"obj_1","type":"slots","name":"Slot Machine","gridX":2,"gridY":2,"width":1,"height":1,"color":"#222222","accentColor":"#7928ca","icon":"ðŸŽ°","guestCapacity":1,"tickIncome":1,"useTime":1500,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_2","type":"roulette","name":"Roulette Table","gridX":5,"gridY":2,"width":3,"height":2,"color":"#0e301d","accentColor":"#ffd700","icon":"ðŸŽ¡","guestCapacity":4,"tickIncome":3,"useTime":3000,"guests":[],"seats":[{"rx":0,"ry":2,"guestId":null},{"rx":1,"ry":2,"guestId":null},{"rx":2,"ry":2,"guestId":null},{"rx":3,"ry":0,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_1"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_3","type":"blackjack","name":"Blackjack Table","gridX":10,"gridY":2,"width":2,"height":2,"color":"#0e6030","accentColor":"#ffd700","icon":"ðŸƒ","guestCapacity":3,"tickIncome":4,"useTime":2500,"guests":[],"seats":[{"rx":0,"ry":2,"guestId":null},{"rx":1,"ry":2,"guestId":null},{"rx":2,"ry":0,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_2"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_4","type":"craps","name":"Craps Table","gridX":14,"gridY":2,"width":4,"height":2,"color":"#0f5132","accentColor":"#ff007f","icon":"ðŸŽ²","guestCapacity":6,"tickIncome":3,"useTime":4000,"guests":[],"seats":[{"rx":0,"ry":2,"guestId":null},{"rx":1,"ry":2,"guestId":null},{"rx":2,"ry":2,"guestId":null},{"rx":3,"ry":2,"guestId":null},{"rx":4,"ry":0,"guestId":null},{"rx":4,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":2,"ry":-1,"employeeId":"employee_dealer_perm_3"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_5","type":"ride_the_bus","name":"Ride The Bus Table","gridX":20,"gridY":2,"width":2,"height":2,"color":"#600e12","accentColor":"#ffaa00","icon":"ðŸšŒ","guestCapacity":3,"tickIncome":2,"useTime":2000,"guests":[],"seats":[{"rx":0,"ry":2,"guestId":null},{"rx":1,"ry":2,"guestId":null},{"rx":2,"ry":0,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_4"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_6","type":"three_card_poker","name":"3 Card Poker Table","gridX":24,"gridY":2,"width":2,"height":2,"color":"#0f2042","accentColor":"#00f0ff","icon":"ðŸ‘‘","guestCapacity":3,"tickIncome":4,"useTime":2500,"guests":[],"seats":[{"rx":0,"ry":2,"guestId":null},{"rx":1,"ry":2,"guestId":null},{"rx":2,"ry":0,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_5"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_7","type":"baccarat","name":"Baccarat Table","gridX":28,"gridY":2,"width":2,"height":2,"color":"#0e4a28","accentColor":"#ffd700","icon":"ðŸƒ","guestCapacity":3,"tickIncome":10,"useTime":2200,"guests":[],"seats":[{"rx":0,"ry":2,"guestId":null},{"rx":1,"ry":2,"guestId":null},{"rx":2,"ry":0,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_6"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_8","type":"texas_holdem","name":"Texas Holdem Bonus","gridX":32,"gridY":2,"width":2,"height":2,"color":"#123f75","accentColor":"#ffaa00","icon":"ðŸƒ","guestCapacity":3,"tickIncome":12,"useTime":3000,"guests":[],"seats":[{"rx":0,"ry":2,"guestId":null},{"rx":1,"ry":2,"guestId":null},{"rx":2,"ry":0,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_7"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_9","type":"pai_gow","name":"Pai Gow Poker Table","gridX":2,"gridY":6,"width":2,"height":2,"color":"#7a1f29","accentColor":"#ffd700","icon":"ðŸƒ","guestCapacity":3,"tickIncome":14,"useTime":3500,"guests":[],"seats":[{"rx":0,"ry":2,"guestId":null},{"rx":1,"ry":2,"guestId":null},{"rx":2,"ry":0,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_8"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_10","type":"sic_bo","name":"Sic Bo Table","gridX":6,"gridY":6,"width":3,"height":2,"color":"#1a1f38","accentColor":"#39ff14","icon":"ðŸŽ²","guestCapacity":4,"tickIncome":15,"useTime":3000,"guests":[],"seats":[{"rx":0,"ry":2,"guestId":null},{"rx":1,"ry":2,"guestId":null},{"rx":2,"ry":2,"guestId":null},{"rx":3,"ry":0,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_9"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_11","type":"caribbean_stud","name":"Caribbean Stud Table","gridX":11,"gridY":6,"width":2,"height":2,"color":"#0e5560","accentColor":"#ffd700","icon":"ðŸƒ","guestCapacity":3,"tickIncome":18,"useTime":2800,"guests":[],"seats":[{"rx":0,"ry":2,"guestId":null},{"rx":1,"ry":2,"guestId":null},{"rx":2,"ry":0,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_10"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_12","type":"big_six","name":"Big Six Wheel Table","gridX":15,"gridY":6,"width":2,"height":1,"color":"#4a0e60","accentColor":"#e64dff","icon":"ðŸŽ¡","guestCapacity":2,"tickIncome":20,"useTime":2400,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null},{"rx":1,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":0,"ry":-1,"employeeId":"employee_dealer_perm_11"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_13","type":"let_it_ride","name":"Let It Ride Table","gridX":19,"gridY":6,"width":2,"height":2,"color":"#0a3028","accentColor":"#00f0ff","icon":"ðŸƒ","guestCapacity":3,"tickIncome":22,"useTime":2600,"guests":[],"seats":[{"rx":0,"ry":2,"guestId":null},{"rx":1,"ry":2,"guestId":null},{"rx":2,"ry":0,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_12"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_14","type":"red_dog","name":"Red Dog Table","gridX":23,"gridY":6,"width":2,"height":2,"color":"#600a0e","accentColor":"#ffaa00","icon":"ðŸƒ","guestCapacity":3,"tickIncome":25,"useTime":2200,"guests":[],"seats":[{"rx":0,"ry":2,"guestId":null},{"rx":1,"ry":2,"guestId":null},{"rx":2,"ry":0,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_13"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_15","type":"spanish_21","name":"Spanish 21 Table","gridX":27,"gridY":6,"width":2,"height":2,"color":"#0e4a30","accentColor":"#ffd700","icon":"ðŸƒ","guestCapacity":3,"tickIncome":28,"useTime":2500,"guests":[],"seats":[{"rx":0,"ry":2,"guestId":null},{"rx":1,"ry":2,"guestId":null},{"rx":2,"ry":0,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_14"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_16","type":"casino_war","name":"Casino War Table","gridX":31,"gridY":6,"width":2,"height":2,"color":"#400e12","accentColor":"#ff007f","icon":"ðŸƒ","guestCapacity":3,"tickIncome":32,"useTime":1800,"guests":[],"seats":[{"rx":0,"ry":2,"guestId":null},{"rx":1,"ry":2,"guestId":null},{"rx":2,"ry":0,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_15"},"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_17","type":"video_poker","name":"Video Poker Console","gridX":2,"gridY":10,"width":1,"height":1,"color":"#111122","accentColor":"#e64dff","icon":"ðŸ•¹ï¸","guestCapacity":1,"tickIncome":8,"useTime":1800,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_18","type":"plinko","name":"Plinko Peggy Machine","gridX":5,"gridY":10,"width":1,"height":1,"color":"#1c1c1e","accentColor":"#ffaa00","icon":"ðŸ•¹ï¸","guestCapacity":1,"tickIncome":12,"useTime":2500,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_19","type":"lottery","name":"Kiosk Lottery Console","gridX":8,"gridY":10,"width":1,"height":1,"color":"#1c1c1e","accentColor":"#00f0ff","icon":"ðŸ•¹ï¸","guestCapacity":1,"tickIncome":15,"useTime":2000,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_20","type":"elec_roulette","name":"Electronic Roulette Kiosk","gridX":11,"gridY":10,"width":1,"height":1,"color":"#1a1a2e","accentColor":"#ff007f","icon":"ðŸŽ¡","guestCapacity":1,"tickIncome":6,"useTime":1500,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_21","type":"elec_blackjack","name":"Electronic Blackjack Kiosk","gridX":16,"gridY":10,"width":1,"height":1,"color":"#1a1a2e","accentColor":"#00f0ff","icon":"ðŸƒ","guestCapacity":1,"tickIncome":7,"useTime":1800,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_22","type":"bubble_craps","name":"Bubble Craps Station","gridX":20,"gridY":10,"width":1,"height":1,"color":"#1a1a2e","accentColor":"#39ff14","icon":"ðŸŽ²","guestCapacity":1,"tickIncome":8,"useTime":1800,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_23","type":"elec_sic_bo","name":"Electronic Sic Bo Console","gridX":25,"gridY":10,"width":1,"height":1,"color":"#1a1a2e","accentColor":"#39ff14","icon":"ðŸ•¹ï¸","guestCapacity":1,"tickIncome":9,"useTime":1800,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_24","type":"elec_baccarat","name":"Electronic Baccarat Terminal","gridX":30,"gridY":10,"width":1,"height":1,"color":"#1a1a2e","accentColor":"#ffd700","icon":"ðŸ•¹ï¸","guestCapacity":1,"tickIncome":10,"useTime":2000,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_25","type":"soda_machine","name":"Shoddy Soda Machine","gridX":2,"gridY":14,"width":1,"height":1,"color":"#b22222","accentColor":"#ffaa00","icon":"ðŸ¥¤","guestCapacity":1,"tickIncome":1,"useTime":800,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":10,"stock":10,"isOutOfStock":false},{"id":"obj_26","type":"vending_machine","name":"Shoddy Vending Machine","gridX":5,"gridY":14,"width":1,"height":1,"color":"#3e2723","accentColor":"#ffd700","icon":"ðŸ«","guestCapacity":1,"tickIncome":2,"useTime":800,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":10,"stock":10,"isOutOfStock":false},{"id":"obj_27","type":"candy_dispenser","name":"Candy Dispenser","gridX":8,"gridY":14,"width":1,"height":1,"color":"#4e102e","accentColor":"#ffaa00","icon":"ðŸ¬","guestCapacity":1,"tickIncome":5,"useTime":800,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":10,"stock":10,"isOutOfStock":false},{"id":"obj_28","type":"coffee_maker","name":"Coffee Maker Bar","gridX":11,"gridY":14,"width":1,"height":1,"color":"#2e1c10","accentColor":"#ffd700","icon":"â˜•","guestCapacity":1,"tickIncome":12,"useTime":1000,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":10,"stock":10,"isOutOfStock":false},{"id":"obj_29","type":"bathroom_stall","name":"Shoddy Bathroom Stall","gridX":14,"gridY":14,"width":1,"height":1,"color":"#37474f","accentColor":"#00e676","icon":"ðŸš½","guestCapacity":1,"tickIncome":1,"useTime":1500,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_30","type":"massage_chair","name":"Massage Chair","gridX":21,"gridY":14,"width":1,"height":1,"color":"#2b2c2e","accentColor":"#39ff14","icon":"ðŸ’º","guestCapacity":1,"tickIncome":8,"useTime":2500,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":null,"stock":null,"isOutOfStock":false},{"id":"obj_31","type":"atm","name":"ATM Cash Machine","gridX":24,"gridY":14,"width":1,"height":1,"color":"#0e2b60","accentColor":"#39ff14","icon":"ðŸ§","guestCapacity":1,"tickIncome":0,"useTime":2000,"guests":[],"seats":[{"rx":0,"ry":1,"guestId":null}],"upgradesCount":{"capacity":0,"income":0},"dealerSeat":null,"maxStock":null,"stock":null,"isOutOfStock":false}]},"economy":{"chips":1000000},"players":{"player-1":{"id":"player-1","name":"P_play","gridX":18,"gridY":23,"interactingObjectId":null,"buffs":{},"holdingDrink":false,"holdingMeal":false,"color":"#00f0ff","hairColor":"#ffb300","gamblingStats":{"totalWon":0,"totalLost":0,"netProfit":0}}},"guests":{"guest_1":{"id":"guest_1","gridX":12,"gridY":15,"renderX":12,"renderY":15,"state":"SPAWNED","color":"#4dff4d","name":"Jordan #616","budget":174,"needs":{"thirst":100,"hunger":100,"bio":100,"entertainment":100},"targetObjectId":null,"gambleTimer":0}},"employees":{"employee_dealer_perm_1":{"id":"employee_dealer_perm_1","role":"dealer","gridX":6,"gridY":1,"renderX":6,"renderY":1,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_2","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_2":{"id":"employee_dealer_perm_2","role":"dealer","gridX":11,"gridY":1,"renderX":11,"renderY":1,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_3","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_3":{"id":"employee_dealer_perm_3","role":"dealer","gridX":16,"gridY":1,"renderX":16,"renderY":1,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_4","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_4":{"id":"employee_dealer_perm_4","role":"dealer","gridX":21,"gridY":1,"renderX":21,"renderY":1,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_5","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_5":{"id":"employee_dealer_perm_5","role":"dealer","gridX":25,"gridY":1,"renderX":25,"renderY":1,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_6","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_6":{"id":"employee_dealer_perm_6","role":"dealer","gridX":29,"gridY":1,"renderX":29,"renderY":1,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_7","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_7":{"id":"employee_dealer_perm_7","role":"dealer","gridX":33,"gridY":1,"renderX":33,"renderY":1,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_8","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_8":{"id":"employee_dealer_perm_8","role":"dealer","gridX":3,"gridY":5,"renderX":3,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_9","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_9":{"id":"employee_dealer_perm_9","role":"dealer","gridX":7,"gridY":5,"renderX":7,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_10","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_10":{"id":"employee_dealer_perm_10","role":"dealer","gridX":12,"gridY":5,"renderX":12,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_11","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_11":{"id":"employee_dealer_perm_11","role":"dealer","gridX":15,"gridY":5,"renderX":15,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_12","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_12":{"id":"employee_dealer_perm_12","role":"dealer","gridX":20,"gridY":5,"renderX":20,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_13","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_13":{"id":"employee_dealer_perm_13","role":"dealer","gridX":24,"gridY":5,"renderX":24,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_14","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_14":{"id":"employee_dealer_perm_14","role":"dealer","gridX":28,"gridY":5,"renderX":28,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_15","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_15":{"id":"employee_dealer_perm_15","role":"dealer","gridX":32,"gridY":5,"renderX":32,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_16","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_waitress_perm_16":{"id":"employee_waitress_perm_16","role":"waitress","gridX":18,"gridY":23,"renderX":18,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_chef_perm_17":{"id":"employee_chef_perm_17","role":"chef","gridX":18,"gridY":23,"renderX":18,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_tech_perm_18":{"id":"employee_tech_perm_18","role":"tech_support","gridX":18,"gridY":23,"renderX":18,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_sec_perm_19":{"id":"employee_sec_perm_19","role":"security","gridX":18,"gridY":23,"renderX":18,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_waitress_perm_20":{"id":"employee_waitress_perm_20","role":"waitress","gridX":18,"gridY":23,"renderX":18,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_chef_perm_21":{"id":"employee_chef_perm_21","role":"chef","gridX":18,"gridY":23,"renderX":18,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_tech_perm_22":{"id":"employee_tech_perm_22","role":"tech_support","gridX":18,"gridY":23,"renderX":18,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_sec_perm_23":{"id":"employee_sec_perm_23","role":"security","gridX":18,"gridY":23,"renderX":18,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_waitress_perm_24":{"id":"employee_waitress_perm_24","role":"waitress","gridX":18,"gridY":23,"renderX":18,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_chef_perm_25":{"id":"employee_chef_perm_25","role":"chef","gridX":18,"gridY":23,"renderX":18,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_tech_perm_26":{"id":"employee_tech_perm_26","role":"tech_support","gridX":18,"gridY":23,"renderX":18,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_sec_perm_27":{"id":"employee_sec_perm_27","role":"security","gridX":18,"gridY":23,"renderX":18,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false}},"dirtyTiles":[],"sizeLevel":3,"happiness":0.6,"maxGuests":0,"unlockedTechs":["slots","roulette","craps","blackjack","ride_the_bus","three_card_poker","soda_machine","vending_machine","bathroom_stall","bar"],"researchPoints":1000000,"starRating":4.2,"currentDay":1,"dayTimer":180,"dayRevenue":0,"dayExpenses":0,"dayStats":{},"crapsState":{},"isGamblerMode":true}

* **Objects on Grid**: slots id=obj_1 at (2,2), roulette id=obj_2 at (5,2), blackjack id=obj_3 at (10,2), craps id=obj_4 at (14,2), ride_the_bus id=obj_5 at (20,2), three_card_poker id=obj_6 at (24,2), baccarat id=obj_7 at (28,2), texas_holdem id=obj_8 at (32,2), pai_gow id=obj_9 at (2,6), sic_bo id=obj_10 at (6,6), caribbean_stud id=obj_11 at (11,6), big_six id=obj_12 at (15,6), let_it_ride id=obj_13 at (19,6), red_dog id=obj_14 at (23,6), spanish_21 id=obj_15 at (27,6), casino_war id=obj_16 at (31,6), video_poker id=obj_17 at (2,10), plinko id=obj_18 at (5,10), lottery id=obj_19 at (8,10), elec_roulette id=obj_20 at (11,10), elec_blackjack id=obj_21 at (16,10), bubble_craps id=obj_22 at (20,10), elec_sic_bo id=obj_23 at (25,10), elec_baccarat id=obj_24 at (30,10), soda_machine id=obj_25 at (2,14), vending_machine id=obj_26 at (5,14), candy_dispenser id=obj_27 at (8,14), coffee_maker id=obj_28 at (11,14), bathroom_stall id=obj_29 at (14,14), massage_chair id=obj_30 at (21,14), atm id=obj_31 at (24,14)

### Test Case: Lobby & Difficulties

* Selected difficulty: `'easy'` - verified `1,000,000` starting chips and RP.

* Selected difficulty: `'gambler'` - verified grid size `3`, guest cap `0`, and active pre-placed staffed structures.

* **[LOG]**: [Server:GameSim] Broadcast Event: "STATE_UPDATE" {"economy":{"chips":1000000},"guests":{},"employees":{"employee_dealer_perm_1":{"id":"employee_dealer_perm_1","role":"dealer","gridX":6,"gridY":1,"renderX":6,"renderY":1,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_2","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_2":{"id":"employee_dealer_perm_2","role":"dealer","gridX":11,"gridY":1,"renderX":11,"renderY":1,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_3","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_3":{"id":"employee_dealer_perm_3","role":"dealer","gridX":16,"gridY":1,"renderX":16,"renderY":1,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_4","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_4":{"id":"employee_dealer_perm_4","role":"dealer","gridX":21,"gridY":1,"renderX":21,"renderY":1,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_5","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_5":{"id":"employee_dealer_perm_5","role":"dealer","gridX":25,"gridY":1,"renderX":25,"renderY":1,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_6","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_6":{"id":"employee_dealer_perm_6","role":"dealer","gridX":29,"gridY":1,"renderX":29,"renderY":1,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_7","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_7":{"id":"employee_dealer_perm_7","role":"dealer","gridX":33,"gridY":1,"renderX":33,"renderY":1,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_8","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_8":{"id":"employee_dealer_perm_8","role":"dealer","gridX":3,"gridY":5,"renderX":3,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_9","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_9":{"id":"employee_dealer_perm_9","role":"dealer","gridX":7,"gridY":5,"renderX":7,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_10","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_10":{"id":"employee_dealer_perm_10","role":"dealer","gridX":12,"gridY":5,"renderX":12,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_11","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_11":{"id":"employee_dealer_perm_11","role":"dealer","gridX":15,"gridY":5,"renderX":15,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_12","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_12":{"id":"employee_dealer_perm_12","role":"dealer","gridX":20,"gridY":5,"renderX":20,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_13","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_13":{"id":"employee_dealer_perm_13","role":"dealer","gridX":24,"gridY":5,"renderX":24,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_14","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_14":{"id":"employee_dealer_perm_14","role":"dealer","gridX":28,"gridY":5,"renderX":28,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_15","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_dealer_perm_15":{"id":"employee_dealer_perm_15","role":"dealer","gridX":32,"gridY":5,"renderX":32,"renderY":5,"state":"WORKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_16","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_waitress_perm_16":{"id":"employee_waitress_perm_16","role":"waitress","gridX":18,"gridY":23,"renderX":18,"renderY":23,"state":"WALKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_28","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_chef_perm_17":{"id":"employee_chef_perm_17","role":"chef","gridX":19,"gridY":23,"renderX":18.2,"renderY":23,"state":"WALKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_27","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_tech_perm_18":{"id":"employee_tech_perm_18","role":"tech_support","gridX":19,"gridY":23,"renderX":18.2,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_sec_perm_19":{"id":"employee_sec_perm_19","role":"security","gridX":17,"gridY":23,"renderX":17.8,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_waitress_perm_20":{"id":"employee_waitress_perm_20","role":"waitress","gridX":18,"gridY":22,"renderX":18,"renderY":22.8,"state":"WALKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_28","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_chef_perm_21":{"id":"employee_chef_perm_21","role":"chef","gridX":17,"gridY":23,"renderX":17.8,"renderY":23,"state":"WALKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_27","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_tech_perm_22":{"id":"employee_tech_perm_22","role":"tech_support","gridX":19,"gridY":23,"renderX":18.2,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_sec_perm_23":{"id":"employee_sec_perm_23","role":"security","gridX":19,"gridY":23,"renderX":18.2,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_waitress_perm_24":{"id":"employee_waitress_perm_24","role":"waitress","gridX":19,"gridY":23,"renderX":18.2,"renderY":23,"state":"WALKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_28","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_chef_perm_25":{"id":"employee_chef_perm_25","role":"chef","gridX":18,"gridY":22,"renderX":18,"renderY":22.8,"state":"WALKING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":"obj_27","speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_tech_perm_26":{"id":"employee_tech_perm_26","role":"tech_support","gridX":19,"gridY":23,"renderX":18.2,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false},"employee_sec_perm_27":{"id":"employee_sec_perm_27","role":"security","gridX":19,"gridY":23,"renderX":18.2,"renderY":23,"state":"WANDERING","drinks":0,"meals":0,"needs":{"thirst":100,"hunger":100,"bio":100},"targetObjectId":null,"speedLvl":1,"capacityLvl":1,"needsLvl":1,"isOnBreak":false}},"dirtyTiles":[],"objects":[{"id":"obj_1","guests":[],"dealerSeat":null,"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_2","guests":[],"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_1"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_3","guests":[],"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_2"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_4","guests":[],"dealerSeat":{"rx":2,"ry":-1,"employeeId":"employee_dealer_perm_3"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_5","guests":[],"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_4"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_6","guests":[],"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_5"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_7","guests":[],"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_6"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_8","guests":[],"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_7"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_9","guests":[],"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_8"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_10","guests":[],"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_9"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_11","guests":[],"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_10"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_12","guests":[],"dealerSeat":{"rx":0,"ry":-1,"employeeId":"employee_dealer_perm_11"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_13","guests":[],"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_12"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_14","guests":[],"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_13"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_15","guests":[],"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_14"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_16","guests":[],"dealerSeat":{"rx":1,"ry":-1,"employeeId":"employee_dealer_perm_15"},"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_17","guests":[],"dealerSeat":null,"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_18","guests":[],"dealerSeat":null,"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_19","guests":[],"dealerSeat":null,"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_20","guests":[],"dealerSeat":null,"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_21","guests":[],"dealerSeat":null,"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_22","guests":[],"dealerSeat":null,"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_23","guests":[],"dealerSeat":null,"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_24","guests":[],"dealerSeat":null,"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_25","guests":[],"dealerSeat":null,"eps":0,"stock":10,"maxStock":10,"isOutOfStock":false},{"id":"obj_26","guests":[],"dealerSeat":null,"eps":0,"stock":10,"maxStock":10,"isOutOfStock":false},{"id":"obj_27","guests":[],"dealerSeat":null,"eps":0,"stock":10,"maxStock":10,"isOutOfStock":false},{"id":"obj_28","guests":[],"dealerSeat":null,"eps":0,"stock":10,"maxStock":10,"isOutOfStock":false},{"id":"obj_29","guests":[],"dealerSeat":null,"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_30","guests":[],"dealerSeat":null,"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false},{"id":"obj_31","guests":[],"dealerSeat":null,"eps":0,"stock":null,"maxStock":null,"isOutOfStock":false}],"sizeLevel":3,"happiness":1,"maxGuests":0,"unlockedTechs":["slots","roulette","craps","blackjack","ride_the_bus","three_card_poker","soda_machine","vending_machine","bathroom_stall","bar"],"researchPoints":1000000,"starRating":4.2,"currentDay":1,"dayTimer":170}

### Test Case: AI ticks & Pathfinding

* Ran simulator tick of `10,000` ms.

* Verified employee needs reset/bypass in gambler mode (thirst/hunger/bio locked to 100).

### Test Case: Spacing & Layout Correctness

* Verified that all pre-placed objects maintain at least a 1-tile gap horizontally, vertically, and diagonally.

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"slots","tableId":"obj_1","betAmount":10}

* **[LOG]**: [Server:GameSim] Player won 10 Chips gambling! Awarded 2 Research Points. Total RP: 1000002

### Minigame Action: slots

* Interacted with Table ID: `obj_1`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 5010

* Verified `tableId` in Payload: `obj_1`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"blackjack","tableId":"obj_3","action":"deal","betAmount":50}

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"blackjack","tableId":"obj_3","action":"stand"}

### Minigame Action: blackjack

* Interacted with Table ID: `obj_3`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 4950

* Verified `tableId` in Payload: `obj_3`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"craps","tableId":"obj_4","action":"roll","bets":[{"type":"pass_line","amount":20}]}

### Minigame Action: craps

* Interacted with Table ID: `obj_4`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 4960

* Verified `tableId` in Payload: `obj_4`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"ride_the_bus","tableId":"obj_5","action":"deal","betAmount":20}

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"ride_the_bus","tableId":"obj_5","action":"guess","guess":"red"}

### Minigame Action: ride_the_bus

* Interacted with Table ID: `obj_5`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 4980

* Verified `tableId` in Payload: `obj_5`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"three_card_poker","tableId":"obj_6","action":"deal","betAmount":20}

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"three_card_poker","tableId":"obj_6","action":"play"}

* **[LOG]**: [Server:GameSim] Player won 40 Chips gambling! Awarded 10 Research Points. Total RP: 1000012

### Minigame Action: three_card_poker

* Interacted with Table ID: `obj_6`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 5040

* Verified `tableId` in Payload: `obj_6`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"baccarat","tableId":"obj_7","action":"deal","bets":[{"type":"player","amount":20}]}

* **[LOG]**: [Server:GameSim] Player won 20 Chips gambling! Awarded 5 Research Points. Total RP: 1000017

### Minigame Action: baccarat

* Interacted with Table ID: `obj_7`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 5020

* Verified `tableId` in Payload: `obj_7`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"texas_holdem","tableId":"obj_8","action":"deal","betAmount":20}

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"texas_holdem","tableId":"obj_8","action":"play"}

### Minigame Action: texas_holdem

* Interacted with Table ID: `obj_8`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 4980

* Verified `tableId` in Payload: `obj_8`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"pai_gow","tableId":"obj_9","action":"deal","betAmount":20}

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"pai_gow","tableId":"obj_9","action":"play"}

### Minigame Action: pai_gow

* Interacted with Table ID: `obj_9`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 4980

* Verified `tableId` in Payload: `obj_9`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"sic_bo","tableId":"obj_10","action":"roll","bets":[{"type":"small","amount":20}]}

* **[LOG]**: [Server:GameSim] Player won 20 Chips gambling! Awarded 5 Research Points. Total RP: 1000022

### Minigame Action: sic_bo

* Interacted with Table ID: `obj_10`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 5020

* Verified `tableId` in Payload: `obj_10`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"caribbean_stud","tableId":"obj_11","action":"deal","betAmount":20}

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"caribbean_stud","tableId":"obj_11","action":"play"}

* **[LOG]**: [Server:GameSim] Player won 20 Chips gambling! Awarded 5 Research Points. Total RP: 1000027

### Minigame Action: caribbean_stud

* Interacted with Table ID: `obj_11`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 5020

* Verified `tableId` in Payload: `obj_11`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"big_six","tableId":"obj_12","action":"spin","bets":[{"type":"1","amount":20}]}

### Minigame Action: big_six

* Interacted with Table ID: `obj_12`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 4980

* Verified `tableId` in Payload: `obj_12`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"let_it_ride","tableId":"obj_13","action":"deal","betAmount":20}

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"let_it_ride","tableId":"obj_13","action":"ride"}

### Minigame Action: let_it_ride

* Interacted with Table ID: `obj_13`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 4940

* Verified `tableId` in Payload: `obj_13`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"red_dog","tableId":"obj_14","action":"deal","betAmount":20}

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"red_dog","tableId":"obj_14","action":"ride"}

### Minigame Action: red_dog

* Interacted with Table ID: `obj_14`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 4980

* Verified `tableId` in Payload: `obj_14`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"spanish_21","tableId":"obj_15","action":"deal","betAmount":20}

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"spanish_21","tableId":"obj_15","action":"stand"}

### Minigame Action: spanish_21

* Interacted with Table ID: `obj_15`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 4980

* Verified `tableId` in Payload: `obj_15`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"casino_war","tableId":"obj_16","action":"deal","betAmount":20}

* **[LOG]**: [Server:GameSim] Player won 20 Chips gambling! Awarded 5 Research Points. Total RP: 1000032

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"casino_war","tableId":"obj_16","action":"war"}

### Minigame Action: casino_war

* Interacted with Table ID: `obj_16`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 5020

* Verified `tableId` in Payload: `obj_16`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"video_poker","tableId":"obj_17","action":"deal","betAmount":20}

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"video_poker","tableId":"obj_17","action":"draw","holdIndices":[0,2]}

### Minigame Action: video_poker

* Interacted with Table ID: `obj_17`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 4980

* Verified `tableId` in Payload: `obj_17`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"plinko","tableId":"obj_18","betAmount":20}

### Minigame Action: plinko

* Interacted with Table ID: `obj_18`

* Starting Chips: 5000

* Payout Multiplier/Result: 0.2

* Final Chips Balance: 4984

* Verified `tableId` in Payload: `obj_18`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"lottery","tableId":"obj_19","betAmount":20,"selectedNumbers":[1,2,3,4,5]}

### Minigame Action: lottery

* Interacted with Table ID: `obj_19`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 4980

* Verified `tableId` in Payload: `obj_19`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"elec_roulette","tableId":"obj_20","bets":[{"type":"red","amount":20}]}

* **[LOG]**: [Server:GameSim] Player won 20 Chips gambling! Awarded 5 Research Points. Total RP: 1000037

### Minigame Action: elec_roulette

* Interacted with Table ID: `obj_20`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 5020

* Verified `tableId` in Payload: `obj_20`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"bubble_craps","tableId":"obj_22","action":"roll","bets":[{"type":"pass_line","amount":20}]}

### Minigame Action: bubble_craps

* Interacted with Table ID: `obj_22`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 4960

* Verified `tableId` in Payload: `obj_22`

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"minigame_machine","tableId":"obj_32","action":"bet","betAmount":50}

* **[LOG]**: [Server:GameSim] Command Received: "PLAY_MINIGAME" from Player: "player-1" {"gameType":"minigame_machine","tableId":"obj_32","action":"outcome","outcome":"win","betAmount":50}

* **[LOG]**: [Server:GameSim] Player won 50 Chips gambling! Awarded 12 Research Points. Total RP: 1000049

### Minigame Action: minigame_machine

* Interacted with Table ID: `obj_32`

* Starting Chips: 5000

* Payout Multiplier/Result: N/A

* Final Chips Balance: 5050

* Verified `tableId` in Payload: `obj_32`

* **[LOG]**: [Server:GameSim] Command Received: "BUY_BUFF" from Player: "player-1" {"buffType":"speed","cost":50,"duration":60000}

* **[LOG]**: [Server:GameSim] Player purchased buff "speed" for 50 Chips. New duration: 60000ms

* **[LOG]**: [Server:GameSim] Command Received: "BUY_BUFF" from Player: "player-1" {"buffType":"rp","cost":100,"duration":60000}

* **[LOG]**: [Server:GameSim] Player purchased buff "rp" for 100 Chips. New duration: 60000ms

* **[LOG]**: [Server:GameSim] Player won 100 Chips gambling! Awarded 50 Research Points. Total RP: 1000099

### Test Case: Player Buff Shop

* Verified that purchasing a buff deducts the correct amount of chips.

* Verified that the buff duration is correctly added to the player entity.

* Verified that Double RP buff successfully doubles Research Point awards on game wins.

* **[LOG]**: [Server:GameSim] Command Received: "UPGRADE_EMPLOYEE" from Player: "player-1" {"employeeId":"employee_test_waitress","upgradeType":"speed"}

* **[LOG]**: [Server:GameSim] Upgraded Employee "employee_test_waitress" speed to Level 2 for 200 Chips.

* **[LOG]**: [Server:GameSim] Command Received: "UPGRADE_EMPLOYEE" from Player: "player-1" {"employeeId":"employee_test_waitress","upgradeType":"needs"}

* **[LOG]**: [Server:GameSim] Upgraded Employee "employee_test_waitress" needs to Level 2 for 150 Chips.

* **[LOG]**: [Server:GameSim] Command Received: "UPGRADE_EMPLOYEE" from Player: "player-1" {"employeeId":"employee_test_waitress","upgradeType":"capacity"}

* **[LOG]**: [Server:GameSim] Upgraded Employee "employee_test_waitress" capacity to Level 2 for 300 Chips.

### Test Case: Employee Upgrades & Leveling

* Verified that upgrading employee speed, capacity, and needs deducts correct chips.

* Verified employee attributes levels increment successfully.

* Verified employee movement speed multiplier boosts correctly.

* **[DEBUG]**: 1920px mode: Game container height=1080, Alerts top=1006, HUD bottom=100

* **[DEBUG]**: 1000px mode: Game container height=800, Alerts top=726, HUD bottom=214

### Test Case: Visual Overlap & HUD Responsive Layout

* Verified that Casino Alerts panel is placed in bottom-left and does not overlap the top HUD menu at wide resolutions (1920px).

* Verified that Casino Alerts panel does not overlap the HUD at narrow resolutions (1000px).

* Verified that the HUD container handles responsive layout wrapping correctly.

### Test Case: Upgrade Dialog Interaction & Soda Machine

* Verified that the table upgrade dialog successfully displays when clicking an object.

* Verified that the close button successfully hides the upgrade dialog.

* Verified that upgrading the seat capacity succeeds and updates the game state.

### Test Case: UI Interactive Elements Clickability Check

* Verified that all Mode Selection buttons have valid computed pointer-events (auto) and are clickable.

* Verified that all Difficulty Selection buttons are clickable.

* Verified that all HUD Control & Panel tools are clickable.

* Verified that all Table Upgrade dialog controls are clickable and interactable.

* Verified that all Character Details employee upgrading buttons are clickable.

* Verified that all Minigame modal window header controls are clickable.

* **[LOG]**: [MockPeer] Created MockPeer: casino-9171

* **[LOG]**: [MockPeer] Register listener on peer casino-9171: open

* **[LOG]**: [MockPeer] Register listener on peer casino-9171: connection

* **[LOG]**: [MockPeer] Register listener on peer casino-9171: error

* **[LOG]**: [MockPeer] Firing open event for peer: casino-9171

* Host peer ID opened: casino-9171

* **[LOG]**: [MockPeer] Created MockPeer: guest_vo5muham8

* **[LOG]**: [MockPeer] Register listener on peer guest_vo5muham8: open

* **[LOG]**: [MockPeer] Register listener on peer guest_vo5muham8: error

* **[LOG]**: [MockPeer] Firing open event for peer: guest_vo5muham8

* **[LOG]**: [MockPeer] Peer guest_vo5muham8 connecting to target casino-9171

* **[LOG]**: [MockConnection] Register listener on connection (peer: casino-9171, remote: casino-9171): open

* **[LOG]**: [MockConnection] Register listener on connection (peer: casino-9171, remote: casino-9171): data

* **[LOG]**: [MockConnection] Register listener on connection (peer: casino-9171, remote: casino-9171): close

* **[LOG]**: [MockPeer] Triggering connection event on target peer: casino-9171 with guest connection: guest_vo5muham8

* **[LOG]**: [MockConnection] Register listener on connection (peer: guest_vo5muham8, remote: guest_vo5muham8): open

* **[LOG]**: [MockConnection] Register listener on connection (peer: guest_vo5muham8, remote: guest_vo5muham8): data

* **[LOG]**: [MockConnection] Register listener on connection (peer: guest_vo5muham8, remote: guest_vo5muham8): close

* **[LOG]**: [MockPeer] Triggering open event on guest connection: guest_vo5muham8

* **[LOG]**: [MockPeer] Triggering open event on host connection for guest: guest_vo5muham8

* Guest successfully connected to host lobby via WebRTC simulation.

* Guest Peer ID: guest_vo5muham8, Host Simulator Players: ["player_local","guest_vo5muham8"]

* Verified that host simulator registered guest player ID.

* Verified concurrent movements synced correctly on the host.

* Verified concurrent movements synced correctly on the guest.

* Verified placement collision: first placement succeeded, concurrent colliding placement rejected.

* Verified concurrent upgrades resolved correctly in sync on Host & Guest.

* Verified that visual rendering of dealer hats and pickpocket stripes executes without error.

* Verified that player gambling losses are tracked and compiled in the Day Report payload.

* Verified that active card sessions and Craps bets are successfully refunded to player balances at the end of the day.

* Verified that player win/loss stats are tracked correctly in PlayerEntity.gamblingStats.

* Verified that multiplayer co-play sidebar updates players lists on Blackjack tables.

* Verified that multiplayer co-play sidebar updates players lists on Ride The Bus tables.

* Verified that waitress pathfinding successfully routes to walkable adjacent cells next to solid objects instead of failing.

* Verified that new QTE puzzle mode processes interactive clicks correctly and resolves upon completion.

* Verified that new DBD Skill Check Wheel QTE correctly tracks rotating needle and triggers success upon click in target zone.

* Verified that Mashing QTE mode successfully tracks keyboard mashing inputs and resolves without locking player movement.

* Verified that Unstuck button click successfully resets lock states and teleports the player back to the entrance.

* Verified that Plinko simulation math maps pocketIndex correctly in range [0, 8] and never returns NaN/out-of-bounds.

* Verified Video Poker hand evaluator correctness for Royal Flush, Straight Flush, Four of a Kind, Full House, Flush, Straight, Three of a Kind, Two Pair, Jacks or Better, and Lose hands.

* Verified that universal co-play sidebar is dynamically wrapped and injected across other minigames (Plinko, Slots).

* Verified that guest departure happiness of 80% is normalized to 100% in rating history.

* Verified that guests forced to leave at the end of the day do not impact rating history.

* Verified that releaseAllHeldSeats successfully clears seat reservations in placed objects.

* Verified that need decay follows a sigmoid satisfaction curve (slower when needs are full).

* Verified that out-of-stock machines are filtered out and successfully replenished by player refill commands.

* Verified player manual food grabbing, carrying state, and direct guest serving.

* Verified multiplayer Craps shared table bets, concurrent player chip rendering, and co-play sidebar updates.

* Verified guest disconnection handled gracefully on host.

### Test Case: Multiplayer Lobby Sync & Concurrent Interactions

* Verified WebRTC simulated client hosting and lobby joining.

* Verified synchronized real-time WASD player coordinates between Host and Guest.

* Verified placement collision prevention (only 1 object is placed on collision).

* Verified concurrent upgrade execution handled correctly by simulator.

* Verified multiplayer Craps shared table bets, concurrent player chip rendering, and co-play sidebar updates.

* Verified guest player cleanup upon connection termination.

### Test Case: Chaos Monkey Autoplay Fuzzer

* Executed 120 high-speed simulated gameplay steps.

* Verified that no unhandled exceptions or browser console errors occurred during chaos execution.