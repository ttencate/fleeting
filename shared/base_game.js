class BaseGame {
  constructor(state) {
    this.state = state
  }

  getPlayer(playerId) {
    return this.state.players[playerId]
  }

  canBuildBase(playerId, x, y) {
    if (this.getPlayer(playerId).cash < this.state.baseCost) {
      return false
    }
    const tile = this.state.grid[y][x]
    return tile.clazz == 'coast' && !tile.hasBase
  }

  canDispatchBoat(playerId, baseIndex, boatIndex, x, y) {
    if (baseIndex < 0 || boatIndex < 0) {
      return false
    }
    if (state.grid[y][x].clazz != 'water') {
      return false
    }
    return true
  }

  neighbors(x, y) {
    const offsets = (y % 2 == 0 ?
      [[0, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1]] :
      [[1, -1], [1, 0], [1, 1], [0, 1], [-1, 0], [0, -1]]);
    return offsets.map(function (offset) {
      return { x: x + offset[0], y: y + offset[1] }
    })
  }
}

if (typeof module != 'undefined') {
  module.exports = BaseGame
}
