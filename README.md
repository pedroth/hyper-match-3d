# HyperMatch 3D

HyperMatch 3D game, is a manifold match 3 game, where you switch sphere positions so that a neighborhood of spheres are of the same color. Joining 3 spheres with the same color together will make them disappear. The goal of the game is to remove 10% of the spheres in the least time possible.   

# Credits

- Sound by <a href="https://pixabay.com/users/soundsforyou-4861230/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=111405">Mikhail</a> from <a href="https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=111405">Pixabay</a>
- Background image from: [texturify](https://texturify.com/stock-photo/green-park-bushes-10152.html)
- Mesh from: [Simplified Stanford bunny](https://graphics.stanford.edu/data/3Dscanrep/) using [myminifactory](https://myminifactory.github.io/Fast-Quadric-Mesh-Simplification/)

# Dependencies

- [SLD bindings for node.js](https://github.com/kmamal/node-sdl)

# TODOs

- [ ] No bugs
- [X] Select shader
- [ ] Create web version
- [ ] Better network generation
- [-] Create executable (not possible)
- [ ] Improve performance
- [ ] Select difficulty level (?)


# Status of project

Dedicated approximately 30 days to this. The demo is finished, you can run it using node:

Clone project and install dependencies:
`bun install` or `npm install`.

Run it:
`node index.js`. As of 2024, `bun` is not working properly.

## Major problems

- As of 2024, is not possible to create a single executable application(SEA) with node and [es6 imports](https://github.com/nodejs/single-executable/discussions/84)

- Also the software render is pretty slow, even when using multi-threading achieving a range of 3 to 8 fps.

