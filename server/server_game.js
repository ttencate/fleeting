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
const INITIAL_CASH = 10
const BASE_COST = 10
const BOAT_COST = 5
const CASH_PER_FISH = 1
const BOAT_CAPACITY = 5
const BOAT_RANGE = 3
const TARGET_CASH_TIMES_PLAYERS = 240
const SPAWN_COUNT = 2
const SPAWN_PERCENT = 100
const MIGRATE_PERCENT = 15
const DEATH_PERCENT = 30
const LOSE_BELOW_TOTAL_FISH = 100

const TIPS = {
  1: 'Select a location on the coast for your first base. If two players select the same location, both will be reassigned randomly!',
  2: 'Select your base, then dispatch your fleet to a nearby tile.',
  4: 'Maybe you can build another base already?',
  6: 'Pro tip: you can click a base, then right-click to dispatch.',
  8: 'Each year, fish spawn, migrate and die.',
  10: `There must be at least ${SPAWN_COUNT} fish in a tile for them to reproduce.`,
  12: `Each fish has a ${MIGRATE_PERCENT}% chance of migrating to a neighbouring tile.`,
  14: `Each fish has a ${DEATH_PERCENT}% chance of dying each year.`,
}

module.exports = class ServerGame extends BaseGame {
  constructor(id, state) {
    const m = map.newWorld()
    const nx = m.nx
    const ny = m.ny
    const grid = m.grid
    super(state || {
      id,
      chats: [],
      players: {},
      nx,
      ny,
      grid,
      baseCost: BASE_COST,
      boatCost: BOAT_COST,
      maxFishPerTile: MAX_FISH_PER_TILE,
      cashPerFish: CASH_PER_FISH,
      year: 0,
      totalFish: null
    })
    this.updateTotalFish()

    this.sockets = {}

    if (!state) {
      this.simulate()
    }
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
      if (this.turnEnded) {
        this.turnEnded()
      }
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
    const state = this.state
    for (var y = 0; y < state.ny; y++) {
      for (var x = 0; x < state.nx; x++) {
        const tile = state.grid[y][x]
        tile.prevFish = tile.fish
      }
    }

    this.buildBases()
    this.dispatchBoats()

    for (const player of Object.values(this.state.players)) {
      player.commands = []
      player.done = false
    }

    this.spawn()
    this.migrate()
    this.die()
    this.updateTotalFish()

    this.state.year++
    this.gameMessage(`Year ${this.state.year} has begun, with ${this.state.totalFish} fish`)

    const tip = TIPS[this.state.year]
    if (tip) {
      this.gameMessage(tip)
    }

    this.sendState()
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
          if (!this.canDispatchBoat(playerId, command.baseIndex, command.boatIndex, command.x, command.y)) {
            console.log(`${playerId} cannot dispatch boat to ${command.x}, ${command.y}`)
            continue
          }
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

  spawn() {
    for (let y = 0; y < this.state.ny; y++) {
      for (let x = 0; x < this.state.nx; x++) {
        const tile = this.state.grid[y][x]
        if (tile.clazz == 'water') {
          const spawn = Math.floor(tile.fish / SPAWN_COUNT)
          for (let i = 0; i < spawn; i++) {
            if (100 * Math.random() <= SPAWN_PERCENT) {
              tile.fish = Math.min(tile.fish + 1, MAX_FISH_PER_TILE)
            }
          }
        }
      }
    }
  }

  migrate() {
    for (let y = 0; y < this.state.ny; y++) {
      for (let x = 0; x < this.state.nx; x++) {
        const tile = this.state.grid[y][x]
        if (tile.clazz == 'water') {
          for (let i = 0; i < tile.fish; i++) {
            if (100 * Math.random() <= MIGRATE_PERCENT) {
              const neigh = this.neighbors(x, y)
              const toCoords = neigh[Math.floor(6 * Math.random())]
              if (!toCoords) {
                continue
              }
              const toTile = this.state.grid[toCoords.y][toCoords.x]
              if (!toTile || toTile.clazz != 'water' || toTile.fish >= MAX_FISH_PER_TILE) {
                continue
              }
              tile.fish -= 1
              toTile.fish += 1
            }
          }
        }
      }
    }
  }

  die() {
    for (let y = 0; y < this.state.ny; y++) {
      for (let x = 0; x < this.state.nx; x++) {
        const tile = this.state.grid[y][x]
        if (tile.clazz == 'water') {
          for (let i = 0; i < tile.fish; i++) {
            if (100 * Math.random() <= DEATH_PERCENT) {
              tile.fish -= 1
            }
          }
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

  updateTotalFish() {
    const grid = this.state.grid
    let totalFish = 0
    for (var y = 0; y < this.state.ny; y++) {
      for (var x = 0; x < this.state.nx; x++) {
        totalFish += grid[y][x].fish
      }
    }
    this.state.totalFish = totalFish;
  }

  sendState() {
    for (const playerId in this.sockets) {
      console.log('Sending state to', playerId)
      this.sockets[playerId].emit('state', this.clientState(playerId))
    }
  }

  clientState(playerId) {
    const state = this.state
    const grid = JSON.parse(JSON.stringify(state.grid))
    this.state.players[playerId].bases.forEach((base) => {
      base.boats.forEach((boat) => {
        if (typeof boat.lastX == 'number') {
          grid[boat.lastY][boat.lastX].visible = true
          this.neighbors(boat.lastX, boat.lastY).forEach((coords) => {
            grid[coords.y][coords.x].visible = true
          })
        }
      })
    })
    for (var y = 0; y < this.state.ny; y++) {
      for (var x = 0; x < this.state.nx; x++) {
        if (!grid[y][x].visible) {
          // grid[y][x].prevFish = null
          grid[y][x].fish = null
        }
        delete grid[y][x].visible
      }
    }

    const players = JSON.parse(JSON.stringify(state.players))
    for (const player of Object.values(players)) {
      if (player.id != playerId) {
        player.commands = []
      }
    }

    return {
      players,
      year: state.year,
      nx: state.nx,
      ny: state.ny,
      grid: grid,
      baseCost: state.baseCost,
      boatCost: state.boatCost,
      maxFishPerTile: state.maxFishPerTile,
      cashPerFish: state.cashPerFish,
      totalFish: state.totalFish
    }
  }

  disconnect(playerId, socket) {
    delete this.sockets[playerId]
  }
}
