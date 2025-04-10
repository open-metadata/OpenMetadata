---
title: Hybrid Ingestion Runner
slug: /getting-started/day-1/hybrid-saas/hybrid-ingestion-runner.md
collate: true
---

# Hybrid Ingestion Runner

The **Hybrid Ingestion Runner** is a component designed to enable Collate customers operating in hybrid environments to securely execute ingestion workflows within their own cloud infrastructure. In this setup, your SaaS instance is hosted on Collate’s cloud, while the workflows are going to deployed and executed within your private cloud. The Hybrid Runner acts as a bridge between these two environments, allowing ingestion workflows to be triggered and managed remotely—without requiring the customer to share secrets or sensitive credentials with Collate. It securely receives workflow execution requests and orchestrates them locally, maintaining full control and data privacy within the customer’s environment.

## Prerequisites

Before setting up the Hybrid Ingestion Runner, ensure the following:

- Hybrid Runner has been setup. Contact the Collate team for assistance with setting up the Hybrid Runner in your infrastructure.
- Secrets manager configured on your cloud.

## Configuration Steps for Admins

Once your DevOps team has installed and configured the Hybrid Runner, follow these steps as a Collate Admin to configure services and manage ingestion workflows.

### 1. Validate Hybrid Runner Setup

- Go to **Settings > Preferences > Ingestion Runners** in the Collate UI.
- Look for your runner in the list.
- The status should display as **Connected**.

> If the runner is not connected, reach out to Collate support.

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

> Even if you're operating in hybrid mode, you can still choose "Collate SaaS Runner" to run the ingestion workflow within Collate's SaaS environment.

### 3. Manage Secrets Securely

When executing workflows on your Hybrid environment, you have to use your existing cloud provider's Secrets Manager to store sensitive credentials (like usernames and passwords), and reference them securely in Collate via the Hybrid Runner.

Collate never stores or accesses these secrets directly—only the Hybrid Runner retrieves them at runtime from your own infrastructure.

**Steps:**

- Create your secret in your Secrets Manager of choice:
  - **AWS Secrets Manager**
  - **Azure Key Vault**
  - **GCP Secret Manager**

- In the service connection form in Collate, reference the secret using the `secret:` prefix followed by the full path to your secret.

📌 **For example, in AWS Secrets Manager**, if your secret is stored at:
```arn:aws:secretsmanager:us-east-1:123456789012:secret:my/database/credentials```

And inside that secret, you have `username` and `password` keys, the reference in Collate would look like:

```yaml
username: secret:/my/database/credentials/username
password: secret:/my/database/credentials/password
```

{% image
src="/images/v1.7/getting-started/ingestion-runner-service.png"
/%}


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
