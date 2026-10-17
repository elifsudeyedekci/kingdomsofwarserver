terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # These values should be set via -backend-config flags or environment variables
    # bucket         = var.tf_state_bucket
    # key            = "kingdoms-of-war/terraform.tfstate"
    # region         = var.aws_region
    # encrypt        = true
    # dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "KingdomsOfWar"
      Environment = var.environment
      ManagedBy   = "Terraform"
      CreatedAt   = timestamp()
    }
  }
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  environment = var.environment
  aws_region  = var.aws_region
}

# EKS Module
module "eks" {
  source = "./modules/eks"

  environment                = var.environment
  cluster_name               = var.eks_cluster_name
  vpc_id                     = module.vpc.vpc_id
  subnet_ids                 = concat(module.vpc.private_subnet_ids, module.vpc.public_subnet_ids)
  private_subnet_ids         = module.vpc.private_subnet_ids
  node_group_instance_types  = var.node_group_instance_types
  min_nodes                  = var.min_nodes
  max_nodes                  = var.max_nodes
  desired_nodes              = var.desired_nodes

  depends_on = [module.vpc]
}

# RDS Module
module "rds" {
  source = "./modules/rds"

  environment        = var.environment
  db_instance_class  = var.db_instance_class
  db_name            = var.db_name
  db_username        = var.db_username
  db_password        = var.db_password
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  eks_security_group = module.eks.node_security_group_id

  depends_on = [module.vpc, module.eks]
}

# ElastiCache Module
module "elasticache" {
  source = "./modules/elasticache"

  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  eks_security_group = module.eks.node_security_group_id

  depends_on = [module.vpc, module.eks]
}

# S3 Assets Module
module "s3_assets" {
  source = "./modules/s3_assets"

  environment = var.environment
}

# CloudFront Module
module "cloudfront" {
  source = "./modules/cloudfront"

  environment           = var.environment
  s3_bucket_domain_name = module.s3_assets.bucket_domain_name
  alb_dns_name          = module.eks.load_balancer_dns_name
  acm_certificate_arn   = var.acm_certificate_arn

  depends_on = [module.s3_assets, module.eks]
}
