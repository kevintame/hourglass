#!/usr/bin/env bash
set -Eeuo pipefail

# Backward-compatible entry point. The canonical Community Scripts-style
# container builder lives at ct/hourglass.sh.
source <(curl -fsSL https://raw.githubusercontent.com/kevintame/hourglass/main/ct/hourglass.sh)
