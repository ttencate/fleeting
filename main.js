const express = require('express')
const nunjucks = require('nunjucks')
const path = require('path')

const app = express()

function renderTemplate(template, context, res) {
  context.browser_refresh_url = process.env.BROWSER_REFRESH_URL
  const page = nunjucks.render(template, {
    browser_refresh_url: process.env.BROWSER_REFRESH_URL
  })
  res.status(200)
  res.set('content-type', 'text/html')
  res.send(page)
}

app.get('/', function (req, res) {
  renderTemplate('client/index.html', {}, res)
})

app.get(/^\/(\d+)$/, function (req, res) {
  const gameId = req.params[0]
  renderTemplate('client/game.html', { gameId }, res)
})

app.get('/common.js', function (req, res) {
  res.sendFile(path.resolve(__dirname, 'client/common.js'))
})

app.get('/index.js', function (req, res) {
  res.sendFile(path.resolve(__dirname, 'client/index.js'))
})

app.get('/game.js', function (req, res) {
  res.sendFile(path.resolve(__dirname, 'client/game.js'))
})

app.get('/style.css', function (req, res) {
  res.sendFile(path.resolve(__dirname, 'client/style.css'))
})

const host = 'localhost'
const port = 3000
app.listen(port, host, function () {
  console.log(`Serving on http://${host}:${port}`)
  // For browser-refresh
  if (process.send) {
    process.send('online')
  }
})
