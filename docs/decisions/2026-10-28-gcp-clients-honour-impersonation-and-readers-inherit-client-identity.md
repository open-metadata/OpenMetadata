# GCP clients built from GCPCredentials impersonate the configured target, and GCS file readers inherit that identity from the client

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** ulixius9
- **Guard:** `ingestion/tests/unit/utils/test_gcs_client_impersonation.py`, `ingestion/tests/unit/readers/test_gcs_impersonation.py`, `ingestion/tests/unit/source/storage/gcs/test_connection.py`, `ingestion/tests/unit/source/database/bigtable/test_connection.py`
- **Related:** #35907, #36297

## Context
`GCPCredentials.gcpImpersonateServiceAccount` was ignored by GCS storage, Bigtable, Datalake GCS,
dbt (GCS), Power BI (GCS) and the storage manifest reader: they built clients from the base
identity (ADC / key file), so Test Connection and ingestion 403'd when only the target service
account had access. File reads had a second hole: the dataframe readers open objects through
gcsfs, which resolves its own identity from ADC and never sees the client's credentials.

## Decision
- Every Google client built from user-supplied `GCPCredentials` passes
  `credentials=get_gcp_impersonate_credentials_or_none(gcp_credentials)` (`metadata.utils.credentials`).
  A missing, empty or whitespace-only `impersonateServiceAccount` counts as unset and yields `None`,
  so the client resolves the base identity exactly as before.
- GCS file readers take their identity from the client they are handed, via
  `get_gcsfs_auth_options(client)` (`metadata.readers.file.gcs`), which reads the client's
  `_credentials` (google-cloud-storage has no public accessor). `MultiProjectClient` sets
  `_credentials` itself because the storage sampler hands the wrapper, not a `storage.Client`, to
  the readers.
- The impersonated gcsfs path passes `skip_instance_cache=True`. fsspec's process-wide filesystem
  cache is unbounded and keyed on the credentials object; the profiler and samplers rebuild the
  connection per entity, so caching would leak one filesystem per entity. The non-impersonated path
  returns `{}` and keeps gcsfs' default auth and caching.
- CloudSQL is excluded: IAM DB auth would log in as the target account, changing the database user,
  and needs its own design.

## Consequences
- Upgrade behaviour change: a user who set `gcpImpersonateServiceAccount` but relied on the base
  account (because the field was ignored) now impersonates, and needs
  `roles/iam.serviceAccountTokenCreator` on the target plus the IAM Credentials API enabled.
- A new GCS-backed client or reader must route through these two helpers; building a client without
  `credentials=` or opening gcsfs without the client's options silently falls back to the base identity.
- BigQuery, Pub/Sub, Google Drive and Airflow still carry their own drifted copies of this logic
  (Drive does not strip a blank target); moving them onto the shared helper is a follow-up that
  complies with this record.
- If google-cloud-storage removes `Client._credentials`, the reader tests (which build a real
  `storage.Client`) fail and the accessor must change.
