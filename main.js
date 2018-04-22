const express = require('express')
const http = require('http')
const nunjucks = require('nunjucks')
const path = require('path')
const socketIo = require('socket.io')

const ServerGame = require('./server/server_game')

const host = 'localhost'
const port = 3000

const app = express()
const httpServer = http.Server(app)
const io = socketIo(httpServer)
const games = {}

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

app.get('/', function (req, res) {
  renderTemplate('client/index.html', {}, res)
})

app.get(/^\/(\d+)$/, function (req, res) {
  const gameId = req.params[0]
  renderTemplate('client/game.html', { gameId }, res)
})

app.get('/common.js', sendFile('client/common.js'))
app.get('/index.js', sendFile('client/index.js'))
app.get('/base_game.js', sendFile('shared/base_game.js'))
app.get('/client_game.js', sendFile('client/client_game.js'))
app.get('/renderer.js', sendFile('client/renderer.js'))
app.get('/game.js', sendFile('client/game.js'))
app.get('/style.css', sendFile('client/style.css'))

io.on('connection', function (socket) {
  console.log('connect:', socket.id)
  socket.on('hello', function (playerId, playerName) {
    socket.on('join', function (gameId) {
      if (!games[gameId]) {
        games[gameId] = new ServerGame(gameId)
      }
      const game = games[gameId]
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

httpServer.listen(port, host, function () {
  console.log(`Serving on http://${host}:${port}`)
  // For browser-refresh
  if (process.send) {
    process.send('online')
  }
})
