---
title: Enable Secrets Manager
slug: /deployment/secrets-manager
---

# Enable Secrets Manager

Secret Manager integrations allow you to use your existing third-party **Key Management Store** (KMS) with OpenMetadata. Your credentials and sensitive information are stored in a tool that you control, and the KMS will mediate between any OpenMetadata internal requirement and sensitive information.

Without a secret manager configured in OpenMetadata, all your sensitive data, such as service connection or auth provider configuration, were stored in MySQL (or Postgres) encrypted.

The following diagram shows how is the process between the OM server and Airflow workflows:

<p/>
<Image src="/images/deployment/secrets-manager/om-secrets-manager-disabled.png" alt="om-secrets-manager-disabled"/>
<p/>

As you can see, the `Workflow` consumed by Airflow contains the service information as an `EntityReference`. We use that reference to read the Service information, including its connection details. This information goes from `Database > OM > Airflow`.

When the Secrets Manager is enabled, sensitive information stop being stored in any system from OpenMetadata. Instead, the KMS will act as a mediator, as we can observe in the diagram below:

<p/>
<Image src="/images/deployment/secrets-manager/om-secrets-manager-enabled.png" alt="om-secrets-manager-enabled"/>
<p/>

In 0.12 and up, OpenMetadata will communicate through an interface to read/write sensitive information -- removing the need to store sensitive data in OM systems. This new interface works whether users keep using the underlying database of OpenMetadata to store credentials (as it was setup thus far) or any external system such as AWS Secrets Manager or AWS SSM Parameter Store.

In future releases, we will add support for additional Key Management Stores, such as Azure Key Vault or Kubernetes Secrets.

If you’d like to contribute by creating the interface, check the implementation guide, or if you want to see a new one on the supported list, please reach out to us on [Slack](https://slack.open-metadata.org/).

If you are interested in enabling the secrets manager feature, this is our list of supported Secrets Manager implementations:

- [AWS Secrets Manager](/deployment/secrets-manager/supported-implementations/aws-secrets-manager)
- [AWS Systems Manager Parameter Store](/deployment/secrets-manager/supported-implementations/aws-ssm-parameter-store)

Things to take into account when enabling the Secrets Manager feature:

1. The migration of all the sensitive data will be done automatically after restarting the OpenMetadata server, which can not be undone for the time being.
2. Only admin users can retrieve or edit the service connections. The connection parameters will be hidden for all other users including bots.
