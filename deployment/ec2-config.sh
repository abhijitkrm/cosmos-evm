# EC2 Validator Configuration
# Update these values with your AWS EC2 instance details

## Node 0
EC2_NODE0_PUBLIC_IP="YOUR_NODE0_PUBLIC_IP"
EC2_NODE0_PRIVATE_IP="YOUR_NODE0_PRIVATE_IP"
EC2_NODE0_INSTANCE_ID="i-xxxxxxxxx"
EC2_NODE0_KEY_PATH="$HOME/.ssh/cosmos-validator-key.pem"

## Node 1
EC2_NODE1_PUBLIC_IP="YOUR_NODE1_PUBLIC_IP"
EC2_NODE1_PRIVATE_IP="YOUR_NODE1_PRIVATE_IP"
EC2_NODE1_INSTANCE_ID="i-xxxxxxxxx"
EC2_NODE1_KEY_PATH="$HOME/.ssh/cosmos-validator-key.pem"

## Node 2
EC2_NODE2_PUBLIC_IP="YOUR_NODE2_PUBLIC_IP"
EC2_NODE2_PRIVATE_IP="YOUR_NODE2_PRIVATE_IP"
EC2_NODE2_INSTANCE_ID="i-xxxxxxxxx"
EC2_NODE2_KEY_PATH="$HOME/.ssh/cosmos-validator-key.pem"

# EC2 Instance Configuration
EC2_USER="ec2-user"  # or "ubuntu" for Ubuntu AMI
EC2_SECURITY_GROUP="cosmos-validators"
EC2_REGION="us-east-1"

# Docker Registry (where you'll push the image)
DOCKER_REGISTRY="your-account.dkr.ecr.us-east-1.amazonaws.com"
DOCKER_IMAGE="cosmos/evmd"
DOCKER_TAG="latest"
