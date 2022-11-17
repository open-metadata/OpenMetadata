---
title: Datalake Connector Troubleshooting
slug: /connectors/database/bigquery/troubleshoot
---

# Troubleshooting

Learn how to resolve the most common problems people encounter in the BigQuery connector.

### How to pass multiple ProjectID ?
* Case 1 (From `CLI`)
    ```yaml
    source:
        type: bigquery
        serviceName: local_bigquery_101
        serviceConnection:
            config:
            type: BigQuery
            credentials:
                gcsConfig:
                type: account-type
                projectId: ["project-id-1","project-id-2"]
                privateKeyId: private-key
                privateKey: "\n-----BEGIN PRIVATE KEY-----\KEY\n-----END PRIVATE KEY-----\n"
                clientEmail: client@mail.com
                clientId: 1234
                # authUri: https://accounts.google.com/o/oauth2/auth (default)
                # tokenUri: https://oauth2.googleapis.com/token (default)
                # authProviderX509CertUrl: https://www.googleapis.com/oauth2/v1/certs (default)
                clientX509CertUrl: https://cert.url
        sourceConfig:
            config:
            type: DatabaseMetadata
    sink:
        type: metadata-rest
        config: {}
    workflowConfig:
        openMetadataServerConfig:
            hostPort: http://localhost:8585/api
            authProvider: no-auth
            securityConfig:
                jwtToken: "token"


* Case 2 (From `UI`)
    * Select `Multiple Project ID` option and click on the `+` button for how many project id you want to add.
        <Image
            src="/images/openmetadata/connectors/bigquery/multiple-project-id.png"
            alt="Test Connection"
            caption="Multiple Project ID"
        />
   


