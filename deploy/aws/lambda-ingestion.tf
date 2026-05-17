# Terraform: S3 → Lambda → Campaign API ingestion
# Usage: terraform apply -var="campaign_api_url=https://api.adflow.example"

variable "campaign_api_url" {
  type = string
}

variable "s3_bucket_name" {
  type    = string
  default = "adflow-campaign-uploads"
}

resource "aws_s3_bucket" "campaigns" {
  bucket = var.s3_bucket_name
}

resource "aws_lambda_function" "ingestion" {
  function_name = "adflow-campaign-ingestion"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "handler.handler"
  runtime       = "nodejs20.x"
  filename      = "${path.module}/../../services/ingestion-worker/lambda.zip"
  environment {
    variables = {
      CAMPAIGN_API_URL = var.campaign_api_url
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name = "adflow-lambda-ingestion"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_s3_bucket_notification" "campaign_upload" {
  bucket = aws_s3_bucket.campaigns.id
  lambda_function {
    lambda_function_arn = aws_lambda_function.ingestion.arn
    events              = ["s3:ObjectCreated:*"]
  }
}
