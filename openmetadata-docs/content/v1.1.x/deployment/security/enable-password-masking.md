---
title: Enable password masking
slug: /deployment/security/enable-password-masking
---

# Enable password masking

The **1.0.0** version of OpenMetadata now includes a new feature that allows users to activate password masking. 
This feature was added in response to feedback from our community of users who expressed concerns about the security of
their passwords when using our application.

With the password masking feature enabled, all API calls made by your application will replace the password fields with 
asterisks (*) before sending the request. This will prevent the password from being sent in plain text. Even though 
passwords are replaced by asterisks, it will not affect when editing a connection, saving will update the passwords only 
if they are changed.

{% image
caption="Editing a service connection with masked password."
src="/images/v1.1/deployment/mask-password/edit-connection.png"
alt="mask-password" /%}

However, note that the `ingestion-bot` user will still send the password in plain text as it needs to access the API 
without any obstructions. This is because the `ingestion-bot` user requires full access to the API, and any masking 
would hinder its ability to perform its tasks.

{% note %}

In future releases, the password masking feature will be activated by default.

The feature will be automatically enabled to provide an added layer of security for all API calls made.

{% /note %}

## How to enable the feature

To activate the password masking feature in your application, follow the steps below:

### Docker

Add the following environment variable to the list:

```yaml
# openmetadata.prod.env
MASK_PASSWORDS_API=true
```

### Bare Metal

Edit the `openmetadata.yaml` file as it is shown below:

```yaml
security:
  maskPasswordsAPI: true
```

### Kubernetes

Update your helm `maskPasswordsApi` value:

```yaml
# openmetadata.prod.values.yml
openmetadata:
  config:
  ...
    maskPasswordsApi: true
  ...
```