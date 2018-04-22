class Renderer {
  constructor(game, canvas) {
    this.game = game
    this.canvas = canvas
    this.selectedTile = null
    this.dispatching = null
  }

  resize(width, height) {
    this.canvasWidth = width
    this.canvasHeight = height
    this.canvas.prop('width', width)
    this.canvas.prop('height', height)
    this.render()
  }

  updateGeometry() {
    const state = this.game.state
    const lineWidth = 6
    // https://www.redblobgames.com/grids/hexagons/
    const w = (this.canvasWidth - lineWidth) / (state.nx + 0.5)
    const h = this.canvasHeight / (0.25 + 0.75 * state.ny - 1)
    this.tileOffsetX = 0.5 * lineWidth + 0.5 * w
    this.tileOffsetY = 0 // 0.5 * h
    this.tileStrideX = w
    this.tileStrideY = 0.75 * h
    this.tileWidth = w
    this.tileHeight = h
  }

  tileCenter(x, y) {
    return {
      x: this.tileOffsetX + (x + (y%2 ? 0.5 : 0)) * this.tileStrideX,
      y: this.tileOffsetY + y * this.tileStrideY
    }
  }

  getTileCoords(mouseX, mouseY) {
    const state = this.game.state
    // Lame but works
    let minDist = 1e99
    let minCoords = null
    for (let y = 0; y < state.ny; y++) {
      for (let x = 0; x < state.nx; x++) {
        const center = this.tileCenter(x, y)
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

  render() {
    this.updateGeometry()
    const state = this.game.state
    const nx = state.nx
    const ny = state.ny
    const grid = state.grid
    const dispatching = this.dispatching

    const ctx = this.canvas[0].getContext('2d')

    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)

    const colors = {
      ice: '#eceff1', // Blue Grey 50
      grass: '#aed581', // Light Green 300
      desert: '#ffe082', // Amber 200
      water: '#4fc3f7' // Light Blue 300
    }
    const path = (center) => {
      const w = 0.5 * this.tileWidth
      const h = 0.5 * this.tileHeight
      ctx.beginPath()
      ctx.moveTo(center.x, center.y - h)
      ctx.lineTo(center.x + w, center.y - 0.5 * h)
      ctx.lineTo(center.x + w, center.y + 0.5 * h)
      ctx.lineTo(center.x, center.y + h)
      ctx.lineTo(center.x - w, center.y + 0.5 * h)
      ctx.lineTo(center.x - w, center.y - 0.5 * h)
      ctx.closePath()
    }

    // Tile fills
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const type = grid[y][x].type
        ctx.fillStyle = colors[type]
        path(this.tileCenter(x, y))
        ctx.fill()

        // Dispatch range
        if (dispatching && !this.game.canDispatchBoat(this.game.playerId, dispatching.baseIndex, dispatching.boatIndex, x, y)) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
          ctx.fill()
        }
      }
    }

    // Tile outlines
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        path(this.tileCenter(x, y))
        ctx.stroke()
      }
    }

    // Selection highlight and border
    if (this.selectedTile) {
      ctx.lineWidth = 6
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
      path(this.tileCenter(this.selectedTile.x, this.selectedTile.y))
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
        if (tile.clazz != 'water') {
          continue
        }
        let fish = null
        if (typeof tile.fish == 'number') {
          fish = tile.fish
        } else if (typeof tile.prevFish == 'number') {
          fish = tile.prevFish
        }
        if (fish !== null) {
          const center = this.tileCenter(x, y)
          ctx.font = 'bold ' + (0.8 * this.tileHeight * (0.4 + 0.6 * fish / state.maxFishPerTile)) + 'px Montserrat, Arial, sans-serif'
          ctx.fillText(fish, center.x, center.y + 0.01 * this.tileHeight)
        }
      }
    }

    const boatOffsets = {}

    Object.values(state.players).forEach((player) => {
      // Bases
      player.bases.forEach((base) => {
        const center = this.tileCenter(base.x, base.y)
        const cx = center.x
        const cy = center.y - 0.03 * this.tileHeight
        const sx = 0.2 * this.tileWidth
        const sy = 0.2 * this.tileHeight
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
        base.boats.forEach((boat) => {
          const key = `${boat.lastX},${boat.lastY}`
          const offset = boatOffsets[key] || 0
          const ox = 0.05 * offset * this.tileWidth
          const oy = 0.05 * offset * this.tileHeight

          const path = (x, y) => {
            const center = this.tileCenter(x, y)
            const cx = center.x + ox
            const cy = center.y + 0.15 * this.tileHeight + oy
            const sx = 0.4 * this.tileWidth
            const sy = 0.15 * this.tileHeight
            ctx.beginPath()
            ctx.moveTo(cx + sx, cy)
            ctx.lineTo(cx + sx - sy, cy + sy)
            ctx.lineTo(cx - sx + sy, cy + sy)
            ctx.lineTo(cx - sx, cy)
            ctx.closePath()
          }

          if (typeof boat.lastX === 'number') {
            path(boat.lastX, boat.lastY)
            ctx.fillStyle = player.color
            ctx.fill()
            ctx.lineWidth = 2
            ctx.strokeStyle = 'black'
            ctx.stroke()

            const center = this.tileCenter(boat.lastX, boat.lastY)
            center.x += ox
            center.y += oy
            ctx.font = 'bold ' + (0.3 * this.tileHeight) + 'px Montserrat, Arial, sans-serif'
            ctx.fillStyle = 'white'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('-' + boat.fishCaught, center.x, center.y - 0.3 * this.tileHeight)

            const cashText = '$' + (boat.fishCaught * state.cashPerFish)
            ctx.lineWidth = 3
            ctx.strokeStyle = 'black'
            ctx.strokeText(cashText, center.x, center.y + 0.25 * this.tileHeight)
            ctx.fillStyle = player.color
            ctx.fillText(cashText, center.x, center.y + 0.25 * this.tileHeight)

            boatOffsets[key] = offset + 1
          }
        })
      })
    })

    // Dispatched boats
    Object.values(state.players).forEach((player) => {
      player.bases.forEach((base) => {
        base.boats.forEach((boat) => {
          if (boat.dispatched) {
            const path = (x, y) => {
              const center = this.tileCenter(x, y)
              const cx = center.x
              const cy = center.y + 0.15 * this.tileHeight
              const sx = 0.4 * this.tileWidth
              const sy = 0.15 * this.tileHeight
              ctx.beginPath()
              ctx.moveTo(cx + sx, cy)
              ctx.lineTo(cx + sx - sy, cy + sy)
              ctx.lineTo(cx - sx + sy, cy + sy)
              ctx.lineTo(cx - sx, cy)
              ctx.closePath()
            }
            path(boat.x, boat.y)
            ctx.lineWidth = 2
            ctx.strokeStyle = player.color
            ctx.stroke()

            const basePos = this.tileCenter(base.x, base.y)
            const boatPos = this.tileCenter(boat.x, boat.y)
            const dx = boatPos.x - basePos.x
            const dy = boatPos.y - basePos.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const angle = Math.atan2(dy, dx)
            ctx.save()
            ctx.translate(basePos.x, basePos.y)
            ctx.rotate(angle)
            const shorten = 0.3 * this.tileWidth
            const headSize = 0.2 * this.tileWidth
            const arrowPath = () => {
              ctx.beginPath()
              ctx.moveTo(shorten, 0)
              ctx.lineTo(dist - shorten, 0)
              ctx.stroke()
              ctx.beginPath()
              ctx.moveTo(dist - shorten, 0)
              ctx.lineTo(dist - shorten - headSize, -0.66 * headSize)
              ctx.stroke()
              ctx.beginPath()
              ctx.moveTo(dist - shorten, 0)
              ctx.lineTo(dist - shorten - headSize, 0.66 * headSize)
              ctx.stroke()
            }
            ctx.lineWidth = 3
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
            ctx.lineCap = 'round'
            arrowPath()
            ctx.lineWidth = 1
            ctx.strokeStyle = player.color
            ctx.lineCap = 'butt'
            arrowPath()
            ctx.restore()
          }
        })
      })
    })
  }
}
