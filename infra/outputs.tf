output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app_server.id
}

output "instance_public_ip" {
  description = "EC2 instance public IP"
  value       = aws_instance.app_server.public_ip
}

output "instance_public_dns" {
  description = "EC2 instance public DNS"
  value       = aws_instance.app_server.public_dns
}

output "elastic_ip" {
  description = "Elastic IP address (if enabled)"
  value       = var.use_elastic_ip ? aws_eip.app_eip[0].public_ip : null
}

output "ssh_private_key_path" {
  description = "Path to SSH private key"
  value       = local_file.private_key.filename
  sensitive   = true
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i ${local_file.private_key.filename} ubuntu@${var.use_elastic_ip ? aws_eip.app_eip[0].public_ip : aws_instance.app_server.public_ip}"
}

output "app_url" {
  description = "Application URL"
  value       = "http://${var.use_elastic_ip ? aws_eip.app_eip[0].public_ip : aws_instance.app_server.public_ip}"
}

output "health_check_url" {
  description = "Health check URL"
  value       = "http://${var.use_elastic_ip ? aws_eip.app_eip[0].public_ip : aws_instance.app_server.public_ip}/health"
}

