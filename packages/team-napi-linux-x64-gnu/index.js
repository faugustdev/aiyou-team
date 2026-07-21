'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BINARY_CANDIDATES = [
  path.join(__dirname, 'aiyou-team-napi.linux-x64-gnu.node'),
  path.join(__dirname, 'aiyou-team-napi.node'),
];

const binaryPath = BINARY_CANDIDATES.find((candidate) => fs.existsSync(candidate));

if (!binaryPath) {
  throw new Error(
    "Could not find @aiyou-dev/team-napi binary for linux-x64-gnu. " +
      "Expected one of: " +
      BINARY_CANDIDATES.join(', ') +
      ". Reinstall @aiyou-dev/team to recover the prebuilt binary."
  );
}

module.exports = require(binaryPath);
