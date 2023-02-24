---
title: JWT validation Troubleshooting
slug: /deployment/security/jwt-troubleshooting
---
# JWT Troubleshooting

Add the `{domain}:{port}/api/v1/sytem/config/jwks` in the list of publicKeys

```yaml
  authentication:
    provider: "google"
    publicKeys:
    - "https://www.googleapis.com/oauth2/v3/certs"
    - "http://localhost:8585/api/v1/system/config/jwks" (your domain and port)
```

This config with `"http://localhost:8585/api/v1/system/config/jwks"` is the default behavior. If you are configuring and expecting a JWT token to work, configuring with that extra URL is required.

JWT Tokens are issued by private certificates.

We need public keys to decrypt it and get that token's user name, expiry time, etc.

In OpenMetadata users can enable SSO for users to login and use JWT tokens issued by OpenMetadata for bots
The way OpenMetadata issues a JWT Token is using this [config](https://github.com/open-metadata/OpenMetadata/blob/main/conf/openmetadata.yaml#L155). It uses the `rsapublicKeyFilePath` file to generate a token.

When the ingestion workflow uses this token, we use `rsapublicKeyPath` to decrypt it. The way we do this is using the response from this endpoint `http://localhost:8585/api/v1/system/config/jwks`.


## Get JWT token from UI.

First Open Open-Metadata UI than go to settings > Bots > Ingestion Bot

<div className="w-100 flex justify-center">
<Image
  src="/images/deployment/troubleshoot/jwt-token.webp"
  alt="jwt-token"
  caption="JWT token in Openmetada UI"
/>
</div>

You can validate that in [jwt.io](https://jwt.io/). if there's something wrong on how the JWT token was generated.

<div className="w-100 flex justify-center">
<Image
  src="/images/deployment/troubleshoot/jwt-validation.webp"
  alt="jwt.io"
  caption="jwt.io tool for validating JWT claims"
/>
</div>
