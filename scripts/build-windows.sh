#!/usr/bin/env bash
set -e

OUT_DIR="dist-windows"
OUT_EXE="$OUT_DIR/hypermatch3d-windows.exe"
SDL_PKG="node_modules/@kmamal/sdl"
SDL_VERSION=$(node -e "process.stdout.write(require('./$SDL_PKG/package.json').version)")
SDL_WIN_URL="https://github.com/kmamal/node-sdl/releases/download/v${SDL_VERSION}/sdl.node-v${SDL_VERSION}-win32-x64.tar.gz"
NODE_VERSION=$(node -e "process.stdout.write(process.version)")
NODE_ZIP="/tmp/node-win-x64.zip"
NODE_EXE_PATH="node-${NODE_VERSION}-win-x64/node.exe"

mkdir -p "$OUT_DIR"

echo "==> Bundling ESM to CJS..."
mkdir -p dist
npx esbuild index.js \
  --bundle \
  --platform=node \
  --format=cjs \
  --outfile=dist/bundle.cjs \
  --external:@kmamal/sdl \
  --banner:js="(function(require){" \
  --footer:js="})(require('module').createRequire(process.execPath));"

echo "==> Generating SEA blob..."
node --experimental-sea-config sea-config.json

echo "==> Downloading Windows node binary (${NODE_VERSION})..."
curl -fL -o "$NODE_ZIP" \
  "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip"

echo "==> Extracting node.exe..."
unzip -p "$NODE_ZIP" "$NODE_EXE_PATH" > "$OUT_EXE"
rm -f "$NODE_ZIP"

echo "==> Injecting SEA blob..."
npx postject "$OUT_EXE" NODE_SEA_BLOB sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  --overwrite

echo "==> Downloading Windows @kmamal/sdl native binary..."
curl -fL -o /tmp/sdl-win.tar.gz "$SDL_WIN_URL"
mkdir -p "$OUT_DIR/$SDL_PKG/dist"
tar -xzf /tmp/sdl-win.tar.gz -C "$OUT_DIR/$SDL_PKG/dist"
rm -f /tmp/sdl-win.tar.gz

echo "==> Copying @kmamal/sdl JavaScript sources..."
cp -r "$SDL_PKG/src"         "$OUT_DIR/$SDL_PKG/"
cp    "$SDL_PKG/package.json" "$OUT_DIR/$SDL_PKG/"

echo "==> Copying assets..."
cp -r assets "$OUT_DIR/"

echo "==> Done: $OUT_DIR/"
echo "    Distribute the entire $OUT_DIR/ folder."
