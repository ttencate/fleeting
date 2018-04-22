const NEIGHBOR_OFFSETS = [
  [[0, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1]],
  [[1, -1], [1, 0], [1, 1], [0, 1], [-1, 0], [0, -1]]
]

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
    if (this.state.grid[y][x].clazz != 'water') {
      return false
    }
    const base = this.getPlayer(playerId).bases[baseIndex]
    const boat = base.boats[boatIndex]
    if (this.distance(base, { x, y }) > boat.range) {
      return false
    }
    return true
  }

  toCube(coords) {
    // https://www.redblobgames.com/grids/hexagons/#conversions
    const x = coords.x - (coords.y - (coords.y & 1)) / 2
    const z = coords.y
    const y = -x - z
    return { x, y, z }
  }

  distance(a, b) {
    const nx = this.state.nx
    const ca0 = this.toCube(a)
    const ca1 = this.toCube({ x: a.x - nx, y: a.y })
    const ca2 = this.toCube({ x: a.x + nx, y: a.y })
    const cb = this.toCube(b)
    function d(ca, cb) {
      return (Math.abs(cb.x - ca.x) + Math.abs(cb.y - ca.y) + Math.abs(cb.z - ca.z)) / 2
    }
    return Math.min(d(ca0, cb), d(ca1, cb), d(ca2, cb))
  }

  neighbors(x, y) {
    const state = this.state
    const neighs = []
    for (const offset of NEIGHBOR_OFFSETS[y % 2]) {
      const xx = (x + offset[0] + state.nx) % state.nx
      const yy = y + offset[1]
      if (yy >= 0 && yy < state.ny) {
        neighs.push({ x: xx, y: yy })
      }
    }
    return neighs
  }

  getRankedPlayers() {
    const players = Object.values(this.state.players)
    players.sort(function (a, b) {
      if (a.cash == b.cash) {
        return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0
      }
      return b.cash - a.cash
    })
    return players
  }
}

if (typeof module != 'undefined') {
  module.exports = BaseGame
}
