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

-- Users may only be direct members of Group teams (enforced by #32208). Remove pre-existing direct
-- memberships on non-Group hierarchy teams (BusinessUnit/Division/Department) created before the
-- rule so those users fall back to Organization (the default). Organization is the special root
-- fallback and is left untouched. relation 10 = HAS. Idempotent (re-runs match nothing).
DELETE er FROM entity_relationship er
JOIN team_entity te ON er.fromId = te.id
WHERE er.fromEntity = 'team'
  AND er.toEntity = 'user'
  AND er.relation = 10
  AND te.teamType IN ('BusinessUnit', 'Division', 'Department');
