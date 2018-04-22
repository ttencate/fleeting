function askPlayerName(defaultName) {
  defaultName = defaultName || window.localStorage.playerName
  const name = window.prompt("What is your name?", defaultName) || defaultName
  window.localStorage.playerName = name
  return name
}

function getPlayerName() {
  if (!window.localStorage.playerName) {
    askPlayerName('Anonymous' + Math.floor(Math.random() * 1000))
  }
  return window.localStorage.playerName
}

$(function () {
  $(window).on('resize', function () {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var aspect = 16 / 9;
    if (w / h > aspect) {
      w = h * aspect;
    } else {
      h = w / aspect;
    }
    w = Math.floor(w);
    h = Math.floor(h);
    $(document.documentElement).css('font-size', w / 100 + 'px');
  })
  $(window).trigger('resize');
})
