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
  let dispatchingBaseIndex = -1
  let dispatchingBoatIndex = -1

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
    drawMap()
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

  function drawMap() {
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

    // Selection highlight and border
    if (selectedTile) {
      ctx.lineWidth = 6
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
      path(tileCenter(selectedTile.x, selectedTile.y))
      ctx.stroke()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.fill()
    }

    // Fish counts
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const tile = grid[y][x]
        if (typeof tile.fish == 'number' && tile.clazz == 'water') {
          const center = tileCenter(x, y)
          ctx.font = 'bold ' + (0.8 * tileHeight * (0.4 + 0.6 * tile.fish / state.maxFishPerTile)) + 'px Montserrat, Arial, sans-serif'
          ctx.fillText(tile.fish, center.x, center.y + 0.01 * tileHeight)
        }
      }
    }

    Object.values(state.players).forEach(function (player) {
      // Bases
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

        // Boats
        base.boats.forEach(function (boat) {

          function path(x, y) {
            const center = tileCenter(x, y)
            const cx = center.x
            const cy = center.y + 0.03 * tileHeight
            const sx = 0.3 * tileWidth
            const sy = 0.15 * tileHeight
            ctx.beginPath()
            ctx.moveTo(cx + sx, cy)
            ctx.lineTo(cx + sx - sy, cy + sy)
            ctx.lineTo(cx - sx + sy, cy + sy)
            ctx.lineTo(cx - sx, cy)
            ctx.closePath()
          }

          if (typeof boat.lastX === 'number') {
            path(boat.lastX, boat.lastY)
            ctx.lineWidth = 2
            ctx.strokeStyle = player.color
            ctx.stroke()
          }

          if (boat.dispatched) {
            path(boat.x, boat.y)
            ctx.fillStyle = player.color
            ctx.fill()
            ctx.lineWidth = 2
            ctx.strokeStyle = 'black'
            ctx.stroke()
          }
        })
      })
    })
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
      node = $('<div>')
        .append($('<span class="player-name">').text(playerName).css({ color: state.players[chat.playerId].color }))
        .append(': ')
        .append(chat.message)
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

    $('#base-cost').text(state.baseCost)
    $('#boat-cost').text(state.boatCost)

    drawMap()
    updateControls()
    updateRankings()
  }

  canvas.click(function (e) {
    e.preventDefault()
    if (!state) {
      return
    }
    const offset = $(this).offset()
    const coords = getTileCoords(e.pageX - offset.left, e.clientY - offset.top)
    if (dispatchingBaseIndex >= 0 && dispatchingBoatIndex >= 0) {
      dispatchBoat(coords.x, coords.y)
    } else {
      selectTile(coords)
    }
  })

  function selectTile(coords) {
    selectedTile = coords
    dispatchingBaseIndex = -1
    dispatchingBoatIndex = -1
    drawMap()
    updateControls()
  }

  function selectedBaseIndex() {
    if (!selectedTile) {
      return -1
    }
    const player = this.state.players[playerId]
    for (let i = 0; i < player.bases.length; i++) {
      const base = player.bases[i]
      if (!base.isNew && base.x == selectedTile.x && base.y == selectedTile.y) {
        return i
      }
    }
    return -1
  }

  const tileInfo = $('#tile-info')
  const tileCoords = $('#tile-coords')
  function updateControls() {
    let tile = null
    if (!selectedTile) {
      tileInfo[0].className = 'tile-none'
    } else {
      tile = state.grid[selectedTile.y][selectedTile.x]
      const xName = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[selectedTile.x]
      const yName = '' + (selectedTile.y + 1)
      const clazz = tile.clazz
      tileInfo[0].className = `tile-${clazz}`
      tileCoords.text(`Tile ${xName}${yName}: ${clazz}`)
    }

    const baseIndex = selectedBaseIndex()
    $('#build-base').toggleClass('disabled', !!(state.players[playerId].cash < state.baseCost || !tile || tile.clazz != 'coast' || tile.hasBase || baseIndex >= 0))
    $('#build-base').toggle(baseIndex < 0)
    $('#base-controls').toggle(baseIndex >= 0)
    $('#boats').empty()
    if (baseIndex >= 0) {
      const boats = state.players[playerId].bases[baseIndex].boats
      boats.forEach(function (boat, i) {
        const node = $('<div>')
          .append(`Boat ${i + 1}`)
          .append($('<a class="button dispatch-boat">')
            .text('Dispatch')
            .toggleClass('disabled', !!boat.dispatched)
            .attr('data-base-index', baseIndex)
            .attr('data-boat-index', i))
        $('#boats').append(node)
      })
    }
    $('#buy-boat').toggleClass('disabled', state.players[playerId].cash < state.boatCost)

    $('#end-turn').toggleClass('disabled', !!state.players[playerId].done)
  }

  function applyCommand(command) {
    if (command.type == 'buildBase') {
      state.players[playerId].bases.push({
        x: selectedTile.x,
        y: selectedTile.y,
        boats: [],
        isNew: true
      })
      state.players[playerId].cash -= state.baseCost
    } else if (command.type == 'dispatchBoat') {
      const boat = state.players[playerId].bases[command.baseIndex].boats[command.boatIndex]
      boat.x = command.x
      boat.y = command.y
      boat.dispatched = true
    }
  }

  function applyCommands() {
    state.players[playerId].commands.forEach(applyCommand)
    commandQueue.forEach(applyCommand)
  }

  $('#build-base').click(function (e) {
    e.preventDefault()
    if ($(this).hasClass('disabled')) {
      return
    }
    const command = {
      type: 'buildBase',
      x: selectedTile.x,
      y: selectedTile.y
    }
    commandQueue.push(command)
    applyCommand(command)
    updateAll()
  })

  $(document).on('click', '.dispatch-boat', function (e) {
    e.preventDefault()
    if ($(this).hasClass('disabled')) {
      return
    }
    dispatchingBaseIndex = $(this).attr('data-base-index')
    dispatchingBoatIndex = $(this).attr('data-boat-index')
  })

  function dispatchBoat(x, y) {
    if (dispatchingBaseIndex < 0 || dispatchingBoatIndex < 0) {
      return
    }
    const command = {
      type: 'dispatchBoat',
      baseIndex: dispatchingBaseIndex,
      boatIndex: dispatchingBoatIndex,
      x: x,
      y: y
    }
    dispatchingBaseIndex = -1
    dispatchingBoatIndex = -1
    commandQueue.push(command)
    applyCommand(command)
    updateAll()
  }

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
