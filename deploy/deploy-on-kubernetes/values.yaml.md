---
description: This page list all the supported helm values for OpenMetadata Helm Charts
---

# Values.yaml

### Global Chart Values

| Key                                                | Type   | Default                                          | Description                                                                                                                                     |
| -------------------------------------------------- | ------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| global.authentication.provider                     | string | no-auth                                          | Possible Values can be no-auth, okta, google, auth0, azure                                                                                      |
| global.authentication.publicKey                    | string | Empty String                                     | Endpoint URL to Auth Provider Public Key                                                                                                        |
| global.authentication.authority                    | string | Empty String                                     | Authority Endpoint URL of Auth Provider                                                                                                         |
| global.authentication.clientId                     | string | Empty String                                     | Application Client Identifier                                                                                                                   |
| global.authentication.callbackUrl                  | string | Empty String                                     | OpenMetadata Auth Callback URL                                                                                                                  |
| global.authorizer.className                        | string | org.openmetadata.catalog.security.NoopAuthorizer | Possible values can be "org.openmetadata.catalog.security.NoopAuthorizer", "org.openmetadata.catalog.security.DefaultAuthorizer"                |
| global.authorizer.containerRequestFilter           | string | org.openmetadata.catalog.security.NoopFilter     | Possible values can be "org.openmetadata.catalog.security.NoopFilter", "org.openmetadata.catalog.security.JwtFilter"                            |
| global.authorizer.initialAdmin                     | string | admin                                            | Principal name to be the initial Admin of OpenMetadata UI                                                                                       |
| global.authorizer.botPrincipal                     | string | ingestion-bot                                    |                                                                                                                                                 |
| global.authorizer.principalDomain                  | string | open-metadata.org                                |                                                                                                                                                 |
| global.airflow.auth.password.secretRef             | string | `airflow-secrets`                                | The reference to a secret containing airflow authentication password wrapped in `kubernetes secrets.`Required global.airflow.enabled is 'true'. |
| global.airflow.auth.password.secretKey             | string | openmetadata-airflow-password                    | The key of a secret containing airflow authentication password wrapped in `kubernetes secrets.`Required global.airflow.enabled is 'true'.       |
| global.airflow.auth.username                       | string | `admin`                                          | Username for airflow configuration. Required global.airflow.enabled is 'true'.                                                                  |
| global.airflow.enabled                             | bool   | `true`                                           | Whether airflow configuration is enabled.                                                                                                       |
| global.airflow.host                                | string | `airflow`                                        | Airflow Endpoint URI.                                                                                                                           |
| global.airflow.port                                | int    | 8080                                             | Airflow Endpoint URI port.                                                                                                                      |
| global.elasticsearch.host                          | string | `elasticsearch`                                  |                                                                                                                                                 |
| global.elasticsearch.port                          | int    | 9200                                             |                                                                                                                                                 |
| global.elasticsearch.scheme                        | string | `http`                                           |                                                                                                                                                 |
| global.elasticsearch.auth.password.secretRef       | string | elasticsearch-secrets                            |                                                                                                                                                 |
| global.elasticsearch.auth.password.secretKey       | string | openmetadata-elasticsearch-password              |                                                                                                                                                 |
| global.elasticsearch.trustStore.enabled            | bool   | false                                            |                                                                                                                                                 |
| global.elasticsearch.trustStore.path               | string | Empty String                                     |                                                                                                                                                 |
| global.elasticsearch.trustStore.password.secretRef | string | elasticsearch-truststore-secrets                 |                                                                                                                                                 |
| global.elasticsearch.trustStore.password.secretKey | string | openmetadata-elasticsearch-truststore-password   |                                                                                                                                                 |
| global.mysql.auth.password.secretRef               | string | `mysql-secrets`                                  | The reference to a secret containing mysql authentication password wrapped in `kubernetes secrets`                                              |
| global.mysql.auth.password.secretKey               | string | `openmetadata-mysql-password`                    | The key of a secret  containing mysql authentication password wrapped in `kubernetes secrets`                                                   |
| global.mysql.auth.username                         | string | `openmetadata_user`                              | Username for mysql openmetadata configuration                                                                                                   |
| global.mysql.databaseName                          | string | `openmetadata_db`                                | Database Name for mysql openmetadata configuration                                                                                              |
| global.mysql.host                                  | string | `mysql`                                          |                                                                                                                                                 |
| global.mysql.port                                  | int    | 3306                                             |                                                                                                                                                 |
| global.openmetadata.adminPort                      | int    | 8586                                             |                                                                                                                                                 |
| global.openmetadata.host                           | string | `openmetadata`                                   |                                                                                                                                                 |
| global.openmetadata.port                           | int    | 8585                                             |                                                                                                                                                 |

### Chart Values

| Key                                | Type                                                                                                | Default                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------- |
| affinity                           | object                                                                                              | `{}`                    |
| extraEnvs                          | Extra \[environment variables]\[] which will be appended to the `env:` definition for the container | `[]`                    |
| extraVolumes                       | Templatable string of additional `volumes` to be passed to the `tpl` function                       | ""                      |
| extraVolumeMounts                  | Templatable string of additional `volumeMounts` to be passed to the `tpl` function                  | ""                      |
| fullnameOverride                   | string                                                                                              | `"openmetadata"`        |
| image.pullPolicy                   | string                                                                                              | `"Always"`              |
| image.repository                   | string                                                                                              | `"openmetadata/server"` |
| image.tag                          | string                                                                                              | `0.8.0`                 |
| imagePullSecrets                   | list                                                                                                | `[]`                    |
| livenessProbe.initialDelaySeconds  | int                                                                                                 | `80`                    |
| livenessProbe.periodSeconds        | int                                                                                                 | `30`                    |
| livenessProbe.failureThreshold     | int                                                                                                 | `5`                     |
| nameOverride                       | string                                                                                              | `""`                    |
| nodeSelector                       | object                                                                                              | `{}`                    |
| podAnnotations                     | object                                                                                              | `{}`                    |
| podSecurityContext                 | object                                                                                              | `{}`                    |
| readinessProbe.initialDelaySeconds | int                                                                                                 | `80`                    |
| readinessProbe.periodSeconds       | int                                                                                                 | `30`                    |
| readinessProbe.failureThreshold    | int                                                                                                 | `5`                     |
| replicaCount                       | int                                                                                                 | `1`                     |
| resources                          | object                                                                                              | `{}`                    |
| securityContext                    | object                                                                                              | `{}`                    |
| service.port                       | int                                                                                                 | `8585`                  |
| service.type                       | string                                                                                              | `"ClusterIP"`           |
| serviceAccount.annotations         | object                                                                                              | `{}`                    |
| serviceAccount.create              | bool                                                                                                | `true`                  |
| serviceAccount.name                | string                                                                                              | `nil`                   |
| tolerations                        | list                                                                                                | `[]`                    |
