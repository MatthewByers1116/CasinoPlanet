# 🎰 Casino Planet - Developer & Architecture Guide

Welcome to the **Casino Planet** developer documentation! This guide details the project's architecture, data synchronization flow, entity behaviors, design systems, and build commands to help new contributors get up to speed quickly.

---

## 📌 Project Overview
Casino Planet is a premium, real-time multiplayer casino tycoon simulator. It runs entirely in the browser and uses a **Host-Authoritative P2P (Peer-to-Peer) architecture** via WebRTC.

The host runs the authoritative server simulation locally, while guests connect via PeerJS/WebRTC to act as rendering nodes, transmitting player movements and building actions back to the host.

---

## 📂 Directory & File Structure

```
CasinoPlanetProject/
│
├── CasinoPlanet.html           # Rebuilt standalone desktop release (compiled)
├── CasinoPlanetMobile.html     # Rebuilt standalone mobile release (compiled)
│
├── index.html                  # Desktop launcher layout
├── mobile.html                 # Mobile launcher layout
├── test_runner.html            # Browser-based integration test harness
│
├── build_single_file.py        # Desktop packaging script
├── build_single_file_mobile.py # Mobile packaging script
├── serve.py                    # Local dev HTTP server (port 8000)
├── package.json                # Project dependencies
│
└── src/
    ├── main.js                 # Launcher entrance & PeerJS handshake
    ├── style.css               # Main visual stylesheet (Neon theme)
    │
    ├── shared/                 # Protocols shared between client & server
    │   ├── Protocol.js         # Command and Event byte/JSON packet headers
    │   └── GameObjects.js      # Casino catalog dimensions, costs, and limits
    │
    ├── server/                 # Authoritative Server Simulation
    │   ├── GameSim.js          # Authoritative game loop & action handler
    │   ├── GridManager.js      # Placement grid collision & layout
    │   ├── EconomyManager.js   # Budget deductions & payouts manager
    │   ├── Pathfinding.js      # A* grid-based pathfinding
    │   └── entities/           # Entity AI agents
    │       ├── PlayerEntity.js # Player coordinates & active buffs
    │       ├── GuestAI.js      # Need decay, ATM use, and leaving AI
    │       └── EmployeeAI.js   # Waitress restock & broken machine repairs
    │
    └── client/                 # Client Render & User Interface
        ├── ClientGame.js       # Inputs catcher & server connection manager
        ├── Renderer.js         # HTML5 Canvas 2D frame drawing engine
        ├── MinigameUI.js       # Minigames layout & P2P co-play sidebar
        └── SoundManager.js     # Sound effects & background music
```

---

## ⚡ P2P WebRTC Communication Flow

Casino Planet uses a Host-Authoritative model:
- **Host Client**: Initializer of the session. Runs the authoritative `GameSim.js` instance.
- **Guest Client**: dumb terminal. Forwards keystrokes and button clicks to the host.

```
[Guest Client] --- (COMMAND.MOVE_PLAYER) ---> [Host Client (GameSim)]
[Guest Client] <--- (EVENT.FULL_STATE) ------- [Host Client (GameSim)]
```

---

## 🧠 Core System Mechanics

### 1. Grid Placement & Collision (`GridManager.js`)
The casino map is represented as a 2D cell grid:
- Table games (Blackjack, Roulette, Craps) occupy multi-cell blocks and define a specific **Dealer Seat** (coordinates where employees or players stand to boost game payouts) and **Guest Seats** (coordinates where players and guests sit).
- Machine items (Slots, Video Poker, Plinko, ATMs) occupy single cells.
- Standard pathfinding weights blocked tiles (walls, solid objects, and seated players/guests) as untraversable.

### 2. Pathfinding & Walkable Adjacent Targeting (`EmployeeAI.js` / `Pathfinding.js`)
- Employees (Waitresses, Chefs, Mechanics) need to target solid objects to restock or repair them.
- Because solid objects block grid tiles, pathfinding directly to the object coordinates would fail.
- Instead, AI uses the helper `findWalkableAdjacent(gridManager, targetObj)` which finds the closest walkable coordinate bordering the object's width/height bounding box.

### 3. Guest Needs & Rating Normalization (`GuestAI.js`)
- **Needs Decay**: Guest thirst, hunger, and bladder (bio) decay dynamically over time.
- **Prioritization**: When selecting the next action, the guest sorts their needs and actively targets the lowest one if it drops below `55`.
- **Busy-Amenity Waiting**: If all matching drink/food amenities are occupied, a critically needy guest enters a brief 1-2 second wandering delay to wait for a vacancy instead of giving up and locking themselves into another game loop.
- **smart Leaving Check**: Guests will **not leave** the casino due to hunger/thirst/bladder if active, non-broken objects satisfying that need exist in the casino.
- **Rating Normalization**: Average guest departure satisfaction is normalized so that any score of **80% or above counts as a perfect 100%** in the star rating sample history.
- **Forced Exit Safeguard**: Guests remaining at the end of the day are flagged with `isForcedExit = true` and bypassed during star rating updates.

---

## 👥 Universal Multiplayer Co-Play Sidebar
Every table game and arcade console supports synchronized multiplayer co-play.
- When you interact with a game (e.g., Plinko, Slots, Baccarat), the `MinigameUI` dynamically wraps the template content inside a flex layout container.
- It attaches the unified **`👥 PLAYERS AT TABLE`** sidebar panel on the right.
- As players join the table, their coordinates updates bind them to the table ID, updating the co-play list in real-time.

---

## 🧪 Integration & Automated Testing (`test_runner.html`)

Casino Planet has a comprehensive browser-based integration test framework in `test_runner.html`.
- It spins up a simulated Host game instance and a Guest game instance side-by-side in hidden iframes.
- It tests connection synchronization, responsive HUD element overlaps, employee restocking, puzzle/wheel QTE resolutions, Plinko payout margins, and ratings normalization.
- **Running Tests**: Run local dev server (`python serve.py`), open Chrome, and navigate to `http://127.0.0.1:8000/test_runner.html`.

---

## 🚀 Build & Packaging Commands

Since the game can be uploaded to platforms like Itch.io, we package all Javascript and CSS source code directly into a single, dependency-free HTML file.

- **Build Desktop Standalone**:
  ```bash
  python build_single_file.py
  ```
  Creates standalone client: `CasinoPlanet.html`

- **Build Mobile Standalone**:
  ```bash
  python build_single_file_mobile.py
  ```
  Creates standalone mobile client: `CasinoPlanetMobile.html`

- **Local Dev Server**:
  ```bash
  python serve.py
  ```
  Serves project at: `http://localhost:8000` (launcher) and `/test_runner.html` (tests).

---

## 📝 Developer Guidelines

When adding a new game, console, or employee role:
1. **Define Schema**: Register the object's size, cost, and `useTime` in `src/shared/GameObjects.js`.
2. **Setup P2P Events**: Add any specialized action commands to `src/shared/Protocol.js`.
3. **Simulate authoritative outcomes**: Handle the gameplay math and wallet deduction in `src/server/GameSim.js`.
4. **Create UI interface template**: Build the game overlay rendering screen in `src/client/MinigameUI.js`.
5. **Ensure Null-Safety**: Keep coordinate calculations and client state bindings null-safe to prevent crashes in simulated headless test runners.
