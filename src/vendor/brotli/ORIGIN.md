# Brotli decoder

Source: https://github.com/google/brotli/blob/86ee1f65f62d6272345dee751d49e7d1f01c2b11/js/decode.js

Copyright 2017 Google Inc.; MIT license in LICENSE. The decoder is bundled locally;
it does not download code, use Node.js, or require WebAssembly.

Local changes: initialize the decoder lazily, and stop when decoded output exceeds
the caller's expected image size. The caller verifies the decoded length and SHA-256
before writing bundled starter images. Original cover rights remain unchanged.
