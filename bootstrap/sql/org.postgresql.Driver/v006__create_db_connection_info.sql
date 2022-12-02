--
-- Upgrade changes for 0.13
--


ALTER TABLE entity_extension_time_series ALTER COLUMN entityFQN TYPE varchar(768);
CREATE INDEX IF NOT EXISTS entity_extension_time_series_entity_fqn_index ON entity_extension_time_series(entityFQN);

CREATE TABLE IF NOT EXISTS web_analytic_event (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    eventType VARCHAR(256) GENERATED ALWAYS AS (json ->> 'eventType') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS name_index ON web_analytic_event(name);

UPDATE bot_entity
SET json = JSONB_SET(json::jsonb, '{provider}', '"system"', true);

UPDATE bot_entity
SET json = json::jsonb #- '{botType}';

CREATE TABLE IF NOT EXISTS data_insight_chart (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    dataIndexType VARCHAR(256) GENERATED ALWAYS AS (json ->> 'dataIndexType') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS name_index ON web_analytic_event(name);

UPDATE role_entity
SET json = JSONB_SET(json::jsonb, '{provider}', '"system"', true)
WHERE name in ('DataConsumer', 'DataSteward');

UPDATE policy_entity
SET json = JSONB_SET(json::jsonb, '{provider}', '"system"', true)
WHERE fullyQualifiedName in ('DataConsumerPolicy', 'DataStewardPolicy', 'OrganizationPolicy', 'TeamOnlyPolicy');

UPDATE tag_category
SET json = JSONB_SET(json::jsonb, '{provider}', '"system"', true)
WHERE name in ('PersonalData', 'PII', 'Tier');

UPDATE tag
SET json = JSONB_SET(json::jsonb, '{provider}', '"system"', true)
WHERE fullyQualifiedName in ('PersonalData.Personal', 'PersonalData.SpecialCategory',
'PII.None', 'PII.NonSensitive', 'PII.Sensitive',
'Tier.Tier1', 'Tier.Tier2', 'Tier.Tier3', 'Tier.Tier4', 'Tier.Tier5');

UPDATE pipeline_service_entity 
SET json = JSONB_SET(json::jsonb,'{connection,config}',json::jsonb #>'{connection,config}' || jsonb_build_object('configSource',jsonb_build_object('hostPort',json #>'{connection,config,hostPort}')), true)
where servicetype = 'Dagster';

UPDATE pipeline_service_entity 
SET json = json::jsonb #- '{connection,config,hostPort}' #- '{connection,config,numberOfStatus}'
where servicetype = 'Dagster';

-- Remove categoryType
UPDATE tag_category
SET json = json::jsonb #- '{categoryType}';

-- set mutuallyExclusive flag
UPDATE tag_category
SET json = jsonb_set(json, '{mutuallyExclusive}', 'false'::jsonb, true);

UPDATE tag_category
SET json = jsonb_set(json, '{mutuallyExclusive}', 'true'::jsonb, true)
WHERE name in ('PersonalData', 'PII', 'Tier');

UPDATE tag
SET json = jsonb_set(json, '{mutuallyExclusive}', 'false'::jsonb, true);

-- Merge mutually exclusive table when multiple tag labels are used
DELETE FROM tag_usage t1
USING tag_usage t2
WHERE
(t1.targetFQN = t2.targetFQN AND
t2.tagFQN = 'Tier.Tier1' AND
t1.tagFQN in ('Tier.Tier2', 'Tier.Tier3', 'Tier.Tier4', 'Tier.Tier5')
) OR
(t1.targetFQN = t2.targetFQN AND
t2.tagFQN = 'Tier.Tier2' AND
t1.tagFQN in ('Tier.Tier3', 'Tier.Tier4', 'Tier.Tier5')
) OR
(t1.targetFQN = t2.targetFQN AND
t2.tagFQN = 'Tier.Tier3' AND
t1.tagFQN in ('Tier.Tier4', 'Tier.Tier5')
) OR
(t1.targetFQN = t2.targetFQN AND
t2.tagFQN = 'Tier.Tier4' AND
t1.tagFQN in ('Tier.Tier5'));

DELETE FROM tag_usage t1
USING tag_usage t2
WHERE
(t1.targetFQN = t2.targetFQN AND
t2.tagFQN = 'PII.Sensitive' AND
t1.tagFQN in ('PII.NonSensitive', 'PII.None')
) OR
(t1.targetFQN = t2.targetFQN AND
t2.tagFQN = 'PII.NonSensitive' AND
t1.tagFQN in ('PII.None'));

DELETE FROM tag_usage t1
USING tag_usage t2
WHERE
(t1.targetFQN = t2.targetFQN AND
t2.tagFQN = 'PersonalData.Personal' AND
t1.tagFQN in ('PersonalData.SpecialCategory'));

CREATE TABLE IF NOT EXISTS kpi_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS metadata_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> 'serviceType') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (name)
);

-- We are starting to store the current deployed flag. Let's mark it as false by default
UPDATE ingestion_pipeline_entity
SET json = json::jsonb #- '{deployed}';

UPDATE ingestion_pipeline_entity
SET json = jsonb_set(json::jsonb, '{deployed}', 'true'::jsonb, true);

-- We removed the supportsMetadataExtraction field in the `OpenMetadataConnection` object being used in IngestionPipelines
UPDATE ingestion_pipeline_entity
SET json = json::jsonb #- '{openMetadataServerConnection,supportsMetadataExtraction}';

