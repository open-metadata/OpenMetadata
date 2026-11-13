# AzureCredentials derives sovereign storage, Key Vault, and Entra endpoints from endpointSuffix

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Ingestion maintainers
- **Guard:** `ingestion/tests/unit/test_azure_credentials.py`, `ingestion/tests/unit/readers/test_adls_reader_options.py`
- **Related:** open-metadata/OpenMetadata#35898

## Context

`AzureClient` and the ADLS DataFrame readers hardcoded Azure Commercial hosts (`blob.core.windows.net`, `dfs.core.windows.net`, `vault.azure.net`, and the default `login.microsoftonline.com` Microsoft Entra authority). Connections targeting Azure US Government (`core.usgovcloudapi.net` / `login.microsoftonline.us`), Azure China (`core.chinacloudapi.cn` / `login.chinacloudapi.cn`), or Azure Stack / private DNS suffixes failed during token acquisition (`AADSTS90002`) and blob or ABFS URL resolution.

Two additional library constraints in `adlfs` (`AzureBlobFileSystem`) affect sovereign and Managed Identity connections:

1. When `return_azure_storage_options` passes raw `tenant_id`, `client_id`, and `client_secret`, `adlfs` constructs `ClientSecretCredential` without `authority`, targeting commercial Entra ID even when `account_host` points to a sovereign cloud.
2. `adlfs._get_kwargs_from_urls` extracts `account_name` only from `.core.windows.net` ABFS URLs, while `AzureBlobFileSystem(account_name=..., **storage_options)` rejects a duplicate `account_name` keyword argument.

## Decision

`azureCredentials.json` adds two optional properties shared by every Azure connector referencing it:

- `endpointSuffix` (string, default `"core.windows.net"`), validated as a multi-label RFC-1123 domain suffix (rejecting schemes, paths, queries, fragments, ports, userinfo, single-label hosts, and IP literals).
- `authority` (string, optional), validated as an HTTPS hostname/origin and auto-inferred from `endpointSuffix` when omitted (`https://login.microsoftonline.us` for `core.usgovcloudapi.net`, `https://login.chinacloudapi.cn` for `core.chinacloudapi.cn`, and omitted for commercial defaults).

`AzureClient` derives Blob (`https://<account>.blob.<endpointSuffix>/`), Key Vault (`vault.azure.net`, `vault.usgovcloudapi.net`, `vault.azure.cn`, or `vault.<suffix without leading 'core.'>`), and Entra credentials from those validated fields, passing `disable_instance_discovery=True` when an explicit `authority` host falls outside `msal.authority.WELL_KNOWN_AUTHORITY_HOSTS` so MSAL never probes commercial `login.microsoftonline.com` in air-gapped or custom clouds. When sovereign/custom endpoints, an explicit `authority`, or `DefaultAzureCredential` (`clientSecret` omitted) are used, `return_azure_storage_options` passes the `AzureClient`-built `credential` (plus `account_host` when non-commercial) to `adlfs`, and pandas ABFS callers add `account_name` only when `account_host` is present.

## Consequences

- Azure US Government and Azure China connections require setting only `endpointSuffix` (`core.usgovcloudapi.net` or `core.chinacloudapi.cn`); custom clouds can additionally override `authority`.
- Existing commercial configurations that omit `endpointSuffix` and `authority` preserve identical SDK call signatures and storage options.
- Managed Identity / `DefaultAzureCredential` configurations (`clientSecret` omitted) work in ADLS DataFrame readers instead of failing on `None.get_secret_value()`.
- Revisit if an Azure environment decouples Blob and DFS suffixes such that `<account>.blob.<endpointSuffix>` and `<account>.dfs.<endpointSuffix>` no longer share one suffix.
