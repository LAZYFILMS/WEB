FILM STOCK IMAGES — drop your artwork here.
============================================

The game has two kinds of food:

  STATIONARY  — sits in a fixed cell waiting to be eaten. Classic snake food.
  MOVING (→)  — drifts in from a random edge and exits the other side.
                Catch it before it leaves.

The game looks for the filenames below. Any that exist will be used;
any that are missing render a clean labeled fallback canister so the
game always works even before you've uploaded artwork.

Recommended size: square PNG with transparency, 256×256 px or larger.
Drawn at ~28×28 px on screen, so keep the design simple and readable.


STATIONARY (the Lazy lineup):
-----------------------------
  lazy100.png           LAZY 100        — 1 point  · C-41
  lazy250.png           LAZY 250        — 2 points · C-41
  lazy500.png           LAZY 500        — 3 points · C-41
  lazymonochrome.png    LAZY MONO       — 2 points · B&W


MOVING (the exotics — drift across the frame, must be caught):
--------------------------------------------------------------
  lazyreversal.png      LAZY REVERSAL   — 5 points · E-6   · slow
  velvia.png            VELVIA          — 6 points · E-6   · fast
  provia.png            PROVIA          — 4 points · E-6
  tmax.png              TMAX            — 4 points · B&W
  portra400.png         PORTRA 400      — 5 points · C-41  · fastest


Editing the lineup
==================
Open /game/index.html and find the STOCKS array near the top of the
<script> block. Each entry is a single line:

  { id, name, points, color, img, weight, type, moving, speed }

  id      unique key (string, no spaces). Used internally only.
  name    display label (uppercase looks best).
  points  score awarded per exposure.
  color   hex color used for the snake-segment tint, fallback canister,
          and the moving-food halo.
  img     path to the image (relative to /game/).
  weight  relative spawn frequency (higher = more common).
  type    just a tag for your own reference (C-41, E-6, B&W, ECN-2…).
  moving  true → drifts across; false → sits still.
  speed   (moving stocks only) drift speed in cells per second.
          Examples: 1.4 = lazy slow, 2.0 = quick.

You can have any number of stationary or moving stocks — the game
adapts. To add an 11th stock, just add another entry to the array.

Difficulty tuning for moving food is in /game/index.html:
  MOVING_FOOD_SPEEDUP_PER_ROLL  multiplier added to drift speed per roll
  MOVING_FOOD_CATCH_RADIUS      how close the snake head must get (cells)


No data is collected. Refresh the page = a fresh game.
