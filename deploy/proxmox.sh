#!/usr/bin/env bash
set -Eeo pipefail
set +u

# Backward-compatible entry point. The canonical Community Scripts-style
# container builder lives at ct/hourglass.sh.
source <(curl -fsSL https://raw.githubusercontent.com/kevintame/hourglass/refs/heads/main/ct/hourglass.sh)
