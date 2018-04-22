const path = require('path')
const sqlite = require('sqlite')

const ServerGame = require('./server_game')

class Storage {
  constructor(db) {
    this.db = db
  }

  async loadAllGames() {
    const results = await this.db.all('SELECT * FROM games')
    const games = {}
    for (const result of results) {
      try {
        const state = JSON.parse(result.state)
        games[state.id] = new ServerGame(state.id, state)
      } catch (ex) {
        console.error(`Failed to load game ${result.id}`, ex)
      }
    }
    return games
  }

  async saveGame(game) {
    try {
      const ids = await this.db.all('SELECT id FROM games WHERE id = ?', game.state.id)
      const jsonState = JSON.stringify(game.state)
      if (ids.length == 0) {
        await this.db.run(
          'INSERT INTO games VALUES ($id, $state)',
          { $id: game.state.id, $state: jsonState })
        console.log(`Inserted saved game ${game.state.id} (year ${game.state.year})`)
      } else {
        await this.db.run(
          'UPDATE games SET state = $state WHERE id = $id',
          { $id: game.state.id, $state: jsonState })
        console.log(`Updated saved game ${game.state.id} (year ${game.state.year})`)
      }
    } catch (ex) {
      console.error(`Failed to save game ${game.state.id}`, ex)
    }
  }

  async deleteGame(gameId) {
    try {
      await this.db.run(
        'DELETE FROM games WHERE id = $id',
        { $id: gameId })
    } catch (ex) {
      console.error(`Failed to delete saved game ${gameId}`, ex)
    }
  }

  async close() {
    await this.db.close()
  }
}

async function create(path) {
  const db = await sqlite.open(path, { Promise })
  try {
    await db.run('CREATE TABLE games (id TEXT, state TEXT)')
  } catch (ex) {
    // Ignore: table already exists
  }
  return new Storage(db)
}

module.exports = {
  Storage,
  create
}
