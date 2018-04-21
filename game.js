module.exports = class Game {
  constructor(id, room) {
    this.id = id
    this.room = room

    const nx = 20
    const ny = 10
    const grid = []
    for (let y = 0; y < ny; y++) {
      const row = []
      for (let x = 0; x < nx; x++) {
        const water = Math.random() > 0.3
        row.push({
          water,
          fish: water ? Math.floor(10 * Math.random()) : 0
        })
      }
      grid.push(row)
    }

    this.state = {
      chats: [],
      players: {},
      nx,
      ny,
      grid
    }

    this.sockets = {}
  }

  join(playerId, playerName, socket) {
    this.state.players[playerId] = {
      id: playerId,
      name: playerName
    }

    this.sockets[playerId] = socket

    socket.on('chat', (message) => this.chat(playerId, message))
    socket.on('disconnect', () => this.disconnect(playerId, socket))
    socket.emit('state', this.clientState(playerId))
    this.state.chats.forEach((chat) => {
      socket.emit('chat', chat)
    })

    this.sendState()
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
    const chat = { playerId, message }
    this.state.chats.push(chat)
    while (this.state.chats.length > 100) {
      this.state.chats.shift()
    }
    this.room.emit('chat', chat)
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
    for (var y = 0; y < state.ny; y++) {
      for (var x = 0; x < state.nx; x++) {
        totalFish += state.grid[y][x].fish
      }
    }
    return {
      players: state.players,
      nx: state.nx,
      ny: state.ny,
      grid: state.grid,
      totalFish
    }
  }

  disconnect(playerId, socket) {
    delete this.sockets[playerId]
  }
}
