---
title: awsCredentials
slug: /main-concepts/metadata-standard/schemas/security/credentials/awscredentials
---

# AWSCredentials

*AWS credentials configs.*

## Properties

- **`awsAccessKeyId`** *(string)*: AWS Access key ID.
- **`awsSecretAccessKey`** *(string)*: AWS Secret Access Key.
- **`awsRegion`** *(string)*: AWS Region.
- **`awsSessionToken`** *(string)*: AWS Session Token.
- **`endPointURL`** *(string)*: EndPoint URL for the AWS.
- **`profileName`** *(string)*: The name of a profile to use with the boto session.
- **`assumeRoleArn`** *(string)*: The Amazon Resource Name (ARN) of the role to assume. Required Field in case of Assume Role.
- **`assumeRoleSessionName`** *(string)*: An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role is assumed by different principals or for different reasons. Required Field in case of Assume Role. Default: `OpenMetadataSession`.
- **`assumeRoleSessionDuration`** *(integer)*: Number of seconds the assumed role credentials should be valid.
- **`assumeRoleSourceIdentity`** *(string)*: The Amazon Resource Name (ARN) of the role to assume. Optional Field in case of Assume Role.


Documentation file automatically generated at 2024-12-16 13:19:17.910173+00:00.
