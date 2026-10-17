# Security Group for ElastiCache
resource "aws_security_group" "elasticache" {
  name        = "kingdoms-of-war-elasticache-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.eks_security_group]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "kingdoms-of-war-elasticache-sg"
  }
}

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "kingdoms-of-war-redis-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "kingdoms-of-war-redis-subnet-group"
  }
}

# ElastiCache Redis Replication Group
resource "aws_elasticache_replication_group" "main" {
  replication_group_description = "Redis cluster for Kingdoms of War"
  engine                        = "redis"
  engine_version                = "7.0"
  node_type                     = "cache.t3.micro"
  num_cache_clusters            = 1
  parameter_group_name          = "default.redis7"

  port                = 6379
  security_group_ids  = [aws_security_group.elasticache.id]
  subnet_group_name   = aws_elasticache_subnet_group.main.name
  automatic_failover_enabled = false

  at_rest_encryption_enabled = true
  transit_encryption_enabled = false
  auth_token_enabled         = false

  snapshot_retention_limit = 5
  snapshot_window          = "03:00-05:00"

  log_delivery_configuration {
    destination      = "cloudwatch-logs"
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }

  tags = {
    Name = "kingdoms-of-war-redis"
  }

  depends_on = [aws_elasticache_subnet_group.main, aws_security_group.elasticache]
}
