const express = require('express')
const nunjucks = require('nunjucks')
const path = require('path')

const app = express()

app.get('/', function (req, res) {
  //res.sendFile(path.resolve(__dirname, 'client/index.html'))
  const page = nunjucks.render('client/index.html', {
    browser_refresh_url: process.env.BROWSER_REFRESH_URL
  })
  res.status(200)
  res.set('content-type', 'text/html')
  res.send(page)
})
app.get('/style.css', function (req, res) {
  res.sendFile(path.resolve(__dirname, 'client/style.css'))
})

const host = 'localhost'
const port = 3000
app.listen(port, host, function () {
  console.log(`Serving on http://${host}:${port}`)
  process.send('online')
})
