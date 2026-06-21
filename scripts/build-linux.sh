#!/usr/bin/env bash
set -e

OUT_DIR="dist-linux"
OUT_EXE="$OUT_DIR/hypermatch3d-linux"
SDL_PKG="node_modules/@kmamal/sdl"

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

echo "==> Copying node binary..."
cp "$(command -v node)" "$OUT_EXE"

echo "==> Injecting SEA blob..."
npx postject "$OUT_EXE" NODE_SEA_BLOB sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

chmod +x "$OUT_EXE"

echo "==> Copying @kmamal/sdl native module..."
mkdir -p "$OUT_DIR/$SDL_PKG"
cp -r "$SDL_PKG/dist"        "$OUT_DIR/$SDL_PKG/"
cp -r "$SDL_PKG/src"         "$OUT_DIR/$SDL_PKG/"
cp    "$SDL_PKG/package.json" "$OUT_DIR/$SDL_PKG/"

echo "==> Copying assets..."
cp -r assets "$OUT_DIR/"

echo "==> Done: $OUT_DIR/"
echo "    Distribute the entire $OUT_DIR/ folder."
