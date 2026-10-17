variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Environment name (production, staging, development)"
  type        = string
  default     = "production"
}

variable "tf_state_bucket" {
  description = "S3 bucket for Terraform state"
  type        = string
}

variable "tf_state_dynamodb_table" {
  description = "DynamoDB table for Terraform state locking"
  type        = string
  default     = "terraform-locks"
}

variable "eks_cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "kingdoms-of-war-eks"
}

variable "db_instance_class" {
  description = "RDS instance type"
  type        = string
  default     = "db.t3.medium"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "kingdoms_of_war"
}

variable "db_username" {
  description = "PostgreSQL username"
  type        = string
  default     = "kowuser"
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "node_group_instance_types" {
  description = "Instance types for EKS node group"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "min_nodes" {
  description = "Minimum number of nodes in the node group"
  type        = number
  default     = 2
}

variable "max_nodes" {
  description = "Maximum number of nodes in the node group"
  type        = number
  default     = 6
}

variable "desired_nodes" {
  description = "Desired number of nodes in the node group"
  type        = number
  default     = 3
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for CloudFront (must be in us-east-1)"
  type        = string
  default     = ""
}
