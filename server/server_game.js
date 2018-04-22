const BaseGame = require('../shared/base_game')
const map = require('./map')

const PLAYER_COLORS = [
  '#FF4136',
  '#FFDC00',
  '#B10DC9',
  '#001f3f',
  '#FF851B',
  '#AAAAAA',
  '#111111',
  '#01FF70',
]
const MAX_FISH_PER_TILE = 9
const INITIAL_CASH = 100
const BASE_COST = 100
const BOAT_COST = 50
const CASH_PER_FISH = 10
const BOAT_CAPACITY = 5
const BOAT_RANGE = 4

module.exports = class ServerGame extends BaseGame {
  constructor(id) {
    const m = map.newWorld()
    const nx = m.nx
    const ny = m.ny
    const grid = m.grid
    super({
      chats: [],
      players: {},
      nx,
      ny,
      grid,
      baseCost: BASE_COST,
      boatCost: BOAT_COST,
      maxFishPerTile: MAX_FISH_PER_TILE,
      cashPerFish: CASH_PER_FISH,
      year: 1,
    })

    this.id = id

    this.sockets = {}

    this.gameMessage('Select a location on the coast for your first base. If two players select the same location, both will be reassigned randomly!')
  }

  join(playerId, playerName, socket) {
    this.sockets[playerId] = socket

    socket.on('chat', (message) => this.chat(playerId, message))
    socket.on('commands', (commands) => this.commands(playerId, commands))
    socket.on('disconnect', () => this.disconnect(playerId, socket))

    if (!this.state.players[playerId]) {
      this.state.players[playerId] = {
        id: playerId,
        name: playerName,
        color: PLAYER_COLORS[Object.keys(this.state.players).length % PLAYER_COLORS.length],
        cash: INITIAL_CASH,
        bases: [],
        commands: [],
        done: false,
      }
      this.gameMessage(`${playerName} has joined`)
    }

    socket.emit('state', this.clientState(playerId))
    this.state.chats.forEach((chat) => {
      socket.emit('chat', chat)
    })

    this.sendState()
  }

  commands(playerId, commands) {
    this.state.players[playerId].commands = commands
    this.state.players[playerId].done = true

    if (this.allDone()) {
      this.simulate()
    }

    this.sendState()
  }

  allDone() {
    for (const player of Object.values(this.state.players)) {
      if (!player.done) {
        return false
      }
    }
    return true
  }

  simulate() {
    this.buildBases()
    this.dispatchBoats()

    for (const player of Object.values(this.state.players)) {
      player.commands = []
      player.done = false
    }

    this.state.year++
    this.gameMessage(`Year ${this.state.year} has begun`)
  }

  buildBases() {
    const newBases = {}
    for (const playerId in this.state.players) {
      const player = this.state.players[playerId]
      for (const command of player.commands) {
        if (command.type == 'buildBase') {
          const key = `${command.x},${command.y}`
          newBases[key] = newBases[key] || []
          newBases[key].push({ playerId: player.id, command })
        }
      }
    }
    // Build uncontested bases
    for (let key in newBases) {
      if (newBases[key].length == 1) {
        const b = newBases[key][0]
        this.buildBase(b.playerId, b.command)
      }
    }
    // Handle conflicts
    for (let key in newBases) {
      if (newBases[key].length == 1) {
        continue
      }
      const bs = newBases[key]
      const players = []
      for (let b of bs) {
        players.push(this.state.players[b.playerId].name)
      }
      this.gameMessage(`${players.join(' and ')} built bases on the same spot; these were placed randomly instead`)
      for (let b of bs) {
        for (var i = 0; i < 100; i++) {
          const x = Math.floor(this.state.nx * Math.random())
          const y = Math.floor(this.state.ny * Math.random())
          if (this.canBuildBase(b.playerId, x, y)) {
            b.command.x = x
            b.command.y = y
            break
          }
        }
        this.buildBase(b.playerId, b.command)
      }
    }
  }

  buildBase(playerId, command) {
    if (this.state.players[playerId].cash < this.state.baseCost) {
      console.log(`${playerId} does not have enough cash to build a base`)
      return
    }
    if (!this.canBuildBase(playerId, command.x, command.y)) {
      console.log(`Cannot build base at ${JSON.stringify(command)}`)
      return
    }
    const player = this.state.players[playerId]
    const tile = this.state.grid[command.y][command.x]
    player.bases.push({
      x: command.x,
      y: command.y,
      boats: []
    })
    tile.hasBase = true
    tile.baseOwner = playerId
    player.cash -= this.state.baseCost
    this.gameMessage(`${player.name} built a new base`)

    this.buyBoat(playerId, player.bases.length - 1, true)
  }

  buyBoat(playerId, baseIndex, free) {
    if (!free && this.state.players[playerId].cash < this.state.boatCost) {
      console.log(`${playerId} does not have enough cash to buy a boat`)
    }
    this.state.players[playerId].bases[baseIndex].boats.push({
      capacity: BOAT_CAPACITY,
      range: BOAT_RANGE,
      dispatched: false
    })
    if (!free) {
      this.state.players[playerId].cash -= this.state.boatCost
    }
  }

  dispatchBoats() {
    // TODO conflict handling
    for (const playerId in this.state.players) {
      const player = this.state.players[playerId]
      for (const base of player.bases) {
        for (const boat of base.boats) {
          boat.lastX = null
          boat.lastY = null
          boat.fishCaught = null
        }
      }
      for (const command of player.commands) {
        if (command.type == 'dispatchBoat') {
          const boat = player.bases[command.baseIndex].boats[command.boatIndex]
          const tile = this.state.grid[command.y][command.x]
          const fishCaught = Math.min(tile.fish, boat.capacity)
          boat.lastX = command.x
          boat.lastY = command.y
          boat.fishCaught = fishCaught
          tile.fish -= fishCaught
          player.cash += fishCaught * this.state.cashPerFish
        }
      }
    }
  }

  rename(playerId, playerName) {
    const player = this.state.players[playerId]
    if (!player) {
      console.log('Player not in game: ', playerId)
      return
    }
    console.log(`Renaming ${player.name} to ${playerName}`)
    player.name = playerName
    this.sendState()
  }

  chat(playerId, message) {
    this.addChat({ playerId, message })
  }

  gameMessage(message) {
    this.addChat({ game: true, message })
  }

  addChat(chat) {
    this.state.chats.push(chat)
    while (this.state.chats.length > 100) {
      this.state.chats.shift()
    }
    for (const playerId in this.sockets) {
      console.log('Sending chat to', playerId)
      this.sockets[playerId].emit('chat', chat)
    }
  }

  sendState() {
    for (const playerId in this.sockets) {
      console.log('Sending state to', playerId)
      this.sockets[playerId].emit('state', this.clientState(playerId))
    }
  }

  clientState(playerId) {
    const state = this.state
    let totalFish = 0
    const grid = JSON.parse(JSON.stringify(state.grid))
    for (var y = 0; y < state.ny; y++) {
      for (var x = 0; x < state.nx; x++) {
        totalFish += grid[y][x].fish
        grid[y][x].fish = null
      }
    }
    this.state.players[playerId].bases.forEach((base) => {
      base.boats.forEach((boat) => {
        if (typeof boat.lastX == 'number') {
          grid[boat.lastY][boat.lastX].fish = this.state.grid[boat.lastY][boat.lastX].fish + boat.fishCaught
          this.neighbors(boat.lastX, boat.lastY).forEach((coords) => {
            grid[coords.y][coords.x].fish = this.state.grid[coords.y][coords.x].fish
          })
        }
      })
    })
    // TODO scrub commands
    return {
      players: state.players,
      year: state.year,
      nx: state.nx,
      ny: state.ny,
      grid: grid,
      baseCost: state.baseCost,
      boatCost: state.boatCost,
      maxFishPerTile: state.maxFishPerTile,
      cashPerFish: state.cashPerFish,
      totalFish
    }
  }

  disconnect(playerId, socket) {
    delete this.sockets[playerId]
  }
}
