-- OpenMetadata signs its own JWT after both OIDC and SAML logins. A non-positive validity mints
-- tokens whose expiry equals their issue time, so every request 401s and the client refreshes
-- forever. Repair values accepted by older SSO forms that had no minimum.
-- Idempotent: only rewrites values still at or below zero.
UPDATE openmetadata_settings
SET json = JSON_SET(json, '$.oidcConfiguration.tokenValidity', 3600)
WHERE configType = 'authenticationConfiguration'
  AND JSON_TYPE(JSON_EXTRACT(json, '$.oidcConfiguration.tokenValidity')) IN ('INTEGER', 'DOUBLE')
  AND CAST(
    JSON_UNQUOTE(JSON_EXTRACT(json, '$.oidcConfiguration.tokenValidity')) AS DECIMAL(65, 10)
  ) <= 0;

UPDATE openmetadata_settings
SET json = JSON_SET(json, '$.samlConfiguration.security.tokenValidity', 3600)
WHERE configType = 'authenticationConfiguration'
  AND JSON_TYPE(JSON_EXTRACT(json, '$.samlConfiguration.security.tokenValidity'))
      IN ('INTEGER', 'DOUBLE')
  AND CAST(
    JSON_UNQUOTE(JSON_EXTRACT(json, '$.samlConfiguration.security.tokenValidity'))
      AS DECIMAL(65, 10)
  ) <= 0;
