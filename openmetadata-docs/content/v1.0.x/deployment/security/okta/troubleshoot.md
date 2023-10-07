---
title: Toubleshooting Okta SSO
slug: /deployment/security/okta/troubleshoot
---

# Troubleshooting Okta SSO

### Troubleshooting Ingesion with Okta SSO via CLI or Ariflow

- **AuthenticationException**: During metadata ingestion process if you face the see the error `AuthenticationException` with message `Could not fetch the access token please validate the orgURL & clientId in configuration`, One of the possible reason for this error could be that you are passing incorrect `clientId` in the `securityConfig`, Make sure you are passing `clientId` of the Ingestion Client (i.e the service application) and not the Single Page Application. If the `clientId` provided is correct and you are still facing this error then please also validate the `orgURL`, expected value for `orgURL` field is `<ISSUER-URL>/v1/token`

- **RSA key format is not supported**: If you are getting the error as `RSA key format is not supported`, this might be due to incorrect `privateKey` passed in the `securityConfig` configuration for ingestion. The `privateKey` field refers to the `public/private keypair` please refer to step 1 of `Creating Service Application`. A sample configuration for `privateKey` looks like as follows:
```
securityConfig:
    clientId: <Ingestion Client ID>
    orgURL: <Issuer URL>/v1/token
    privateKey: '{ "p": "<value>", "kty": "RSA", "q": "<value>", "d": "<value>", "e": "AQAB", "use": "sig", "kid": "<value>", "qi": "<value>", "dp": "<value>", "alg": "RS256", "dq": "<value>", "n": "<value>" }'
    email: <email>
```

- **User instance not found**: If you are getting an error as `user instance for <client id> not found`, this is because you might not have added Ingestion Okta Service Application clientId in principles. Please refer to the configuration for your deployment.
