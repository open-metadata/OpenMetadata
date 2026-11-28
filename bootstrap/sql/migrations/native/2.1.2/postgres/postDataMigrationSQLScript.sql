-- A PUT on a default policy or role used to store it without its system marks, which left it
-- deletable. Restore them on the defaults seeded with provider system and allowDelete false.
UPDATE policy_entity
SET json = jsonb_set(jsonb_set(json::jsonb, '{provider}', '"system"'::jsonb), '{allowDelete}', 'false'::jsonb)
WHERE name IN (
    'ApplicationBotImpersonationPolicy', 'ApplicationBotPolicy', 'AutoClassificationBotPolicy',
    'BotImpersonationPolicy', 'BotNonAdminImpersonationPolicy', 'DataConsumerPolicy',
    'DataStewardPolicy', 'DefaultBotPolicy', 'IngestionBotPolicy', 'LineageBotPolicy',
    'OntologyAuthorPolicy', 'OntologyReviewerPolicy', 'OrganizationPolicy', 'ProfilerBotPolicy',
    'QualityBotPolicy', 'ScimBotPolicy', 'TaskAuthorPolicy', 'TeamOnlyPolicy', 'UsageBotPolicy')
  AND (COALESCE(json ->> 'provider', '') <> 'system'
    OR COALESCE(json ->> 'allowDelete', '') <> 'false');

UPDATE role_entity
SET json = jsonb_set(jsonb_set(json::jsonb, '{provider}', '"system"'::jsonb), '{allowDelete}', 'false'::jsonb)
WHERE name IN (
    'ApplicationBotImpersonationRole', 'ApplicationBotRole', 'AutoClassificationBotRole',
    'BotImpersonationRole', 'BotNonAdminImpersonationRole', 'DataConsumer', 'DataQualityBotRole',
    'DataSteward', 'DefaultBotRole', 'GovernanceBotRole', 'IngestionBotRole', 'LineageBotRole',
    'OntologyAuthor', 'OntologyReviewer', 'ProfilerBotRole', 'QualityBotRole', 'ScimBotRole',
    'UsageBotRole')
  AND (COALESCE(json ->> 'provider', '') <> 'system'
    OR COALESCE(json ->> 'allowDelete', '') <> 'false');

-- Offer Table Diff on Vertica.
-- tableDiff.json gained Vertica, but test definitions are seed data and
-- initializeEntity() skips a row that already exists, so an upgraded deployment
-- keeps its previous list. An empty list already means "every service", so leave
-- it alone rather than narrowing it to one.
UPDATE test_definition
SET json = jsonb_set(json, '{supportedServices}',
                     (json->'supportedServices') || '["Vertica"]'::jsonb)
WHERE name = 'tableDiff'
  AND CASE
        WHEN jsonb_typeof(json->'supportedServices') = 'array'
        THEN jsonb_array_length(json->'supportedServices') > 0
             AND NOT (json->'supportedServices') @> '["Vertica"]'::jsonb
        ELSE FALSE
      END;
