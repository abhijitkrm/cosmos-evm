#!/bin/bash

# Collect gentx files and create shared genesis.json
# This script:
# 1. Copies genesis from node0 as base
# 2. Collects all gentx files from node0, node1, node2
# 3. Creates shared genesis with all validators
# 4. Distributes to all nodes

set -e

EVINIT_BIN="${EVINIT_BIN:-evmd}"
CHAINID="${CHAIN_ID:-9001}"
KEYRING="test"

TESTNET_DIR=".testnets"
NUM_VALIDATORS=3

echo "🔄 Collecting gentxs and creating shared genesis..."

# Use node0 as the template
GENESIS_NODE="$TESTNET_DIR/node0/evmd"

echo "📋 Collecting gentx files:"
for i in $(seq 0 $((NUM_VALIDATORS - 1))); do
  GENTX_FILE="$TESTNET_DIR/node$i/evmd/config/gentx/gentx-"*.json
  if [ -f $GENTX_FILE ]; then
    echo "  ✓ Node $i gentx found"
    # Copy to the genesis node's gentx directory
    cp $GENTX_FILE "$GENESIS_NODE/config/gentx/" 2>/dev/null || true
  fi
done

echo ""
echo "🔗 Creating shared genesis with all validators..."
$EVINIT_BIN collect-gentxs \
  --home "$GENESIS_NODE" \
  --chain-id "$CHAINID" 2>&1 | grep -v "WARNING\|warning" || true

echo ""
echo "📝 Validating genesis..."
$EVINIT_BIN validate-genesis \
  --home "$GENESIS_NODE" 2>&1 | grep -v "WARNING\|warning" || true

# Copy the shared genesis to all nodes
echo ""
echo "📦 Distributing shared genesis to all nodes..."
for i in $(seq 1 $((NUM_VALIDATORS - 1))); do
  cp "$GENESIS_NODE/config/genesis.json" "$TESTNET_DIR/node$i/evmd/config/"
  echo "  ✓ Node $i: genesis.json copied"
done

echo ""
echo "✅ Genesis creation complete!"
echo ""
echo "📊 Final Genesis Info:"
echo "  Chain ID: $CHAINID"
echo "  Genesis file: $GENESIS_NODE/config/genesis.json"
echo "  Validators:"
for i in $(seq 0 $((NUM_VALIDATORS - 1))); do
  echo "    - node$i: $(cat $TESTNET_DIR/node$i/validator_address.txt 2>/dev/null || echo 'N/A')"
done

echo ""
echo "Next steps:"
echo "1. Configure persistent_peers in each node's config.toml"
echo "2. Copy .testnets/node{0,1,2} to respective EC2 instances"
echo "3. Start Docker containers"
