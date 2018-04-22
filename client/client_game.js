class ClientGame extends BaseGame {
  constructor(playerId, state) {
    super(state)

    this.playerId = playerId

    this.commandQueue = []
  }

  setState(state) {
    this.state = state
    this.applyCommands()
  }

  me() {
    return this.state.players[this.playerId]
  }

  buildBase(x, y) {
    if (!this.canBuildBase(this.playerId, x, y)) {
      return false
    }
    const command = {
      type: 'buildBase',
      x: x,
      y: y
    }
    this.commandQueue.push(command)
    this.applyCommand(command)
    return true
  }

  dispatchBoat(baseIndex, boatIndex, x, y) {
    if (!this.canDispatchBoat(this.playerId, baseIndex, boatIndex, x, y)) {
      return false
    }
    const command = {
      type: 'dispatchBoat',
      baseIndex,
      boatIndex,
      x,
      y
    }
    this.commandQueue.push(command)
    this.applyCommand(command)
    return true
  }

  applyCommand(command) {
    const me = this.me()
    if (command.type == 'buildBase') {
      me.bases.push({
        x: command.x,
        y: command.y,
        boats: [],
        isNew: true
      })
      me.cash -= state.baseCost
    } else if (command.type == 'dispatchBoat') {
      const boat = me.bases[command.baseIndex].boats[command.boatIndex]
      boat.x = command.x
      boat.y = command.y
      boat.dispatched = true
    }
  }

  applyCommands() {
    this.me().commands.forEach(this.applyCommand.bind(this))
    this.commandQueue.forEach(this.applyCommand.bind(this))
  }

  hasBase() {
    return this.commandQueue.length > 0 || this.me().bases.length > 0
  }

  getPlayerName(playerId) {
    const player = this.state.players[playerId]
    return (player && player.name) || playerId
  }

  getPlayerColor(playerId) {
    const player = this.state.players[playerId]
    return (player && player.color) || '#000'
  }

  getBaseIndexAt(selectedTile) {
    if (!selectedTile) {
      return -1
    }
    const player = this.me()
    for (let i = 0; i < player.bases.length; i++) {
      const base = player.bases[i]
      if (!base.isNew && base.x == selectedTile.x && base.y == selectedTile.y) {
        return i
      }
    }
    return -1
  }

  getUndispatchedBoatIndex(baseIndex) {
    if (baseIndex < 0) {
      return -1
    }
    const boats = this.me().bases[baseIndex].boats
    for (let i = 0; i < boats.length; i++) {
      const boat = boats[i]
      if (!boat.dispatched) {
        return i
      }
    }
    return -1
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
