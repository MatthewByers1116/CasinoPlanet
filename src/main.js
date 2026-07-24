// Main Bootstrapper: Links local simulation server and client, starts rendering loops
window.addEventListener('DOMContentLoaded', () => {
  console.log("🎲 Initializing Casino Planet...");

  // Create Game Client (Client handles its own connection and server boot logic)
  const client = new window.Casino.ClientGame();
  window.Casino.clientInstance = client; // Expose globally for simulator debug logs

  // Start Client Loop (Ticks rendering frames, WASD movement, and mouse click handlers)
  client.start();

  console.log("🎰 Casino Planet is active! Double-click index.html to run without web server requirements.");
});
