---
title: How to set up bots
slug: /how-to-guides/feature-configurations/bots
---

# How to set up bots when SSO is configured

In the 0.12.1 version, `AIRFLOW_AUTH_PROVIDER` and `OM_AUTH_AIRFLOW_{AUTH_PROVIDER}` parameters are not needed to configure
how the ingestion is performed from Airflow when our OpenMetadata server is secured. This can be achieved directly from UI
through the _Bots_ configuration in the settings page.

By default, `ingestion-bot` is going to be the default account used for any ingestion pipeline deployed from the UI. To set 
up the `ingestion-bot` from UI. Go to `Settings` > `Bots`. In the following example we are going to show how to configure it
for Google SSO, but it can apply to any SSO.

- Click on `ingestion-bot`:

<Image src="/images/how-to-guides/feature-configurations/bots/click-bot.png" alt="click-bot" caption="Click on 'ingestion-bot'"/>

- In case you are configuring a bot with an SSO service account for the first time, please revoke first the default auto 
generated JWT Token by clicking the "**Revoke**" button:

<Image src="/images/how-to-guides/feature-configurations/bots/revoke-jwt-token.png" alt="revoke-jwt-toke" caption="Revoke JWT Token"/>

- Then, click on "**Generate New Token**":

<Image src="/images/how-to-guides/feature-configurations/bots/generate-new-token.png" alt="generate-new-token" caption="Generate New Token to edit"/>

- Select your configured SSO from the list. In this case, `Google SSO`.

<Image src="/images/how-to-guides/feature-configurations/bots/select-google-sso.png" alt="select-google-sso" caption="Select 'Google SSO'"/>

- Configure it with your SSO values. Ensure that the account email of your SSO matches the service account name of the 
bot.

<Image src="/images/how-to-guides/feature-configurations/bots/configure-bot.png" alt="configure-bot" caption="Configure the ingestion-bot with your SSO values"/>

### Notes:

**1. `ingestion-bot`**

The `ingestion-bot` bot is created (or updated if it already exists) as a system bot that cannot be deleted, and
the credentials used for this bot, if they did not exist before, will be the ones present in the OpenMetadata configuration.
Otherwise, a JWT Token will be generated to be the default authentication mechanism of the `ingestion-bot`.

**2. JWT Token auth mechanism**

If you decide to configure a JWT Token for the authentication mechanism ensure that you have also the value `http://localhost:8585/api/v1/system/config/jwks`
in your `publicKeyUrls` list:

- For **bare metal** configuration:

```yaml
authenticationConfiguration:
  provider: "google"
  publicKeyUrls:
    - "https://www.googleapis.com/oauth2/v3/certs"
    - "http://localhost:8585/api/v1/system/config/jwks"
```

- For **docker** configuration, the value to be updated is `AUTHENTICATION_PUBLIC_KEYS`:

```bash
AUTHENTICATION_PUBLIC_KEYS=[https://www.googleapis.com/oauth2/v3/certs, http://localhost:8585/api/v1/system/config/jwks]
```

- In the case of **kubernetes**, you have to update `publicKeys` values:

```yaml
global:
  authentication:
    publicKeys:
      - "https://www.googleapis.com/oauth2/v3/certs"
      - "http://localhost:8585/api/v1/system/config/jwks" 
```

**3. Redeploying ingestion pipelines**

When the `ingestion-bot` is updated, we must redeploy our ingestion pipelines since the credentials used by the bot have been updated,
and they will no longer be valid.

