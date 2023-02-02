---
title: Custom OIDC SSO
slug: /deployment/security/custom-oidc
---

# Custom OIDC SSO

Follow the sections in this guide to set up Custom OIDC SSO.

## Create Server Credentials

- Go to the console of your preferred custom OIDC SSO provider
- Create an OIDC client application with implicit flow enabled to get a client ID.

### Create Client ID and Secret Key

- Navigate to your preferred OIDC provider console and create an OIDC client application.
- Generate client ID and secret key in JSON format.

After the applying these steps, you can update the configuration of your deployment:

<InlineCalloutContainer>
  <InlineCallout
    color="violet-70"
    icon="celebration"
    bold="Docker Security"
    href="/deployment/security/custom-oidc/docker"
  >
    Configure Custom OIDC SSO for your Docker Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="storage"
    bold="Bare Metal Security"
    href="/deployment/security/custom-oidc/bare-metal"
  >
    Configure Custom OIDC SSO for your Bare Metal Deployment.
  </InlineCallout>
  <InlineCallout
    color="violet-70"
    icon="fit_screen"
    bold="Kubernetes Security"
    href="/deployment/security/custom-oidc/kubernetes"
  >
    Configure Custom OIDC SSO for your Kubernetes Deployment.
  </InlineCallout>
</InlineCalloutContainer>

## Configure Ingestion

After everything has been set up, you will need to configure your workflows if you are running them via the
`metadata` CLI or with any custom scheduler.

When setting up the YAML config for the connector, update the `workflowConfig` as follows:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: custom-oidc
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

<Important>

<h4> Security Note </h4>

<br/>

For **production** environment, please:
- **DELETE** de admin default account shipped by OM in case you had [Basic Authentication](/deployment/security/basic-auth)
  enabled before configuring the authentication with Custom OIDC SSO.
- **UPDATE** the Private / Public keys used for the [JWT Tokens](/deployment/security/enable-jwt-tokens) in case it is
  enabled.

</Important>