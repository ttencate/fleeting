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

  cancelBase(x, y) {
    for (const i in this.commandQueue) {
      const c = this.commandQueue[i]
      if (c.type == 'buildBase' && c.x == x && c.y == y) {
        this.commandQueue.splice(i, 1)
        const me = this.me()
        me.bases = me.bases.filter(function (base) {
          return base.x != x || base.y != y
        })
        this.me().cash += state.baseCost
        break
      }
    }
  }

  dispatchBoat(baseIndex, boatIndex, x, y) {
    if (!this.canDispatchBoat(this.playerId, baseIndex, boatIndex, x, y)) {
      return false
    }
    let command = null
    for (const c of this.commandQueue) {
      if (c.type == 'dispatchBoat' && c.baseIndex == baseIndex && c.boatIndex == boatIndex) {
        command = c
        break
      }
    }
    if (!command) {
      command = {
        type: 'dispatchBoat',
        baseIndex,
        boatIndex
      }
    }
    command.x = x
    command.y = y
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

  getBaseIndexAt(selectedTile, allowNew) {
    if (!selectedTile) {
      return -1
    }
    const player = this.me()
    for (let i = 0; i < player.bases.length; i++) {
      const base = player.bases[i]
      if ((!base.isNew || allowNew) && base.x == selectedTile.x && base.y == selectedTile.y) {
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
}
