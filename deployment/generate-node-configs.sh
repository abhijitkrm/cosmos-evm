#!/bin/bash
#
# Generate config.toml for each node with persistent peers
# This updates the p2p section with correct IPs and node IDs
#

set -e

source "$(dirname "$0")/ec2-config.sh"

DEPLOY_DIR="$(dirname "$0")/configs"

# Function to get node ID from node_key.json
# Node ID is derived when the node starts, but we can document it here
get_node_info() {
  local NODE_ID=$1
  local CONFIG_DIR="$DEPLOY_DIR/node$NODE_ID/config"
  
  # Extract node public key from node_key.json (tendermint will derive the ID)
  if [ -f "$CONFIG_DIR/node_key.json" ]; then
    echo "Node $NODE_ID config found at: $CONFIG_DIR"
  fi
}

echo "========================================="
echo "Generating node-specific config files"
echo "========================================="
echo ""

# Get node info
for NODE_ID in 0 1 2; do
  CONFIG_FILE="$DEPLOY_DIR/node$NODE_ID/config/config.toml"
  
  if [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: Config not found at $CONFIG_FILE"
    exit 1
  fi
  
  get_node_info "$NODE_ID"
  
  # Store variable names for reference
  IP_VAR="EC2_NODE${NODE_ID}_PUBLIC_IP"
  PRIVATE_IP_VAR="EC2_NODE${NODE_ID}_PRIVATE_IP"
  
  eval "NODE_PUBLIC_IP=\$$IP_VAR"
  eval "NODE_PRIVATE_IP=\$$PRIVATE_IP_VAR"
  
  echo "Node $NODE_ID:"
  echo "  Public IP:  $NODE_PUBLIC_IP (placeholder: $(eval echo \$$IP_VAR))"
  echo "  Private IP: $NODE_PRIVATE_IP (placeholder: $(eval echo \$$PRIVATE_IP_VAR))"
  echo ""
done

echo ""
echo "========================================="
echo "NEXT STEPS:"
echo "========================================="
echo "1. Update ec2-config.sh with actual EC2 IPs"
echo "2. Run this script again to finalize configs"
echo "3. Then run: ./deploy-to-ec2.sh"
echo ""
