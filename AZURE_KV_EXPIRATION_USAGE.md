# Azure Key Vault Secret Expiration Feature

## Overview

The Azure Key Vault Secrets Manager now supports setting expiration dates for secrets using the `setExpiresOn` method from the Azure SDK SecretProperties class.

## Configuration

To enable secret expiration, add the `expiresAfterDays` parameter to your Azure Key Vault secrets manager configuration:

```yaml
secretsManagerConfiguration:
  secretsManager: managed-azure-kv
  parameters:
    vaultName: "your-vault-name"
    clientId: "your-client-id"
    clientSecret: "your-client-secret"
    tenantId: "your-tenant-id"
    expiresAfterDays: "90"  # Secrets will expire after 90 days
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `expiresAfterDays` | String | No | Number of days from the current date when the secret will expire |

## Behavior

- If `expiresAfterDays` is not provided, secrets will not have an expiration date (existing behavior)
- If provided, the expiration date is calculated as: `current_date + expiresAfterDays`
- The parameter value must be a valid integer
- Invalid values will throw a `SecretsManagerException` with a descriptive error message

## Example

With `expiresAfterDays: "30"`, a secret stored on January 1, 2024 will expire on January 31, 2024.

## Implementation Details

- The feature uses the `setExpiresOn()` method from `com.azure.security.keyvault.secrets.models.SecretProperties`
- Expiration is set during both secret creation and updates
- The implementation uses `OffsetDateTime` for precise date-time handling

## Error Handling

If an invalid value is provided for `expiresAfterDays`, the system will throw an exception:

```
SecretsManagerException: Invalid value for 'expiresAfterDays' parameter. Expected a number but got: <invalid_value>
```
