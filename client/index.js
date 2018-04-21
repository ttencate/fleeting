$('#start-button').click(function (e) {
  window.location = '/' + Math.round(Math.random() * Math.pow(2, 32)) + Math.round(Math.random() * Math.pow(2, 32))
  e.preventDefault();
})
