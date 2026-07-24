// Pathfinding: A* algorithm for 2D Grid navigation
(function() {
  class Pathfinding {
    static findPath(gridManager, startX, startY, endX, endY, targetIsSolidObject = false) {
      // If target is a solid object, we actually want to find a path to an adjacent walkable cell
      if (targetIsSolidObject) {
        const adjacentCells = [
          { x: endX - 1, y: endY },
          { x: endX + 1, y: endY },
          { x: endX, y: endY - 1 },
          { x: endX, y: endY + 1 }
        ];

        // Filter walkable adjacent cells
        const validTargets = adjacentCells.filter(c => gridManager.isCellWalkable(c.x, c.y));
        if (validTargets.length === 0) return null; // No way to reach the object

        // Find the one closest to start cell using Manhattan distance
        validTargets.sort((a, b) => {
          const distA = Math.abs(startX - a.x) + Math.abs(startY - a.y);
          const distB = Math.abs(startX - b.x) + Math.abs(startY - b.y);
          return distA - distB;
        });

        // Set the actual target cell to the best walkable adjacent cell
        endX = validTargets[0].x;
        endY = validTargets[0].y;
      }

      // Quick check: if start is end, path is just start
      if (startX === endX && startY === endY) {
        return [{ x: startX, y: startY }];
      }

      // If actual target cell is not walkable, fail
      if (!gridManager.isCellWalkable(endX, endY) && !targetIsSolidObject) {
        return null;
      }

      const cols = gridManager.cols;
      const rows = gridManager.rows;

      const openSet = [];
      const closedSet = new Set();

      const startKey = `${startX},${startY}`;
      const endKey = `${endX},${endY}`;

      const startNode = {
        x: startX,
        y: startY,
        g: 0,
        h: Math.abs(startX - endX) + Math.abs(startY - endY),
        parent: null
      };
      startNode.f = startNode.g + startNode.h;

      openSet.push(startNode);

      const openMap = new Map();
      openMap.set(startKey, startNode);

      while (openSet.length > 0) {
        // Sort open list by f value (lowest first)
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();
        const currentKey = `${current.x},${current.y}`;
        openMap.delete(currentKey);
        closedSet.add(currentKey);

        // Found target
        if (current.x === endX && current.y === endY) {
          const path = [];
          let curr = current;
          while (curr !== null) {
            path.push({ x: curr.x, y: curr.y });
            curr = curr.parent;
          }
          return path.reverse(); // Return path from start to end
        }

        // Neighbors (4-directional: no diagonals to match clean grid movement)
        const neighbors = [
          { x: current.x - 1, y: current.y },
          { x: current.x + 1, y: current.y },
          { x: current.x, y: current.y - 1 },
          { x: current.x, y: current.y + 1 }
        ];

        for (const neighbor of neighbors) {
          const nKey = `${neighbor.x},${neighbor.y}`;
          if (closedSet.has(nKey)) continue;

          if (!gridManager.isCellWalkable(neighbor.x, neighbor.y)) {
            // Special exception: if this is our target cell and it was marked walkable during adjacent check, allow
            if (neighbor.x !== endX || neighbor.y !== endY) {
              continue;
            }
          }

          const gScore = current.g + 1;
          let neighborNode = openMap.get(nKey);

          if (!neighborNode) {
            neighborNode = {
              x: neighbor.x,
              y: neighbor.y,
              g: gScore,
              h: Math.abs(neighbor.x - endX) + Math.abs(neighbor.y - endY),
              parent: current
            };
            neighborNode.f = neighborNode.g + neighborNode.h;
            openSet.push(neighborNode);
            openMap.set(nKey, neighborNode);
          } else if (gScore < neighborNode.g) {
            neighborNode.g = gScore;
            neighborNode.f = neighborNode.g + neighborNode.h;
            neighborNode.parent = current;
          }
        }
      }

      return null; // No path found
    }
  }

  window.Casino.Pathfinding = Pathfinding;
})();
