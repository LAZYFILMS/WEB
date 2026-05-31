DIGITAL CAMERA IMAGES — drop your artwork here.
================================================

These are the obstacles the snake must avoid. They float in from a
random edge and drift across the board. If the snake's head touches
one, the game ends.

Recommended size: square PNG with transparency, 256×256 px or larger.
Drawn at ~30×30 px on screen, so keep the silhouette readable.

Default filenames:
------------------
  cam1.png
  cam2.png
  cam3.png

The game randomly picks one of the loaded images each time a camera
spawns. Add more by extending the CAMERA_IMAGES array near the top of
the <script> block in /game/index.html.

If none of the images load, the game falls back to a drawn digital
camera icon (rounded body, lens, blinking flash).

Difficulty is tuned via CAMERAS_CFG in the same file:
    firstSpawnDelayMs       grace period before the first camera
    spawnIntervalStartMs    base time between spawns
    spawnIntervalMinMs      fastest spawn interval (caps difficulty)
    spawnSpeedupPerRoll     how much the interval shrinks per completed roll
    initialMax              cameras allowed on screen at game start
    extraPerRoll            extra concurrent cameras per completed roll
    maxConcurrentCap        absolute max cameras on screen
    speedMin / speedMax     camera drift speed range (cells per second)
    speedScalePerRoll       speed multiplier added per completed roll
    collisionRadius         how close the snake head must get for a hit

No data is collected. Refresh the page = a fresh game.
