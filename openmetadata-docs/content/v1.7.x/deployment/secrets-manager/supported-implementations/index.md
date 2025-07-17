---
title: Secrets Manager | OpenMetadata Deployment Integration
description: Review supported secrets manager implementations to securely manage sensitive credentials across cloud and hybrid environments.
slug: /deployment/secrets-manager/supported-implementations
collate: false
---

# Supported implementations

This is our list of supported Secrets Manager implementations:

{% inlineCalloutContainer %}
  {% inlineCallout
    color="violet-70"
    bold="AWS Secrets Manager"
    icon="vpn_key"
    href="/deployment/secrets-manager/supported-implementations/aws-secrets-manager" %}
    AWS Secrets Manager
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    bold="AWS Systems Manager Parameter Store"
    icon="vpn_key"
    href="/deployment/secrets-manager/supported-implementations/aws-ssm-parameter-store" %}
    AWS Systems Manager Parameter Store
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    bold="Azure Key Vault"
    icon="vpn_key"
    href="/deployment/secrets-manager/supported-implementations/azure-key-vault" %}
    Azure Key Vault
  {% /inlineCallout %}
  {% inlineCallout
    color="violet-70"
    bold="GCP Secrets Manager"
    icon="vpn_key"
    href="/deployment/secrets-manager/supported-implementations/gcp-secret-manager" %}
    GCP Secrets Manager
  {% /inlineCallout %}
{% /inlineCalloutContainer %}