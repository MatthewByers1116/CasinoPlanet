// InputHandler: Captures and dispatches keyboard, mouse, and click controls for the game client
(function() {
  class InputHandler {
    constructor(canvas, cellSize) {
      this.canvas = canvas;
      this.cellSize = cellSize;
      this.offsetX = 0;
      this.offsetY = 0;

      // Key states
      this.keys = {};
      
      // Mouse grid state
      this.mouseGridX = 0;
      this.mouseGridY = 0;
      this.isMouseDown = false;

      // Callbacks
      this.onInteractPressed = null;
      this.onCellClicked = null;
      
      this.setupListeners();
    }

    setupListeners() {
      // Keyboard
      window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        this.keys[key] = true;
        this.keys[e.key] = true; // Support arrows

        if (key === 'e' && this.onInteractPressed) {
          this.onInteractPressed();
        }
      });

      window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        this.keys[key] = false;
        this.keys[e.key] = false;
      });

      // Mouse Movements on Canvas
      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        // Adjust for canvas stretching/scaling
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        this.mouseGridX = Math.floor((mouseX - this.offsetX) / this.cellSize);
        this.mouseGridY = Math.floor((mouseY - this.offsetY) / this.cellSize);
      });

      this.canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left click
          this.isMouseDown = true;
          if (this.onCellClicked) {
            this.onCellClicked(this.mouseGridX, this.mouseGridY);
          }
        }
      });

      this.canvas.addEventListener('mouseup', () => {
        this.isMouseDown = false;
      });
    }

    // Returns direction vector based on pressed keys
    getMovementDirection() {
      let dx = 0;
      let dy = 0;

      if (this.keys['w'] || this.keys['arrowup']) dy = -1;
      else if (this.keys['s'] || this.keys['arrowdown']) dy = 1;

      if (this.keys['a'] || this.keys['arrowleft']) dx = -1;
      else if (this.keys['d'] || this.keys['arrowright']) dx = 1;

      // Prioritize orthogonal movement
      if (dx !== 0) dy = 0;

      return { dx, dy };
    }
  }

  window.Casino.InputHandler = InputHandler;
})();
