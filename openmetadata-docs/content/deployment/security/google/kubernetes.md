---
title: Google SSO for Kubernetes
slug: /deployment/security/google/kubernetes
---

# Google SSO for Kubernetes

Check the Helm information [here](https://artifacthub.io/packages/search?repo=open-metadata).

Once the `Client Id` and `Client Secret` are generated, see the snippet below for an example of where to
place the client id value and update the authorizer configurations in the `values.yaml`.

### Before 0.12.1

```yaml
global:
  authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
    initialAdmins:
      - "user1"
      - "user2"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "google"
    publicKeys:
      - "https://www.googleapis.com/oauth2/v3/certs"
    authority: "https://accounts.google.com"
    clientId: "{client id}"
    callbackUrl: "http://localhost:8585/callback"
  airflow:
    openmetadata:
      authProvider: "google"
      google:
        # absolute path of secret file on airflow instance
        secretKeyPath: ""
        audience: "https://www.googleapis.com/oauth2/v4/token"
```

### After 0.12.1

```yaml
global:
  authorizer:
    className: "org.openmetadata.service.security.DefaultAuthorizer"
    containerRequestFilter: "org.openmetadata.service.security.JwtFilter"
    initialAdmins:
      - "user1"
      - "user2"
    botPrincipals:
      - "<service_application_client_id>"
    principalDomain: "open-metadata.org"
  authentication:
    provider: "google"
    publicKeys:
      - "https://www.googleapis.com/oauth2/v3/certs"
    authority: "https://accounts.google.com"
    clientId: "{client id}"
    callbackUrl: "http://localhost:8585/callback"
```

**Note:** Follow [this](/how-to-guides/feature-configurations/bots) guide to configure the `ingestion-bot` credentials for
ingesting data from Airflow.