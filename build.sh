#!/usr/bin/env bash

set -ex

if [[ $ENV == dev* ]]; then
  tsc -w
else
  eslint 'src/**'
  tsc --incremental --tsBuildInfoFile build/.tsbuildinfo
  chmod +x build/main.js
fi
