# Scrub

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)

**Strip hidden metadata from your images — locally, and losslessly.**

Scrub is a tiny macOS app that strips the hidden metadata baked into image files —
the **GPS coordinates** of where a photo was taken, your device make and model, the
exact timestamp, and editing history — so you can share pictures without quietly
handing all of that over.

Drag an image in, see exactly what's embedded, then remove it with one click. It works
**losslessly**: the pixels and color profile come out untouched — no re-compression,
no quality loss — unlike "export" or screenshot tricks that silently degrade the image.

> ⚠️ **Status:** v0.1, early but working. macOS-focused. JPEG and PNG today; see the roadmap below.

![Scrub detecting the hidden IPTC and Adobe XMP metadata embedded in a PNG](docs/screenshot.png)

<sub><i>Scrub showing the hidden IPTC + XMP metadata inside a PNG — one click strips it, losslessly, into a clean copy.</i></sub>

## Why it's different: lossless by design

Most "strip metadata" tricks re-encode the image (e.g. redrawing it onto a canvas).
That silently **recompresses your photo and throws away quality** every time.

Scrub doesn't decode the pixels at all. It parses the file's container —
JPEG marker segments and PNG chunks — and removes **only** the metadata blocks,
copying everything else through byte-for-byte:

- ✅ Removed: EXIF (incl. GPS), XMP, IPTC, comments, PNG text chunks, timestamps
- ✅ Kept untouched: the image data and the **ICC color profile** (so colors don't shift)

The pixels you get out are bit-identical to the pixels you put in. No generational loss.

## Features

- **Drag & drop** one or many images
- **See before you strip** — a clear readout of what's embedded, including a
  📍 GPS warning with the actual coordinates
- **Lossless removal** — no re-encoding, color profile preserved
- **Safe by default** — writes a `name-clean.jpg` copy and leaves your original
  alone (optional "overwrite" toggle)
- **Reveal in Finder** when done
- **100% local** — nothing ever leaves your machine. No network, no telemetry,
  no accounts.

## Supported formats

| Format | Status |
| ------ | ------ |
| JPEG   | ✅ |
| PNG    | ✅ |
| WebP   | 🔜 planned |
| HEIC   | 🔜 planned |
| TIFF   | 🔜 planned |

## Install / run from source

Prerequisites: [Node.js](https://nodejs.org) 18+ and the
[Rust toolchain](https://www.rust-lang.org/tools/install) (Tauri's requirements
are listed [here](https://tauri.app/start/prerequisites/)).

```bash
git clone https://github.com/growthforging/scrub.git
cd scrub
npm install

# run in development
npm run tauri dev

# build a distributable .app / .dmg
npm run tauri build
```

## How to confirm it worked

After scrubbing, Scrub reports `removed N KB` and the file shows no metadata.
You can double-check with standard tools:

```bash
# should print little to nothing for the cleaned file
exiftool image-clean.jpg
mdls image-clean.jpg | grep -i gps
```

## Tech

- [Tauri v2](https://tauri.app) — tiny, fast native shell (Rust)
- [React](https://react.dev) + TypeScript + [Vite](https://vite.dev) — UI
- [`kamadak-exif`](https://crates.io/crates/kamadak-exif) — decoding EXIF for the "before" view
- Hand-written JPEG/PNG container parsing for the lossless strip (`src-tauri/src/strip.rs`),
  covered by unit tests

## License

[MIT](LICENSE)
