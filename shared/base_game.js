class BaseGame {
  constructor(state) {
    this.state = state
  }

  canBuildBaseAt(x, y) {
    const tile = this.state.grid[y][x]
    return tile.clazz == 'coast' && !tile.hasBase
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

if (module) {
  module.exports = BaseGame
}
