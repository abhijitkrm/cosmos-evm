#!/bin/bash
#
# Script to prepare validator configs for 3 EC2 instances
# Run this ONCE locally before deploying to EC2
#

set -e

REPO_ROOT="/Users/sysadmin/Desktop/chains/cosmos-evm/evm"
DEPLOY_DIR="$REPO_ROOT/deployment/configs"

mkdir -p "$DEPLOY_DIR"

echo "Preparing validator configurations for 3 EC2 instances..."
echo ""

# Create node-specific config directories
for NODE_ID in 0 1 2; do
  SRC_DIR="$REPO_ROOT/.testnets/node$NODE_ID/evmd/config"
  DST_DIR="$DEPLOY_DIR/node$NODE_ID/config"
  
  mkdir -p "$DST_DIR"
  
  if [ ! -d "$SRC_DIR" ]; then
    echo "ERROR: Source config not found at $SRC_DIR"
    exit 1
  fi
  
  # Copy all config files
  cp -r "$SRC_DIR"/* "$DST_DIR/"
  
  echo "✓ Prepared configs for node$NODE_ID"
  echo "  Source: $SRC_DIR"
  echo "  Dest:   $DST_DIR"
done

echo ""
echo "==============================================="
echo "CONFIGURATION READY FOR EC2 DEPLOYMENT"
echo "==============================================="
echo ""
echo "Next steps:"
echo "1. Update node IPs in deployment/ec2-config.yaml"
echo "2. Run: ./deployment/deploy-to-ec2.sh"
echo ""
echo "Generated structure:"
ls -la "$DEPLOY_DIR"
