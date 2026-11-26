# AWS clients keep the legacy retry mode unless the operator chooses one

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `AWSSecretsManagerRetryTest`, `S3AssetServiceRetryTest`, `AwsCredentialsUtilTest`
- **Related:** #38455 (AWS SDK 2.57 to 2.59 in the Maven group upgrade)

## Context

AWS SDK for Java 2.58 changed which retry mode a client uses when nothing is configured. Up to 2.57
the default resolved to legacy: 4 attempts, a 500-token retry quota that charges 5 tokens per failed
attempt and nothing for throttling. From 2.58 it resolves to standard with retry behavior 2.1: 3
attempts, and throttling also draws from the quota (5 tokens, 14 for other errors). Measured
against an endpoint that always throttles, a Secrets Manager call on 2.57 made 4 attempts over about
2.4 s; on 2.59 it makes 3 over about 0.8 s. On a live server whose Secrets Manager throttled three
calls in a row, creating a database service succeeded in legacy mode and failed with HTTP 400
("SDK Attempt Count: 3") in standard mode. The SDK's own guidance for keeping the earlier behavior
is to set the retry mode to legacy.

## Decision

Every AWS client OpenMetadata builds for Secrets Manager, SSM, S3 and STS takes its retry mode from
`AwsCredentialsUtil.configuredOrLegacyRetryMode()`: the mode the operator configured through
`AWS_RETRY_MODE`, `-Daws.retryMode` or `retry_mode` in the AWS profile, and `legacy` when none is
set. Bedrock clients keep their own 10-attempt standard strategy for regional throttling. A new AWS
client added to the server uses the same helper.

## Consequences

Upgrading the AWS SDK no longer changes how often these clients retry, and an operator can still
opt into the newer behavior with `AWS_RETRY_MODE=standard`. Clients the SDK builds internally, such
as the STS client behind web-identity credentials on EKS, are not built here and keep the SDK
default; setting `AWS_RETRY_MODE=legacy` on the deployment covers them too. A `defaults_mode` set
by the operator no longer selects the retry mode for these clients; an explicit retry mode does.
Revisit when AWS removes the legacy mode or when the 2.1 behavior is shown safe for these calls.
