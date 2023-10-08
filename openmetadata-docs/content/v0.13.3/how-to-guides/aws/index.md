---
title: How to enable AWS RDS IAM Auth on postgresql
slug: /how-to-guides/aws/index.md
---

# Aws resources on Rds IAM Auth
https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html

# Requirements
1. AWS Rds Cluster with IAM auth enabled
2. User on Db Cluster with iam enabled
3. IAM policy with permission on rds connect
4. Role with IAM policy attached
5. IAM role attached to ec2 instance on which openmetadata is deployed or ServiceAccount/Kube2Iam role attached to pod
  
# How to enable ADS RDS IAM Auth on postgresql

Set environment variables
```Commandline
  AWS_ENABLE_IAM_DATABASE_AUTHENTICATION: true
  AWS_REGION: your_region
  DB_PARAMS: "allowPublicKeyRetrieval=true&sslmode=require&serverTimezone=UTC"
```
Either through helm (if deployed in kubernetes) or as env vars

# Note
The `DB_USER_PASSWORD` is still required and cannot be empty. Set it to a random/dummy string.
