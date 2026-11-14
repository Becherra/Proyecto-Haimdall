# ParticleWorld preview

Open `http://localhost:3000/?particles=1` to compare the static particle rendering. The flag is read in the browser; without it, the normal Blue Marble globe stays active.

| Profile | Land triangles | Ocean and edge points | Ambient triangles |
| --- | ---: | ---: | ---: |
| Desktop (768 px and wider) | 3,500 | 9,000 | 16 |
| Mobile (under 768 px) | 1,500 | 4,000 | 16 |

The preview reports the active particle counts and the measured frames per second. FPS is the average number of animation frames rendered in the preceding one second, so it varies with the device and browser. The scene uses one `THREE.Points` object per layer and a 1.5 maximum device pixel ratio; the slow rotation is the only motion in this phase.

The land mask is sampled from the same-origin, self-hosted 2K NASA Blue Marble texture. If it cannot be loaded or read, all Fibonacci samples are treated as land so the preview still renders. Source palette clusters target approximately 45% amber, 30% violet, 15% teal, and 10% white; land-only filtering and spatial clustering can shift the observed proportions slightly.
