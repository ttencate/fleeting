$(function () {
  if (!window.localStorage.playerId) {
    window.localStorage.playerId = '' + Math.round(Math.random() * Math.pow(2, 32)) + Math.round(Math.random() * Math.pow(2, 32))
  }
  const playerId = window.localStorage.playerId

  const socket = io()

  const chatLog = $('#chat-log')
  socket.on('chat', function (chat) {
    chatLog.append($('<div>').text(`${chat.playerId}: ${chat.message}`))
    chatLog.prop('scrollTop', chatLog.prop('scrollHeight') - chatLog.height())
  })

  let state = null
  socket.on('state', function (s) {
    state = s
    $('#num-fish').text(s.totalFish)
  })

  $('#chat-input').keypress(function (e) {
    if (e.which == 13) {
      socket.emit('chat', $(this).val())
      $(this).val('')
      e.preventDefault()
    }
  })

  socket.emit('hello', gameId, playerId)
})
