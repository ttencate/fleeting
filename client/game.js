function askPlayerName(defaultName) {
  const name = window.prompt("What is your name?") || defaultName
  window.localStorage.playerName = name
  return name
}

function onResize() {
  const mapBox = $('#map-box')
  const canvas = $('#map')
  canvas.prop('width', mapBox.width())
  canvas.prop('height', mapBox.height())
}

$(function () {
  $(window).on('resize', onResize)
  onResize()

  if (!window.localStorage.playerId) {
    window.localStorage.playerId = '' + Math.round(Math.random() * Math.pow(2, 32)) + Math.round(Math.random() * Math.pow(2, 32))
  }
  const playerId = window.localStorage.playerId
  if (!window.localStorage.playerName) {
    askPlayerName('Anonymous' + Math.floor(Math.random() * 1000))
  }

  let state = null

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
