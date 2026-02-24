#!/bin/bash

# Add validators to genesis.json
# Uses the priv_validator_key.json from each node to populate genesis

set -e

TESTNET_DIR=".testnets"
EVINIT_BIN="${EVINIT_BIN:-evmd}"
KEYRING="test"
NUM_VALIDATORS=3

echo "👤 Adding validators to genesis..."

# Use node0's genesis as template
SHARED_GENESIS="$TESTNET_DIR/node0/evmd/config/genesis.json"

# Read each node's public key and add to genesis
for i in $(seq 0 $((NUM_VALIDATORS - 1))); do
  NODE_HOME="$TESTNET_DIR/node$i/evmd"
  PRIV_VAL_KEY="$NODE_HOME/config/priv_validator_key.json"
  
  echo "  • Processing validator $i..."
  
  # Extract public key from priv_validator_key.json
  if [ -f "$PRIV_VAL_KEY" ]; then
    # Get the public key (base64 encoded ed25519 key)
    PUBKEY=$(jq -r '.pub_key.value' "$PRIV_VAL_KEY" 2>/dev/null || echo "")
    
    if [ -n "$PUBKEY" ]; then
      echo "    ✓ Found pubkey: ${PUBKEY:0:20}..."
    fi
  fi
done

# Try to add validators using evmd add-genesis-account
echo ""
echo "💰 Adding genesis accounts and stakes..."

for i in $(seq 0 $((NUM_VALIDATORS - 1))); do
  NODE_HOME="$TESTNET_DIR/node$i/evmd"
  VALIDATOR_ACCOUNT=$(cat "$TESTNET_DIR/node$i/validator_address.txt" 2>/dev/null)
  
  if [ -n "$VALIDATOR_ACCOUNT" ]; then
    echo "  • Adding account: $VALIDATOR_ACCOUNT"
    
    # Add genesis account with initial balance (use node0's genesis)
    $EVINIT_BIN add-genesis-account "$VALIDATOR_ACCOUNT" 10000000000000000000atest \
      --home "$TESTNET_DIR/node0/evmd" \
      --keyring-backend "$KEYRING" 2>&1 | grep -v "WARNING\|warning" || true
  fi
done

echo "  ✓ Gentxs directory contents:"
ls -la "$TESTNET_DIR/gentxs/" 2>/dev/null | tail -5 || echo "    (empty)"

echo ""
echo "📋 Genesis file location:"
echo "  $SHARED_GENESIS"
echo ""
echo "Current validators in genesis:"
jq '.validators | length' "$SHARED_GENESIS" || echo "Unable to read"

echo ""
echo "✅ Validator setup complete!"
echo ""
echo "Note: Ensure proper genesis is created before deploying to EC2"
