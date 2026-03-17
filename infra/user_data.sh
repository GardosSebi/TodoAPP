#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Docker
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Install Git
apt-get install -y git

# Install curl for health checks
apt-get install -y curl

# Add ubuntu user to docker group
usermod -aG docker ubuntu

# Create app directory
mkdir -p /opt/app
chown ubuntu:ubuntu /opt/app

# Clone repository if provided
if [ -n "${git_repo_url}" ]; then
    cd /opt/app
    sudo -u ubuntu git clone -b ${git_branch} ${git_repo_url} .
fi

# Create docker-compose directory
mkdir -p /opt/app/deploy
chown -R ubuntu:ubuntu /opt/app

# Write a simple startup script
cat > /opt/app/start.sh << 'EOF'
#!/bin/bash
cd /opt/app/deploy
docker compose down || true
docker compose up -d --build
EOF

chmod +x /opt/app/start.sh
chown ubuntu:ubuntu /opt/app/start.sh

# Optional: CloudWatch agent (basic monitoring)
if [ "${enable_cloudwatch}" = "true" ] && [ -n "${cloudwatch_config_b64}" ]; then
  CW_DEB="https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb"
  wget -q "$CW_DEB" -O /tmp/amazon-cloudwatch-agent.deb
  dpkg -i -E /tmp/amazon-cloudwatch-agent.deb
  rm -f /tmp/amazon-cloudwatch-agent.deb
  mkdir -p /opt/aws/amazon-cloudwatch-agent/etc
  echo "${cloudwatch_config_b64}" | base64 -d > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
  /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
fi

# Log completion
echo "Bootstrap completed at $(date)" >> /var/log/user-data.log

