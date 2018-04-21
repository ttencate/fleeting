const fs = require('fs')
const path = require('path')

const worldMap = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'maps/world_hex.json')))
const worldMapData = worldMap.layers[1].data

module.exports = {
  tileTypes: {
    0: 'water',
    2: 'ice',
    3: 'grass',
    5: 'desert',
  },
  world: {
    nx: worldMap.layers[1].width,
    ny: worldMap.layers[1].height,
    data: worldMap.layers[1].data
  }
}
