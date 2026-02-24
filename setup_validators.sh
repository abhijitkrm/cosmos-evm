#!/bin/bash

# Setup 3 validators in .testnets/node0, node1, node2
# Each validator gets its own keys and configuration

set -e

EVINIT_BIN="${EVINIT_BIN:-evmd}"
CHAINID="${CHAIN_ID:-9001}"
KEYRING="test"
KEYALGO="eth_secp256k1"
LOGLEVEL="info"
BASEFEE="10000000"

# Base directory for testnet validators
TESTNET_DIR=".testnets"
NUM_VALIDATORS=3

echo "🔑 Setting up $NUM_VALIDATORS validators in $TESTNET_DIR/"

# Create gentxs directory
mkdir -p "$TESTNET_DIR/gentxs"

# Function to setup a single validator
setup_validator() {
  local node_id=$1
  local moniker="validator$node_id"
  local node_dir="$TESTNET_DIR/node$node_id"
  local evmd_home="$node_dir/evmd"
  
  echo "📦 Setting up Validator $node_id ($moniker)"
  
  # Create directory structure
  mkdir -p "$evmd_home/config"
  mkdir -p "$evmd_home/data"
  
  # Initialize the node using evmd
  echo "  • Initializing node..."
  $EVINIT_BIN init "$moniker" --home "$evmd_home" --chain-id "$CHAINID" 2>&1 | grep -v "WARNING\|warning" || true
  
  # Create a new validator key
  echo "  • Creating validator key..."
  $EVINIT_BIN keys add "validator$node_id" \
    --home "$evmd_home" \
    --keyring-backend "$KEYRING" \
    --algo "$KEYALGO" 2>&1 | grep -v "WARNING\|warning" || true
  
  # Get the validator address
  VALIDATOR_ADDR=$($EVINIT_BIN keys show "validator$node_id" -a \
    --home "$evmd_home" \
    --keyring-backend "$KEYRING" 2>&1 | grep -v "WARNING\|warning")
  
  echo "  ✓ Validator address: $VALIDATOR_ADDR"
  
  # Create a gentx file
  echo "  • Creating gentx..."
  $EVINIT_BIN gentx "validator$node_id" 1000000atest \
    --home "$evmd_home" \
    --keyring-backend "$KEYRING" \
    --chain-id "$CHAINID" 2>&1 | grep -v "WARNING\|warning" || true
  
  # Copy gentx to shared gentxs directory
  cp "$evmd_home/config/gentx/gentx-"*.json "$TESTNET_DIR/gentxs/gentx-validator$node_id.json" 2>/dev/null || true
  
  # Store the validator info for later reference
  echo "$VALIDATOR_ADDR" > "$node_dir/validator_address.txt"
  
  echo "  ✓ Validator $node_id setup complete"
  echo ""
}

# Setup all 3 validators
for i in $(seq 0 $((NUM_VALIDATORS - 1))); do
  setup_validator "$i"
done

echo "✅ All validators initialized!"
echo ""
echo "📋 Validator Addresses:"
for i in $(seq 0 $((NUM_VALIDATORS - 1))); do
  if [ -f "$TESTNET_DIR/node$i/validator_address.txt" ]; then
    echo "  node$i: $(cat $TESTNET_DIR/node$i/validator_address.txt)"
  fi
done

echo ""
echo "📂 Directory structure:"
ls -la "$TESTNET_DIR/"

echo ""
echo "Next steps:"
echo "1. Run: ./collect_gentxs.sh"
echo "2. Copy .testnets/ to EC2 instances"
echo "3. Configure persistent_peers in each node's config.toml"
echo "4. Start Docker containers"
