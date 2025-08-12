---
title: How to enable AWS RDS IAM Auth  | Official Documentation
description: Learn how to securely connect OpenMetadata to AWS RDS using IAM authentication with correct environment variables and configuration best practices.
slug: /deployment/rds-iam-auth
collate: false
---

# Aws resources on RDS IAM Auth
[AWS Reference Doc](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html)

# Requirements

1. AWS RDS Cluster with IAM auth enabled
2. User on DB Cluster with IAM enabled
3. IAM policy with permission on RDS connect
4. Role with IAM policy attached
5. IAM role attached to an EC2 instance on which openmetadata is deployed or ServiceAccount/Kube2Iam role attached to pod.

# How to enable ADS RDS IAM Auth on postgresql

Set the environment variables

```Commandline
  DB_USER_PASSWORD: "dummy"
  DB_PARAMS: "awsRegion=eu-west-1&allowPublicKeyRetrieval=true&sslmode=require&serverTimezone=UTC"
```

Either through helm (if deployed in kubernetes) or as env vars.

{% note %}

The `DB_USER_PASSWORD` is still required and cannot be empty. Set it to a random/dummy string.

{% /note %}

{% note %}

When using IAM authentication for AWS RDS, you must still provide a dummy value for the `DB_PASSWORD` environment variable. OpenMetadata automatically handles the IAM credentials internally. Ensure the following parameters are set for successful connection:

- `DB_PARAMS=awsRegion=us-east-1&allowPublicKeyRetrieval=true&serverTimezone=UTC`
- `DB_USE_SSL=true`  

These settings ensure proper token generation and secure communication with the RDS instance.

{% /note %}
