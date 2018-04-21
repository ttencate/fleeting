$(function () {
  let state = null

  const canvas = $('#map')
  let canvasWidth = canvas.prop('width')
  let canvasHeight = canvas.prop('height')
  let tileOffsetX
  let tileOffsetY
  let tileStrideX
  let tileStrideY
  let tileWidth
  let tileHeight

  function askPlayerName(defaultName) {
    const name = window.prompt("What is your name?") || defaultName
    window.localStorage.playerName = name
    return name
  }

  function onResize() {
    const mapBox = $('#map-box')
    canvasWidth = mapBox.width()
    canvasHeight = mapBox.height()
    canvas.prop('width', canvasWidth)
    canvas.prop('height', canvasHeight)
    draw()
  }

  function updateGeometry() {
    // https://www.redblobgames.com/grids/hexagons/
    const w = canvasWidth / (state.nx + 0.5)
    const h = canvasHeight / (0.25 + 0.75 * state.ny - 1)
    tileOffsetX = 0.5 * w
    tileOffsetY = 0 // 0.5 * h
    tileStrideX = w
    tileStrideY = 0.75 * h
    tileWidth = w
    tileHeight = h
  }

  function tileCenter(x, y) {
    return {
      x: tileOffsetX + (x + (y%2 ? 0.5 : 0)) * tileStrideX,
      y: tileOffsetY + y * tileStrideY
    }
  }

  function draw() {
    if (!state) {
      return
    }
    updateGeometry()
    const nx = state.nx
    const ny = state.ny
    const grid = state.grid

    const ctx = canvas[0].getContext('2d')

    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    const colors = {
      ice: '#f8f8ff',
      grass: '#6d4',
      desert: '#eb5',
      water: '#37d'
    }
    function path(center) {
      ctx.beginPath()
      ctx.moveTo(center.x, center.y - 0.5 * tileHeight)
      ctx.lineTo(center.x + 0.5 * tileWidth, center.y - 0.25 * tileHeight)
      ctx.lineTo(center.x + 0.5 * tileWidth, center.y + 0.25 * tileHeight)
      ctx.lineTo(center.x, center.y + 0.5 * tileHeight)
      ctx.lineTo(center.x - 0.5 * tileWidth, center.y + 0.25 * tileHeight)
      ctx.lineTo(center.x - 0.5 * tileWidth, center.y - 0.25 * tileHeight)
      ctx.closePath()
    }
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const type = grid[y][x].type
        ctx.fillStyle = colors[type]
        path(tileCenter(x, y))
        ctx.fill()
      }
    }
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        path(tileCenter(x, y))
        ctx.stroke()
      }
    }
  }

  $(window).on('resize', onResize)
  onResize()

  if (!window.localStorage.playerId) {
    window.localStorage.playerId = '' + Math.round(Math.random() * Math.pow(2, 32)) + Math.round(Math.random() * Math.pow(2, 32))
  }
  const playerId = window.localStorage.playerId
  if (!window.localStorage.playerName) {
    askPlayerName('Anonymous' + Math.floor(Math.random() * 1000))
  }

  const socket = io()

  const chatLog = $('#chat-log')
  socket.on('chat', function (chat) {
    const playerName = state.players[chat.playerId].name || playerId
    chatLog.append($('<div>').text(`${playerName}: ${chat.message}`))
    chatLog.prop('scrollTop', chatLog.prop('scrollHeight') - chatLog.height())
  })

  socket.on('state', function (s) {
    state = s
    window.state = s // For debugging
    $('#num-fish').text(s.totalFish)

    let rankings = $('#rankings')
    rankings.empty()
    for (let player of Object.values(state.players)) {
      const ranking = $('<div>').text(player.name)
      if (player.id == playerId) {
        ranking.append(' ')
        ranking.append('<a href="#">edit</a>').click(function (e) {
          askPlayerName(window.localStorage.playerName)
          socket.emit('rename', window.localStorage.playerName)
          e.preventDefault()
        })
      }
      rankings.append(ranking)
    }

    draw(state.nx, state.ny, state.grid)
  })

  $('#chat-input').keypress(function (e) {
    if (e.which == 13) {
      socket.emit('chat', $(this).val())
      $(this).val('')
      e.preventDefault()
    }
  })

  socket.emit('hello', playerId, window.localStorage.playerName)
  socket.emit('join', gameId)
})
