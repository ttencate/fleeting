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
      nx,
      ny,
      grid
    }
  }

  connect(playerId, socket) {
    socket.on('chat', (message) => this.chat(playerId, message))
    socket.on('disconnect', () => this.disconnect(playerId, socket))
    socket.emit('state', this.clientState(playerId))
    for (const chat of this.state.chats) {
      socket.emit('chat', chat)
    }
  }

  chat(playerId, message) {
    const chat = { playerId, message }
    this.chats.push(chat)
    while (this.chats.length > 100) {
      this.chats.shift()
    }
    this.room.emit('chat', chat)
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
      nx: state.nx,
      ny: state.ny,
      grid: state.grid,
      totalFish
    }
  }

  disconnect(playerId, socket) {
  }
}
