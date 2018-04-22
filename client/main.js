function Runner(socket, playerId, initialState) {
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
  let dispatching = null

  const game = new ClientGame(playerId, initialState)
  const renderer = new Renderer(game, canvas)

  function onResize() {
    const mapBox = $('#map-box')
    renderer.resize(mapBox.width(), mapBox.height())
  }

  function playerNameNode(playerId) {
    return $('<span class="player-name">')
      .text(game.getPlayerName(playerId))
      .css({ color: game.getPlayerColor(playerId) })
      .toggleClass('my-player-name', playerId == game.playerId)
  }

  function setDispatching(d) {
    dispatching = d
    renderer.dispatching = d
    renderer.render()
  }

  $(window).on('resize', onResize)
  onResize()

  const chatLog = $('#chat-log')
  this.chat = function (chat) {
    let node
    if (chat.game) {
      node = $('<div class="game-message">').text('\u2b9e ' + chat.message)
    } else {
      node = $('<div>')
        .append(playerNameNode(chat.playerId))
        .append(': ')
        .append(chat.message)
    }
    chatLog.append(node)
    chatLog.prop('scrollTop', chatLog.prop('scrollHeight') - chatLog.height())
  }

  this.setState = function (s) {
    window.state = s // For debugging
    game.setState(s)
    updateAll()
  }

  function updateRankings() {
    let rankings = $('#rankings')
    rankings.empty()
    for (let player of game.getRankedPlayers()) {
      const ranking = $('<div class="player-ranking">')
      ranking.append($('<span class="player-ranking-done">').text(player.done ? '\u2611' : '\u2610'))
      ranking.append($('<span class="player-ranking-name">').append(playerNameNode(player.id)))
      if (player.id == game.playerId) {
        ranking.find('.player-name')
          .addClass('my-player-name')
          .append(' ')
          .append('<a href="#">edit</a>').click(function (e) {
            askPlayerName()
            socket.emit('rename', getPlayerName())
            e.preventDefault()
          })
      }
      ranking.append($('<span class="player-ranking-cash">').text('$' + player.cash))
      rankings.append(ranking)
    }
  }

  function updateAll() {
    $('#year').text(game.state.year)
    $('#num-fish').text(game.state.totalFish)
    $('#cash').text(game.me().cash)

    $('#base-cost').text(game.state.baseCost)
    $('#boat-cost').text(game.state.boatCost)

    renderer.render()
    updateControls()
    updateRankings()
  }

  // mousedown gets right click, click does not.
  canvas.mousedown(function (e) {
    const offset = $(this).offset()
    const coords = renderer.getTileCoords(e.pageX - offset.left, e.clientY - offset.top)

    if (e.which == 1) { // Left
      e.preventDefault()
      if (dispatching) {
        game.dispatchBoat(dispatching.baseIndex, dispatching.boatIndex, coords.x, coords.y)
        setDispatching(null)
        updateAll()
      } else {
        selectTile(coords)
      }
    } else if (e.which == 3) { // Right
      e.preventDefault()
      setDispatching(null)
      if (selectedTile) {
        const baseIndex = game.getBaseIndexAt(selectedTile)
        const boatIndex = game.getUndispatchedBoatIndex(baseIndex)
        if (baseIndex >= 0 && boatIndex >= 0) {
          game.dispatchBoat(baseIndex, boatIndex, coords.x, coords.y)
          updateAll()
        }
      }
    }
  })

  canvas.on('contextmenu', function (e) { e.preventDefault() })

  function selectTile(coords) {
    selectedTile = coords
    renderer.selectedTile = coords
    setDispatching(null)

    renderer.render()
    updateControls()
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

    $('#base-details').empty()
    if (tile && tile.hasBase) {
      $('#base-details')
        .append('Base owned by ')
        .append(playerNameNode(tile.baseOwner))
    }

    const baseIndex = game.getBaseIndexAt(selectedTile)
    $('#build-base').toggleClass('disabled', !!selectedTile && !game.canBuildBase(game.playerId, selectedTile.x, selectedTile.y))
    $('#build-base').toggle(!!selectedTile && tile.clazz == 'coast' && !tile.hasBase)
    $('#base-controls').toggle(baseIndex >= 0)
    $('#boats').empty()
    if (baseIndex >= 0) {
      const boats = game.me().bases[baseIndex].boats
      boats.forEach(function (boat, i) {
        const node = $('<div>')
          // .append(`Boat ${i + 1}`)
          .append($('<a class="button dispatch-boat">')
            .text('Dispatch fleet')
            .toggleClass('disabled', !!boat.dispatched)
            .attr('data-base-index', baseIndex)
            .attr('data-boat-index', i))
        $('#boats').append(node)
      })
    }
    // $('#buy-boat').toggleClass('disabled', game.me().cash < state.boatCost)

    $('#end-turn').toggleClass('disabled', !!game.me().done)
  }

  $('#build-base').click(function (e) {
    e.preventDefault()
    if ($(this).hasClass('disabled')) {
      return
    }
    game.buildBase(selectedTile.x, selectedTile.y)
    updateAll()
  })

  $(document).on('click', '.dispatch-boat', function (e) {
    e.preventDefault()
    if ($(this).hasClass('disabled')) {
      return
    }
    if (dispatching) {
      setDispatching(null)
    } else {
      setDispatching({
        baseIndex: parseInt($(this).attr('data-base-index')),
        boatIndex: parseInt($(this).attr('data-boat-index'))
      })
    }
  })

  $('#end-turn').click(function (e) {
    e.preventDefault()
    if (!game.hasBase()) {
      window.alert('You should really build a base before ending your turn! Click a coastal tile, then click the "Build base" button.')
      return
    }
    socket.emit('commands', game.commandQueue)
    game.commandQueue = []
    game.me().done = true
    socket.emit('done')
    updateAll()
  })

  $('#chat-log').click(function (e) {
    e.preventDefault()
    $('#chat-input').focus()
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

  const socket = io()
  socket.emit('hello', playerId, getPlayerName())
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