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

-- Users may only be direct members of Group teams (enforced by #32208). Remove pre-existing direct
-- memberships on non-Group hierarchy teams (BusinessUnit/Division/Department) created before the
-- rule so those users fall back to Organization (the default). Organization is the special root
-- fallback and is left untouched. relation 10 = HAS. Idempotent (re-runs match nothing).
DELETE FROM entity_relationship er
USING team_entity te
WHERE er.fromId = te.id
  AND er.fromEntity = 'team'
  AND er.toEntity = 'user'
  AND er.relation = 10
  AND te.teamType IN ('BusinessUnit', 'Division', 'Department');
