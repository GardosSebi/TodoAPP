# Deployment Demo - Production-like CI/CD System

A complete deployment system demonstrating infrastructure-as-code, containerization, and automated CI/CD pipelines. This project deploys a simple FastAPI application to AWS EC2 using Terraform, Docker Compose, Nginx, and GitHub Actions.

## Architecture

```
User Request → Nginx (Port 80) → FastAPI App (Port 8000) → Response
```

**Infrastructure:**
- AWS EC2 instance (Ubuntu 22.04)
- Security Group (HTTP + SSH)
- Optional Elastic IP
- Docker & Docker Compose installed via user_data

**Application Stack:**
- FastAPI application container
- Nginx reverse proxy container
- Health check endpoints for deployment verification

**CI/CD:**
- GitHub Actions CI: Lint, test, build
- GitHub Actions CD: SSH deployment with health checks

## Project Structure

```
.
├── app/                    # FastAPI application
│   ├── src/
│   │   └── main.py        # Application code
│   ├── Dockerfile         # Container definition
│   ├── requirements.txt   # Python dependencies
│   └── test_main.py       # Unit tests
├── deploy/                # Deployment configuration
│   ├── docker-compose.yml # Container orchestration
│   ├── nginx.conf         # Nginx configuration
│   └── .env.example       # Example env vars (GIT_SHA, APP_ENV)
├── docs/                  # Documentation
│   ├── DEV-PROD-CONFIGS.md # Dev/prod Terraform and GitHub Environments
│   ├── HTTPS-setup.md     # Let's Encrypt and ACM/ALB options
│   ├── MONITORING.md      # CloudWatch agent
│   └── SECRETS.md         # GitHub Actions secrets reference
├── infra/                 # Terraform infrastructure
│   ├── main.tf            # Main resources (EC2, IAM, security group)
│   ├── variables.tf       # Variable definitions
│   ├── outputs.tf         # Output values
│   ├── user_data.sh       # EC2 bootstrap (Docker, optional CloudWatch)
│   ├── cloudwatch-agent-config.json # CloudWatch logs/metrics
│   ├── dev.tfvars         # Dev environment config
│   └── prod.tfvars        # Prod environment config
├── scripts/
│   └── rollback.sh        # Local rollback script (deploy a specific SHA)
└── .github/workflows/     # CI/CD pipelines
    ├── ci.yml             # Continuous Integration (lint, test, build)
    ├── deploy.yml         # Continuous Deployment (runs after CI passes)
    └── rollback.yml       # Rollback workflow (deploy a given commit SHA)
```

## Quick Start

### 1. Infrastructure Setup

```bash
cd infra

# Copy and edit terraform variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Initialize Terraform
terraform init

# Plan infrastructure
terraform plan -var-file=dev.tfvars

# Apply infrastructure
terraform apply -var-file=dev.tfvars

# Save outputs
terraform output -json > outputs.json
```

**Important outputs:**
- `ssh_command`: SSH command to connect
- `app_url`: Application URL
- `ssh_private_key_path`: Path to SSH private key

### 2. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add:

- `SSH_PRIVATE_KEY`: Contents of the `.pem` file from Terraform output
- `EC2_HOST`: Public IP or Elastic IP of your EC2 instance
- `EC2_USER`: `ubuntu` (default for Ubuntu AMI)
- `APP_URL`: `http://<your-ec2-ip>` (optional, for external health checks)

### 3. Deploy Application

The deployment happens automatically on push to `main` branch, or manually via:

```bash
# Push to main branch
git push origin main

# Or trigger manually via GitHub Actions UI
```

### 4. Verify Deployment

```bash
# Check health endpoint
curl http://<your-ec2-ip>/health

# Check version endpoint
curl http://<your-ec2-ip>/version

# Check root endpoint
curl http://<your-ec2-ip>/
```

## Application Endpoints

- `GET /` - Root endpoint with app info
- `GET /health` - Health check endpoint (returns `{"status": "ok"}`)
- `GET /version` - Version endpoint (returns git SHA)

## Infrastructure Details

### EC2 Instance
- **AMI**: Ubuntu 22.04 LTS (auto-detected)
- **Instance Type**: t3.micro (dev) / t3.small (prod)
- **Storage**: 20GB (dev) / 30GB (prod) encrypted GP3
- **IAM**: Instance profile with CloudWatchAgentServerPolicy (for optional monitoring)
- **Bootstrap**: Installs Docker, Docker Compose, Git; optionally CloudWatch agent (logs + basic metrics)

### Security Group
- **Port 80**: HTTP (open to world)
- **Port 22**: SSH (configurable CIDR blocks)

### Docker Compose Services
- **app**: FastAPI application on port 8000
- **nginx**: Reverse proxy on port 80
- **Network**: Bridge network connecting both containers

## CI/CD Pipeline

### CI Workflow (`ci.yml`)
Triggers on:
- Pull requests to `main`
- Pushes to `main`

Steps:
1. Checkout code
2. Set up Python environment
3. Install dependencies
4. Lint with flake8
5. Format check with black
6. Run tests with pytest
7. Build Docker image
8. Test Docker image

### CD Workflow (`deploy.yml`)
Triggers on:
- **After CI completes successfully** on `main` (deploy only when tests pass)
- Manual workflow dispatch

Steps:
1. Checkout code (at the commit that passed CI)
2. Get git SHA
3. Configure SSH
4. Copy files to server
5. Deploy via Docker Compose
6. Health check (internal)
7. Verify deployment (external, if APP_URL set)

### Rollback Workflow (`rollback.yml`)
- **Manual only:** Actions → Rollback → Run workflow → enter a git SHA.
- Deploys that commit to the server (same steps as deploy). Use after a bad release.

## Manual Deployment (on server)

```bash
# SSH into server, then:
cd /opt/app/deploy
docker compose logs -f
curl http://localhost/health
```

## Troubleshooting

### Health Check Fails
```bash
# SSH into server
ssh -i infra/deployment-demo-dev.pem ubuntu@<ec2-ip>

# Check container status
docker compose -f /opt/app/deploy/docker-compose.yml ps

# Check logs
docker compose -f /opt/app/deploy/docker-compose.yml logs

# Restart containers
cd /opt/app/deploy
docker compose restart
```

### SSH Connection Issues
```bash
# Verify security group allows SSH from your IP
# Check key permissions
chmod 400 infra/deployment-demo-dev.pem

# Test connection
ssh -i infra/deployment-demo-dev.pem ubuntu@<ec2-ip>
```

## Security Considerations

⚠️ **Important Security Notes:**

1. **SSH Access**: Restrict `ssh_allowed_cidrs` in production to your IP or VPN CIDR
2. **Private Keys**: Never commit `.pem` files or `terraform.tfvars` to git
3. **GitHub Secrets**: Use GitHub Secrets for all sensitive values
4. **Security Groups**: Review and restrict security group rules for production
5. **HTTPS**: Add SSL/TLS certificate (Let's Encrypt) for production

## Cost Estimation

**Development Environment (t3.micro):**
- EC2: ~$7-10/month (depending on usage)
- Data Transfer: Minimal for demo
- Elastic IP: Free if attached to running instance

**Production Environment (t3.small + Elastic IP):**
- EC2: ~$15-20/month
- Elastic IP: Free if attached

## Requirements Met

- ✅ Terraform creates EC2 and security group
- ✅ Dockerized app
- ✅ Nginx reverse proxy
- ✅ GitHub Actions CI
- ✅ GitHub Actions deploy over SSH
- ✅ Health check endpoint
- ✅ Version endpoint with git SHA
- ✅ Server bootstrapping via user_data
- ✅ Docker Compose orchestration
- ✅ Environment-specific configs (dev/prod)

## Nice-to-have (included)

- ✅ **Rollback:** `scripts/rollback.sh` (local) and **Actions → Rollback** workflow (enter git SHA to deploy that commit).
- ✅ **Separate dev/prod:** Terraform `dev.tfvars` / `prod.tfvars`; see [docs/DEV-PROD-CONFIGS.md](docs/DEV-PROD-CONFIGS.md) for GitHub Environments.
- ✅ **HTTPS:** See [docs/HTTPS-setup.md](docs/HTTPS-setup.md) (Let's Encrypt on EC2 or ACM + ALB later).
- ✅ **GitHub Actions secrets:** SSH key and host in repo (or environment) secrets; see [docs/SECRETS.md](docs/SECRETS.md).
- ✅ **Deploy only after tests pass:** Deploy workflow runs only when the CI workflow completes successfully on `main` (or when run manually).
- ✅ **Basic monitoring:** CloudWatch agent (optional, default on) — syslog, user-data log, CPU/memory/disk metrics; see [docs/MONITORING.md](docs/MONITORING.md). Set `enable_cloudwatch_agent = false` in tfvars to disable.

## License

This is a demonstration project for learning purposes.
