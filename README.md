# HyperMatch 3D

HyperMatch 3D game, is a manifold match 3 game, where you switch sphere positions so that a neighborhood of spheres are of the same color. Joining 3 spheres with the same color together will make them disappear. The goal of the game is to remove 10% of the spheres in the least time possible.

# Quick start

- Git clone the repo: `git clone git@github.com:pedroth/hyper-match-3d.git`
- Use `npm` or `bun` to install it: `npm i` or `bun install`.
- Run it with `node`: `node index.js`

# Controls and gameplay

- `left click` to select a sphere
- `right click` to move the camera

By selecting two adjacent spheres, you can swap them. If three or more spheres of the same color are connected, they will be removed from the mesh.

That's it! Have fun!

# Running using docker

Just need to run:
- `npm run build_docker`
- `npm run docker_run`

If you don't have `npm` installed, run docker commands directly:
- `docker build -t hypermatch3d .`
- `xhost + && sudo docker run --rm -v /tmp/.X11-unix:/tmp/.X11-unix:ro -e DISPLAY=$DISPLAY hypermatch3d`

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
- [ ] Create executable (not possible)
- [X] Create executable with [dockerc](https://github.com/NilsIrl/dockerc)
- [ ] Improve performance
- [ ] Select difficulty level (?)


# Status of project

Dedicated approximately 30 days to this. The demo is finished, you can run it using node. As of 2024, is not possible to create a single executable application(SEA) with node and [es6 imports](https://github.com/nodejs/single-executable/discussions/84).Also the software render is pretty slow, even when using multi-threading achieving a range of 3 to 8 fps. Hence I mostly given up on this now.

> For some reason, as of 2024, `bun` is not working properly.

## Creating an executable from docker

First you need to build the docker image using `npm run build_docker`, then run [`dockerc`](https://github.com/NilsIrl/dockerc):

- `sudo ~/<localization>/dockerc --image docker-daemon:hypermatch3d:latest --output hypermatch3d`

Then to run executable you need to pass some parameters:

`xhost + && sudo ./hypermatch3d -v /tmp/.X11-unix:/tmp/.X11-unix:ro -e DISPLAY=$DISPLAY`



