# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

No hay build, linter, `package.json` ni suite de pruebas. La verificación es jugar en el navegador.

```bash
open index.html                  # abrir directamente
python3 -m http.server 8000      # o servidor estático en http://localhost:8000
```

## Arquitectura

Tetris en JS vanilla: `index.html` + `style.css` + `game.js` (script clásico con `'use strict'`, sin módulos ni dependencias). Toda la lógica está en `game.js`.

- **Estado global mutable** (`board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId`). `init()` lo reinicia todo y es también el handler del botón de reinicio.
- **Índice de color compartido**: el tablero es una matriz `ROWS×COLS` de `0` o 1–7, y ese mismo número es el valor dentro de las matrices de `PIECES` y el índice en `COLORS`. Añadir o cambiar una pieza exige mantener los tres alineados.
- **Flujo de bloqueo único**: `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. `spawn()` llama a `endGame()` si la pieza nueva colisiona al aparecer. La caída del `loop` (acumulador `dropAccum` vs `dropInterval`), `softDrop()` y `hardDrop()` terminan todos en `lockPiece()`.
- **Bucle**: `requestAnimationFrame` con `animId`. Pausa y fin de partida hacen `cancelAnimationFrame`; `togglePause` reinicia `lastTime` al reanudar para no acumular un `dt` enorme.
- **Nivel/velocidad** se recalculan dentro de `clearLines()` (no en el bucle).

## Acoplamiento HTML ↔ JS

- `game.js` obtiene elementos por ID fijo: `board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`. Renombrar uno en `index.html` rompe el juego al cargar.
- Si cambian `COLS`, `ROWS` o `BLOCK`, hay que ajustar `width`/`height` de `<canvas id="board">` en `index.html` (`COLS×BLOCK` × `ROWS×BLOCK`, hoy 300×600).
- `drawNext()` asume una rejilla de 4×4 bloques de 30 px en `#next-canvas` (120×120).

## Idioma

La UI (parcialmente: etiquetas como SCORE/LINES/LEVEL están en inglés) y el README están en español; los comentarios de `game.js` están en inglés.
