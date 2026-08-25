[🏠 Home](./README.md) > **Integration**

# Integration

> **1 Components** | **7 Files** | **61 Tests** | **66 Scenarios** 🚀

## Table of Contents
- [Connectors](#connectors)

---

<div id="connectors"></div>

## Connectors

<details open>
<summary>📄 <b>ServiceIngestion.spec.ts</b> (47 tests, 48 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/nightly/ServiceIngestion.spec.ts)

### Api Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Api Service** - Create & Ingest Api Service service | Tests service creation and first ingestion run  Creates the service and triggers ingestion |
| 2 | **Api Service** - Update description and verify description after re-run | Tests description update persistence across reruns  Updates service description and verifies it after rerun |
| 3 | **Api Service** - Update schedule options and verify | Tests schedule option updates  Updates ingestion schedule options and verifies they persist |
| 4 | **Api Service** - Delete Api Service service | Tests service deletion flow  Deletes the service and validates removal |

### Metabase Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Metabase Service** - Create & Ingest Metabase Service service | Tests service creation and first ingestion run  Creates the service and triggers ingestion |
| 2 | **Metabase Service** - Update description and verify description after re-run | Tests description update persistence across reruns  Updates service description and verifies it after rerun |
| 3 | **Metabase Service** - Update schedule options and verify | Tests schedule option updates  Updates ingestion schedule options and verifies they persist |
| 4 | **Metabase Service** - Delete Metabase Service service | Tests service deletion flow  Deletes the service and validates removal |

### Mysql Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Mysql Service** - Create & Ingest Mysql Service service | Tests service creation and first ingestion run  Creates the service and triggers ingestion |
| 2 | **Mysql Service** - Update description and verify description after re-run | Tests description update persistence across reruns  Updates service description and verifies it after rerun |
| 3 | **Mysql Service** - Update schedule options and verify | Tests schedule option updates  Updates ingestion schedule options and verifies they persist |
| 4 | **Mysql Service** - Service specific tests | Tests database-specific ingestion behaviors  Runs additional checks for Postgres, Redshift, and MySQL services |
| 5 | **Mysql Service** - Delete Mysql Service service | Tests service deletion flow  Deletes the service and validates removal |

### BigQuery Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **BigQuery Service** - Create & Ingest BigQuery Service service | Tests service creation and first ingestion run  Creates the service and triggers ingestion |
| 2 | **BigQuery Service** - Update description and verify description after re-run | Tests description update persistence across reruns  Updates service description and verifies it after rerun |
| 3 | **BigQuery Service** - Update schedule options and verify | Tests schedule option updates  Updates ingestion schedule options and verifies they persist |
| 4 | **BigQuery Service** - Delete BigQuery Service service | Tests service deletion flow  Deletes the service and validates removal |

### Kafka Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Kafka Service** - Create & Ingest Kafka Service service | Tests service creation and first ingestion run  Creates the service and triggers ingestion |
| 2 | **Kafka Service** - Update description and verify description after re-run | Tests description update persistence across reruns  Updates service description and verifies it after rerun |
| 3 | **Kafka Service** - Update schedule options and verify | Tests schedule option updates  Updates ingestion schedule options and verifies they persist |
| 4 | **Kafka Service** - Delete Kafka Service service | Tests service deletion flow  Deletes the service and validates removal |

### MlFlow Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **MlFlow Service** - Create & Ingest MlFlow Service service | Tests service creation and first ingestion run  Creates the service and triggers ingestion |
| 2 | **MlFlow Service** - Update description and verify description after re-run | Tests description update persistence across reruns  Updates service description and verifies it after rerun |
| 3 | **MlFlow Service** - Update schedule options and verify | Tests schedule option updates  Updates ingestion schedule options and verifies they persist |
| 4 | **MlFlow Service** - Delete MlFlow Service service | Tests service deletion flow  Deletes the service and validates removal |

### Superset Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Superset Service** - Create & Ingest Superset Service service | Tests service creation and first ingestion run  Creates the service and triggers ingestion |
| 2 | **Superset Service** - Update description and verify description after re-run | Tests description update persistence across reruns  Updates service description and verifies it after rerun |
| 3 | **Superset Service** - Update schedule options and verify | Tests schedule option updates  Updates ingestion schedule options and verifies they persist |
| 4 | **Superset Service** - Delete Superset Service service | Tests service deletion flow  Deletes the service and validates removal |

### Postgres Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Postgres Service** - Create & Ingest Postgres Service service | Tests service creation and first ingestion run  Creates the service and triggers ingestion |
| 2 | **Postgres Service** - Update description and verify description after re-run | Tests description update persistence across reruns  Updates service description and verifies it after rerun |
| 3 | **Postgres Service** - Update schedule options and verify | Tests schedule option updates  Updates ingestion schedule options and verifies they persist |
| 4 | **Postgres Service** - Service specific tests | Tests database-specific ingestion behaviors  Runs additional checks for Postgres, Redshift, and MySQL services |
| 5 | **Postgres Service** - Delete Postgres Service service | Tests service deletion flow  Deletes the service and validates removal |

### Redshift Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Redshift Service** - Create & Ingest Redshift Service service | Tests service creation and first ingestion run  Creates the service and triggers ingestion |
| 2 | **Redshift Service** - Update description and verify description after re-run | Tests description update persistence across reruns  Updates service description and verifies it after rerun |
| 3 | **Redshift Service** - Update schedule options and verify | Tests schedule option updates  Updates ingestion schedule options and verifies they persist |
| 4 | **Redshift Service** - Service specific tests | Tests database-specific ingestion behaviors  Runs additional checks for Postgres, Redshift, and MySQL services |
| 5 | **Redshift Service** - Delete Redshift Service service | Tests service deletion flow  Deletes the service and validates removal |

### Airflow Service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Airflow Service** - Create & Ingest Airflow Service service | Tests service creation and first ingestion run  Creates the service and triggers ingestion |
| 2 | **Airflow Service** - Update description and verify description after re-run | Tests description update persistence across reruns  Updates service description and verifies it after rerun |
| 3 | **Airflow Service** - Update schedule options and verify | Tests schedule option updates  Updates ingestion schedule options and verifies they persist |
| 4 | **Airflow Service** - Delete Airflow Service service | Tests service deletion flow  Deletes the service and validates removal |

### Service form

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Service form** - name field should throw error for invalid name | Tests validation for invalid service names  Ensures required and character constraints surface errors on the name field |

### Service Ingestion Pagination

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Service Ingestion Pagination** - Default Pagination size should be 15 | Tests default ingestion pagination size  Verifies ingestion pipelines load with a default page size of 15 |

### Agent Run History - Last 5 Runs Visible

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Agent Run History - Last 5 Runs Visible** - Create MySQL service and ingest metadata | Create MySQL service and ingest metadata |
| 2 | **Agent Run History - Last 5 Runs Visible** - Run metadata agent 5 times and verify all run statuses are visible | Tests that all 5 run statuses are visible in the UI after running the metadata agent 5 times.  Validates the fix for #25800 — agent status shows true last 5 runs |
| | ↳ *Trigger and wait for run ${...}* | |
| | ↳ *Verify all 5 run statuses are visible in the UI* | |

</details>

<details open>
<summary>📄 <b>ServiceCreationPermissions.spec.ts</b> (6 tests, 6 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/ServiceCreationPermissions.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ServiceCreationPermissions.spec.ts)

### Service Creation with isOwner() Permissions

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Service Creation with isOwner() Permissions** - User with service creation permission can create a new database service | User with service creation permission can create a new database service |
| 2 | **Service Creation with isOwner() Permissions** - User can view but cannot modify services they do not own | User can view but cannot modify services they do not own |
| 3 | **Service Creation with isOwner() Permissions** - User can update connection details of their own service | User can update connection details of their own service |
| 4 | **Service Creation with isOwner() Permissions** - Different user can view but cannot modify service owned by another user | Different user can view but cannot modify service owned by another user |
| 5 | **Service Creation with isOwner() Permissions** - Owner can delete their own service | Owner can delete their own service |
| 6 | **Service Creation with isOwner() Permissions** - Owner can update description of their service | Owner can update description of their service |

</details>

<details open>
<summary>📄 <b>ServiceForm.spec.ts</b> (4 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/ServiceForm.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ServiceForm.spec.ts)

### Service form functionality

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Service form functionality** - Verify form selects are working properly | Form selects are working properly |
| 2 | **Service form functionality** - Verify SSL cert upload with long filename and UI overflow handling | SSL cert upload with long filename and UI overflow handling |
| 3 | **Service form functionality** - Verify service name field validation errors | Service name field validation errors |
| 4 | **Service form functionality** - Verify if string input inside oneOf config works properly | If string input inside oneOf config works properly |

</details>

<details open>
<summary>📄 <b>ApiCollection.spec.ts</b> (1 tests, 2 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/ApiCollection.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiCollection.spec.ts)

### API Collection Entity Special Test Cases

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **API Collection Entity Special Test Cases** - Verify Owner Propagation: owner should be propagated to the API Collection's API Endpoint | Owner Propagation: owner should be propagated to the API Collection's API Endpoint |
| | ↳ *Verify user Owner Propagation: owner should be propagated to the API Collection's API Endpoint* | |
| | ↳ *Verify team Owner Propagation: owner should be propagated to the API Collection's API Endpoint* | |

</details>

<details open>
<summary>📄 <b>ApiServiceRest.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/ApiServiceRest.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/ApiServiceRest.spec.ts)

### API service

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **API service** - add update and delete api service type REST | Add update and delete api service type REST |

</details>

<details open>
<summary>📄 <b>IngestionBot.spec.ts</b> (1 tests, 4 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Flow/IngestionBot.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Flow/IngestionBot.spec.ts)

### Ingestion Bot 

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Ingestion Bot ** - Ingestion bot should be able to access domain specific domain | Ingestion bot should be able to access domain specific domain |
| | ↳ *Assign assets to domains* | |
| | ↳ *Ingestion bot should access domain assigned assets* | |
| | ↳ *Assign services to domains* | |
| | ↳ *Ingestion bot should access domain assigned services* | |

</details>

<details open>
<summary>📄 <b>ServiceListing.spec.ts</b> (1 tests, 1 scenarios)</summary>

> Source: [`src/main/resources/ui/playwright/e2e/Pages/ServiceListing.spec.ts`](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/ServiceListing.spec.ts)

### Service Listing

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | **Service Listing** - should render the service listing page | Render the service listing page |

</details>


---

