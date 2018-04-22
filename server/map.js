const fs = require('fs')
const path = require('path')

const worldMap = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../maps/world_hex.json')))

const tileTypes = {
  0: 'water',
  2: 'ice',
  3: 'grass',
  5: 'desert',
}

function newMap(layer) {
  const nx = layer.width
  const ny = layer.height
  const grid = []
  for (let y = 0; y < ny; y++) {
    const row = []
    for (let x = 0; x < nx; x++) {
      const type = tileTypes[layer.data[y * nx + x]] || 'water'
      row.push({
        type,
        fish: type == 'water' ? Math.floor(10 * Math.random()) : 0
      })
    }
    grid.push(row)
  }
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const tile = grid[y][x]
      if (tile.type == 'water') {
        tile.clazz = 'water'
      } else if (tile.type == 'ice') {
        tile.clazz = 'ice'
      } else {
        const offsets = (y % 2 == 0 ?
          [[0, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1]] :
          [[1, -1], [1, 0], [1, 1], [0, 1], [-1, 0], [0, -1]]);
        let waterCount = 0
        offsets.forEach(function (offset) {
          const xx = (x + offset[0] + nx) % nx
          const yy = y + offset[1]
          if (yy < 0 || yy >= ny) {
            return
          }
          if (grid[yy][xx].type == 'water') {
            waterCount++
          }
        })
        tile.clazz = waterCount > 0 ? 'coast' : 'inland'
      }
    }
  }
  return {
    nx,
    ny,
    grid
  }
}

module.exports = {
  newWorld: function() { return newMap(worldMap.layers[1]) },
}
