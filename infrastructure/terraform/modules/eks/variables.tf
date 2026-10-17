variable "environment" {
  description = "Environment name"
  type        = string
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for cluster"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for nodes"
  type        = list(string)
}

variable "node_group_instance_types" {
  description = "Instance types for node group"
  type        = list(string)
}

variable "min_nodes" {
  description = "Minimum number of nodes"
  type        = number
}

variable "max_nodes" {
  description = "Maximum number of nodes"
  type        = number
}

variable "desired_nodes" {
  description = "Desired number of nodes"
  type        = number
}
