# Security Group for RDS
resource "aws_security_group" "rds" {
  name        = "kingdoms-of-war-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
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
    Name = "kingdoms-of-war-rds-sg"
  }
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "kingdoms-of-war-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "kingdoms-of-war-db-subnet-group"
  }
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier     = "kingdoms-of-war-db"
  engine         = "postgres"
  engine_version = "16.2"
  instance_class = var.db_instance_class

  allocated_storage           = 100
  storage_type                = "gp3"
  storage_encrypted           = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  multi_az               = true
  publicly_accessible    = false
  skip_final_snapshot    = false
  final_snapshot_identifier = "kingdoms-of-war-db-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 30
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = {
    Name = "kingdoms-of-war-db"
  }

  depends_on = [aws_db_subnet_group.main, aws_security_group.rds]
}
