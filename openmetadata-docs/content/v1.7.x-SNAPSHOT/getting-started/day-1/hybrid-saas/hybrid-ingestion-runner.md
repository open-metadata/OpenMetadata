---
title: Hybrid Ingestion Runner
slug: /getting-started/day-1/hybrid-saas/hybrid-ingestion-runner.md
collate: true
---

# Hybrid Ingestion Runner

The **Hybrid Ingestion Runner** is a component designed to enable Collate customers operating in hybrid environments to securely execute ingestion workflows within their own cloud infrastructure. In this setup, your SaaS instance is hosted on Collate’s cloud, while tools like Argo Workflows are deployed within your private cloud. The Hybrid Runner acts as a bridge between these two environments, allowing ingestion workflows to be triggered and managed remotely—without requiring the customer to share secrets or sensitive credentials with Collate. It securely receives workflow execution requests and orchestrates them locally, maintaining full control and data privacy within the customer’s environment.

## Prerequisites

Before setting up the Hybrid Ingestion Runner, ensure the following:

- Your Collate SaaS instance is available.
- You have **[Argo Workflows](https://argoproj.github.io/workflows/)** deployed in your own cloud environment.
- Network access between your own cloud and Collate SaaS server (outbound traffic from your cloud to Collate).
- Java 17+ for the runner.
- Docker.
- Secrets manager configured on your cloud.

## Configuration Steps for Admins

Once your DevOps team has installed and configured the Hybrid Runner, follow these steps as a Collate Admin to configure services and manage ingestion workflows.

### 1. Validate Hybrid Runner Setup

- Go to **Settings > Preferences > Ingestion Runners** in the Collate UI.
- Look for your runner in the list.
- The status should display as **Connected**.

> If the runner is not connected, check your network/firewall configuration and validate the token/environment variables.

{% image
src="/images/v1.7/getting-started/ingestion-runner-preferences.png"
/%}

{% image
src="/images/v1.7/getting-started/ingestion-runner-list.png"
/%}

### 2. Create a New Service

- Navigate to **Settings > Services**.
- Click **+ Add New Service**.
- Fill in the service details.
- In the “Ingestion Runner” dropdown, choose the hybrid runner.

{% image
src="/images/v1.7/getting-started/ingestion-runner-service.png"
/%}

> Choose "CollateSaaS" to run ingestion workflows within Collate’s SaaS environment, even if you're operating in hybrid mode.

### 3. Manage Secrets Securely

Use your existing secrets manager to store credentials and reference them securely in Collate.

**Steps:**

- Create the secret in your secrets manager:
  - AWS Secrets Manager
  - Azure Key Vault
  - GCP Secret Manager
- In the connection form, use the `secret:` prefix to reference the path:

```yaml
username: secret:/my/database/username
password: secret:/my/database/password
```

{% image
src="/images/v1.7/getting-started/ingestion-runner-service.png"
/%}

> *Collate never stores or reads your secrets directly. The Hybrid Runner fetches them at runtime locally.*

## Troubleshooting

### The agent is not connecting to the server

- Ensure the server URL contains the `wss://` protocol.
- Your cloud has outbound traffic to Collate.
- `AUTH_TOKEN` contains a valid access token.

### Ingestion workflows are failing in Argo

- Check the `ARGO_INGESTION_IMAGE` has a valid image name and tag.
- Contact Collate support if needed.

### The runner is not able to trigger ingestion

- Verify the `ARGO_EXTRA_ENVS` variable contains the correct keys for the secrets manager.

### General Troubleshooting Table

| Issue                | Solution                                              |
|----------------------|--------------------------------------------------------|
| Runner not connected | Check token, endpoint, and network config              |
| Secret not resolved  | Verify path and permissions in Secrets Manager         |
| Ingestion stuck or failed | Check Argo logs and verify credentials and runner status |
