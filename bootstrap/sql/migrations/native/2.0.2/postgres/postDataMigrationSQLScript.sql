-- OpenMetadata signs its own JWT after both OIDC and SAML logins. A non-positive validity mints
-- tokens whose expiry equals their issue time, so every request 401s and the client refreshes
-- forever. Repair values accepted by older SSO forms that had no minimum.
-- Idempotent: only rewrites values still at or below zero.
UPDATE openmetadata_settings
SET json = jsonb_set(
    json,
    '{oidcConfiguration,tokenValidity}',
    to_jsonb(3600),
    false)
WHERE configtype = 'authenticationConfiguration'
  AND jsonb_typeof(json #> '{oidcConfiguration,tokenValidity}') = 'number'
  AND (json #>> '{oidcConfiguration,tokenValidity}')::numeric <= 0;

UPDATE openmetadata_settings
SET json = jsonb_set(
    json,
    '{samlConfiguration,security,tokenValidity}',
    to_jsonb(3600),
    false)
WHERE configtype = 'authenticationConfiguration'
  AND jsonb_typeof(json #> '{samlConfiguration,security,tokenValidity}') = 'number'
  AND (json #>> '{samlConfiguration,security,tokenValidity}')::numeric <= 0;
