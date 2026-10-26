#!/usr/bin/env bash
# Fetches the two pinned dependencies into lib/. Used locally and in CI.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p lib
[ -d lib/openzeppelin-contracts ] || git clone -q --depth 1 --branch v5.1.0 https://github.com/OpenZeppelin/openzeppelin-contracts.git lib/openzeppelin-contracts
[ -d lib/forge-std ] || git clone -q --depth 1 https://github.com/foundry-rs/forge-std.git lib/forge-std
echo "deps ready"
