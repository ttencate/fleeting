function Runner(socket, playerId, state) {
  const canvas = $('#map')
  let canvasWidth = canvas.prop('width')
  let canvasHeight = canvas.prop('height')
  let tileOffsetX
  let tileOffsetY
  let tileStrideX
  let tileStrideY
  let tileWidth
  let tileHeight
  let selectedTile = null

  let commandQueue = []

  function askPlayerName(defaultName) {
    const name = window.prompt("What is your name?", defaultName) || defaultName
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
    const lineWidth = 6
    // https://www.redblobgames.com/grids/hexagons/
    const w = (canvasWidth - lineWidth) / (state.nx + 0.5)
    const h = canvasHeight / (0.25 + 0.75 * state.ny - 1)
    tileOffsetX = 0.5 * lineWidth + 0.5 * w
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

  function getTileCoords(mouseX, mouseY) {
    // Lame but works
    let minDist = 1e99
    let minCoords = null
    for (let y = 0; y < state.ny; y++) {
      for (let x = 0; x < state.nx; x++) {
        const center = tileCenter(x, y)
        const dx = center.x - mouseX
        const dy = center.y - mouseY
        const dist = dx * dx + dy * dy
        if (dist < minDist) {
          minDist = dist
          minCoords = { x, y }
        }
      }
    }
    return minCoords
  }

  function draw() {
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

    // Tile fills
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const type = grid[y][x].type
        ctx.fillStyle = colors[type]
        path(tileCenter(x, y))
        ctx.fill()
      }
    }

    // Tile outlines
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        path(tileCenter(x, y))
        ctx.stroke()
      }
    }

    // Bases
    Object.values(state.players).forEach(function (player) {
      player.bases.forEach(function (base) {
        const center = tileCenter(base.x, base.y)
        const cx = center.x
        const cy = center.y - 0.03 * tileHeight
        const sx = 0.2 * tileWidth
        const sy = 0.2 * tileHeight
        ctx.beginPath()
        ctx.moveTo(cx, cy - sy)
        ctx.lineTo(cx + sx, cy)
        ctx.lineTo(cx + sx, cy + sy)
        ctx.lineTo(cx - sx, cy + sy)
        ctx.lineTo(cx - sx, cy)
        ctx.closePath()
        if (base.isNew) {
          ctx.lineWidth = 4
          ctx.strokeStyle = player.color
          ctx.stroke()
        } else {
          ctx.fillStyle = player.color
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = 'black'
          ctx.stroke()
        }
      })
    })

    // Selection highlight and border
    if (selectedTile) {
      ctx.lineWidth = 6
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
      path(tileCenter(selectedTile.x, selectedTile.y))
      ctx.stroke()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.fill()
    }
  }

  $(window).on('resize', onResize)
  onResize()

  const chatLog = $('#chat-log')
  this.chat = function (chat) {
    let node
    if (chat.game) {
      node = $('<div class="game-message">').text('\u2b9e ' + chat.message)
    } else {
      const playerName = state.players[chat.playerId].name || playerId
      node = $('<div>').text(`${playerName}: ${chat.message}`)
    }
    chatLog.append(node)
    chatLog.prop('scrollTop', chatLog.prop('scrollHeight') - chatLog.height())
  }

  this.setState = function (s) {
    state = s
    window.state = s // For debugging
    applyCommands()
    updateAll()
  }

  function updateRankings() {
    let rankings = $('#rankings')
    rankings.empty()
    for (let player of Object.values(state.players)) {
      const ranking = $('<div>')
      ranking.append(player.done ? '\u2713 ' : '\u2026 ')
      ranking.append($('<span class="player-name">').text(player.name).css({ color: player.color }))
      if (player.id == playerId) {
        ranking.find('.player-name').addClass('my-player-name')
        ranking.append(' ')
        ranking.append('<a href="#">edit</a>').click(function (e) {
          askPlayerName(window.localStorage.playerName)
          socket.emit('rename', window.localStorage.playerName)
          e.preventDefault()
        })
      }
      rankings.append(ranking)
    }
  }

  function updateAll() {
    $('#year').text(state.year)
    $('#num-fish').text(state.totalFish)
    $('#cash').text(state.players[playerId].cash)
    draw()
    updateControls()
    updateRankings()
  }

  canvas.click(function (e) {
    e.preventDefault()
    if (!state) {
      return
    }
    const offset = $(this).offset()
    selectTile(getTileCoords(e.pageX - offset.left, e.clientY - offset.top))
  })

  function selectTile(coords) {
    selectedTile = coords
    draw()
    updateControls()
  }

  const tileInfo = $('#tile-info')
  const tileCoords = $('#tile-coords')
  function updateControls() {
    if (!selectedTile) {
      tileInfo[0].className = 'tile-none'
    } else {
      const tile = state.grid[selectedTile.y][selectedTile.x]
      const xName = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[selectedTile.x]
      const yName = '' + (selectedTile.y + 1)
      const clazz = tile.clazz
      tileInfo[0].className = `tile-${clazz}`
      tileCoords.text(`Tile ${xName}${yName}: ${clazz}`)
    }

    $('#end-turn').toggleClass('disabled', !!state.players[playerId].done)
  }

  function applyCommand(command) {
    if (command.type == 'buildBase') {
      state.players[playerId].bases.push({
        x: selectedTile.x,
        y: selectedTile.y,
        isNew: true
      })
      state.players[playerId].cash -= state.baseCost
    }
  }

  function applyCommands() {
    state.players[playerId].commands.forEach(applyCommand)
    commandQueue.forEach(applyCommand)
  }

  $('#build-base').click(function (e) {
    e.preventDefault()
    commandQueue.push({
      type: 'buildBase',
      x: selectedTile.x,
      y: selectedTile.y
    })
    applyCommands()
    updateAll()
  })

  $('#end-turn').click(function (e) {
    e.preventDefault()
    if (commandQueue.length == 0 && state.players[playerId].bases.length == 0) {
      window.alert('You should really build a base before ending your turn! Click a coastal tile, then click the "Build base" button.')
      return
    }
    socket.emit('commands', commandQueue)
    commandQueue = []
    state.players[playerId].done = true
    socket.emit('done')
    updateAll()
  })

  $('#chat-input').keypress(function (e) {
    if (e.which == 13) {
      socket.emit('chat', $(this).val())
      $(this).val('')
      e.preventDefault()
    }
  })
}

$(function () {
  if (!window.localStorage.playerId) {
    window.localStorage.playerId = '' + Math.round(Math.random() * Math.pow(2, 32)) + Math.round(Math.random() * Math.pow(2, 32))
  }
  const playerId = window.localStorage.playerId
  if (!window.localStorage.playerName) {
    askPlayerName('Anonymous' + Math.floor(Math.random() * 1000))
  }

  const socket = io()
  socket.emit('hello', playerId, window.localStorage.playerName)
  socket.emit('join', gameId)
  let runner
  socket.on('state', function (state) {
    if (!runner) {
      runner = new Runner(socket, playerId, state)
    } else {
      runner.setState(state)
    }
  })
  socket.on('chat', function (chat) {
    if (runner) {
      runner.chat(chat)
    }
  })
})
