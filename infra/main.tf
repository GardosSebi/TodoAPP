terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Get default VPC
data "aws_vpc" "default" {
  default = true
}

# Get availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Security Group for EC2 instance
resource "aws_security_group" "app_sg" {
  name        = "${var.project_name}-sg-${var.environment}"
  description = "Security group for deployment demo app"

  ingress {
    description = "HTTP from anywhere"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH from anywhere (restrict in production)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_cidrs
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-sg-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Elastic IP (optional)
resource "aws_eip" "app_eip" {
  count  = var.use_elastic_ip ? 1 : 0
  domain = "vpc"
  
  tags = {
    Name        = "${var.project_name}-eip-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Get latest Ubuntu 22.04 LTS AMI
# Get latest Ubuntu 22.04 LTS AMI (only if ami_id is not provided)
data "aws_ami" "ubuntu" {
  count       = var.ami_id == "" ? 1 : 0
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu-minimal/images/hvm-ssd/ubuntu-jammy-22.04-amd64-minimal-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

# Generate SSH key pair
resource "tls_private_key" "app_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "app_key" {
  key_name   = "${var.project_name}-key-${var.environment}"
  public_key = tls_private_key.app_key.public_key_openssh

  tags = {
    Name        = "${var.project_name}-key-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Save private key locally
resource "local_file" "private_key" {
  content         = tls_private_key.app_key.private_key_pem
  filename        = "${path.module}/${var.project_name}-${var.environment}.pem"
  file_permission = "0400"
}

# EC2 Instance
resource "aws_instance" "app_server" {
  ami = var.ami_id != "" ? var.ami_id : data.aws_ami.ubuntu[0].id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.app_key.key_name
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  
  user_data = templatefile("${path.module}/user_data.sh", {
    git_repo_url = var.git_repo_url
    git_branch   = var.git_branch
  })

  root_block_device {
    volume_type = "gp3"
    volume_size = var.volume_size
    encrypted   = true
  }

  tags = {
    Name        = "${var.project_name}-server-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Associate Elastic IP if enabled
resource "aws_eip_association" "app_eip_assoc" {
  count       = var.use_elastic_ip ? 1 : 0
  instance_id = aws_instance.app_server.id
  public_ip   = aws_eip.app_eip[0].public_ip
}

