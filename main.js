const express = require('express')
const http = require('http')
const nunjucks = require('nunjucks')
const path = require('path')
const socketIo = require('socket.io')

const ServerGame = require('./server/server_game')
const storage = require('./server/storage')

const HOST = 'localhost'
const PORT = 3000
const DATABASE_PATH = path.resolve(__dirname, 'data.sqlite')

function renderTemplate(template, context, res) {
  context.browserRefreshUrl = process.env.BROWSER_REFRESH_URL
  const page = nunjucks.render(template, context)
  res.status(200)
  res.set('content-type', 'text/html')
  res.send(page)
}

function sendFile(file) {
  return function (req, res) {
    res.sendFile(path.resolve(__dirname, file))
  }
}

async function main() {
  const store = await storage.create(DATABASE_PATH)

  const app = express()
  const httpServer = http.Server(app)
  const io = socketIo(httpServer)
  const games = await store.loadAllGames()
  console.log(`Loaded ${Object.keys(games).length} games from storage`)

  function turnEnded() {
    store.saveGame(this)
  }
  for (game of Object.values(games)) {
    game.turnEnded = turnEnded
  }

  app.get('/', function (req, res) {
    renderTemplate('client/index.html', {}, res)
  })

  app.get(/^\/(\d+)$/, function (req, res) {
    const gameId = JSON.stringify(req.params[0])
    renderTemplate('client/game.html', { gameId }, res)
  })

  app.get('/common.js', sendFile('client/common.js'))
  app.get('/index.js', sendFile('client/index.js'))
  app.get('/base_game.js', sendFile('shared/base_game.js'))
  app.get('/client_game.js', sendFile('client/client_game.js'))
  app.get('/renderer.js', sendFile('client/renderer.js'))
  app.get('/main.js', sendFile('client/main.js'))
  app.get('/style.css', sendFile('client/style.css'))

  io.on('connection', function (socket) {
    console.log('connect:', socket.id)
    socket.on('hello', function (playerId, playerName) {
      socket.on('join', function (gameId) {
        let game = games[gameId]
        if (!game) {
          console.log(`Creating new game ${gameId}`)
          game = new ServerGame(gameId)
          games[gameId] = game
          game.turnEnded = turnEnded
          store.saveGame(game) // Asynchronous
        }

        socket.join(gameId)
        game.join(playerId, playerName, socket)

        socket.on('rename', function (newName) {
          playerName = newName
          game.rename(playerId, newName)
        })
      })
    })
    socket.on('disconnect', function () {
      console.log('disconnect:', socket.id)
    })
  })

  httpServer.on('listening', function () {
    console.log(`Listening on http://${HOST}:${PORT}`)
    // For browser-refresh
    if (process.send) {
      process.send('online')
    }
  })
  httpServer.on('close', function () {
    console.log('Server closed')
  })
  httpServer.listen(PORT, HOST)

  async function shutdown() {
    setTimeout(function () {
      console.error('Timeout exceeded, closing forcefully')
      process.exit(1)
    }, 5000)
    Object.values(io.sockets.connected).forEach(function (socket) {
      console.log(`Closing ${socket.id}`)
      socket.disconnect(true)
    })
    io.close(function () {
      console.log('SocketIO closed cleanly')
      httpServer.close(async function () {
        console.log('HTTP server closed cleanly')
        await store.close()
        console.log('Storage closed cleanly')
        process.exit(0)
      })
    })
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main()
