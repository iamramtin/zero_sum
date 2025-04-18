#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status
set -o pipefail  # Catch errors in pipelines

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

RUST_VERSION="stable"  # Default Rust version
UPDATE_CARGO=false     # Default: don't update Cargo

# Save initial directory to return to later
ORIG_DIR=$(pwd)

# Parse arguments
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --update-cargo)
      UPDATE_CARGO=true
      ;;
    --rust-version)
      if [[ -z "$2" || "$2" == --* ]]; then
        log "Error: --rust-version requires a value."
        exit 1
      fi
      RUST_VERSION="$2"
      shift
      ;;
    *)
      log "Unknown parameter passed: $1"
      exit 1
      ;;
  esac
  shift
done

cd anchor || { log "Error: 'anchor' directory not found"; exit 1; }

log "Ensuring correct Rust version ($RUST_VERSION)..."
rustup override set "$RUST_VERSION" || { log "Failed to set Rust version"; exit 1; }

if [[ "$UPDATE_CARGO" == true ]]; then
  log "Removing Cargo.lock to regenerate it with current Rust version..."
  rm -f Cargo.lock
  cargo update
fi

log "Starting Anchor build process..."

anchor build || { log "Anchor build failed"; exit 1; }

SO_FILE="target/deploy/zero_sum.so"
DEST_DIR="tests/fixtures"

# Ensure DEST_DIR is a directory
if [[ -e "$DEST_DIR" && ! -d "$DEST_DIR" ]]; then
  log "Warning: $DEST_DIR exists and is not a directory. Removing it..."
  rm -f "$DEST_DIR"
fi

mkdir -p "$DEST_DIR"

if [[ -f "$SO_FILE" ]]; then
  log "Copying .so file to $DEST_DIR..."
  cp "$SO_FILE" "$DEST_DIR" || { log "Failed to copy .so file"; exit 1; }
  log "File copied successfully."
else
  log "Error: .so file not found at $SO_FILE"
  exit 1
fi

log "Build process completed successfully."

cd "$ORIG_DIR"
