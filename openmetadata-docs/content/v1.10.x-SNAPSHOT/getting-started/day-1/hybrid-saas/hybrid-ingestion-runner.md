---
title: Hybrid Ingestion Runner | Secure Metadata Workflows in Your Cloud
description: Learn to configure and manage Hybrid Ingestion Runner to securely execute workflows in your cloud using AWS, Azure, or GCP secrets—without exposing credentials.
slug: /getting-started/day-1/hybrid-saas/hybrid-ingestion-runner
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
src="/images/v1.10/getting-started/ingestion-runner-preferences.png"
/%}

{% image
src="/images/v1.10/getting-started/ingestion-runner-list.png"
/%}

### 2. Create a New Service

- Navigate to **Settings > Services**.
- Click **+ Add New Service**.
- Fill in the service details.
- In the “Ingestion Runner” dropdown, choose the hybrid runner.

{% image
src="/images/v1.10/getting-started/ingestion-runner-service.png"
/%}

> Even if you're operating in hybrid mode, you can still choose "Collate SaaS Runner" to run the ingestion workflow within Collate's SaaS environment.

### 3. Manage Secrets Securely

When executing workflows on your Hybrid environment, you have to use your existing cloud provider's Secrets Manager to store sensitive credentials (like passwords or token), and reference them securely in Collate via the Hybrid Runner.

Collate never stores or accesses these secrets directly—only the Hybrid Runner retrieves them at runtime from your own infrastructure.

**Steps:**

- Create your secret in your Secrets Manager of choice:
  - **AWS Secrets Manager**
  - **Azure Key Vault**
  - **GCP Secret Manager**

When creating a secret, store the value as-is (e.g., `password123`) without any additional formatting or encoding. The Hybrid Runner will handle the retrieval and decryption of the secret value at runtime.
For example, in AWS Secrets Manager, you can click on `Store a new secret` > `Other type of secret` > `Plaintext`. You need to paste the secret as-is, without any other formatting (such as quotes, JSON, etc.).

{% image
src="/images/v1.10/getting-started/hybrid-create-secret.png"
/%}

Finally, in the service connection form in Collate, reference the secret using the `secret:` prefix followed by the full path to your secret.

📌 **For example, in AWS Secrets Manager**, if your secret is stored at: `/my/database/password`, you would reference it in the service connection form as:

```yaml
password: secret:/my/database/password
```

{% note %}

Note that this approach to handling secrets only works for values that are considered secrets in the connection form.

You can identify these values since they mask the typing and have an icon on the right that toggles showing or hiding the input values.

{% /note %}
