#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status
set -o pipefail  # Catch errors in pipelines

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

cd "anchor"

log "Deploying Anchor program to localnet..."
anchor deploy --provider.cluster localnet || { log "Anchor deploy failed"; exit 1; }

log "Deploy process completed successfully."

cd -
