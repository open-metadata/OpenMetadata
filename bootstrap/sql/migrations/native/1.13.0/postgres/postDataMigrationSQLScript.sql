UPDATE ingestion_pipeline_entity
SET json = (json::jsonb #- '{sourceConfig,config,computeMetrics}')::json
WHERE json::jsonb -> 'sourceConfig' -> 'config' -> 'computeMetrics' IS NOT NULL
AND pipelineType = 'profiler';

-- Hard-delete ingestion pipelines for Iceberg services (must run before service migration)
DELETE FROM ingestion_pipeline_entity ipe
USING dbservice_entity dse
WHERE dse.serviceType = 'Iceberg'
  AND ipe.json::jsonb -> 'service' ->> 'type' = 'databaseService'
  AND ipe.json::jsonb -> 'service' ->> 'id' = dse.id;

-- Migrate Iceberg database services to CustomDatabase (connector removed)
-- serviceType is a GENERATED column derived from json, so only update json
UPDATE dbservice_entity
SET json = jsonb_set(
      jsonb_set(
        json::jsonb,
        '{serviceType}', '"CustomDatabase"'
      ),
      '{connection,config,type}', '"CustomDatabase"'
    )::json
WHERE serviceType = 'Iceberg';

-- Migrate serviceType in child entities (serviceType is in JSON blob only, no generated column)
UPDATE database_entity
SET json = jsonb_set(json::jsonb, '{serviceType}', '"CustomDatabase"')::json
WHERE json->>'serviceType' = 'Iceberg';

UPDATE database_schema_entity
SET json = jsonb_set(json::jsonb, '{serviceType}', '"CustomDatabase"')::json
WHERE json->>'serviceType' = 'Iceberg';

UPDATE table_entity
SET json = jsonb_set(json::jsonb, '{serviceType}', '"CustomDatabase"')::json
WHERE json->>'serviceType' = 'Iceberg';

UPDATE stored_procedure_entity
SET json = jsonb_set(json::jsonb, '{serviceType}', '"CustomDatabase"')::json
WHERE json->>'serviceType' = 'Iceberg';
-- Migrate existing glossary term RELATED_TO relationships to include relationType
-- For backward compatibility, existing relations without a relationType are set to "relatedTo"

UPDATE entity_relationship
SET json = jsonb_set(COALESCE(json::jsonb, '{}'::jsonb), '{relationType}', '"relatedTo"')
WHERE fromentity = 'glossaryTerm'
  AND toentity = 'glossaryTerm'
  AND relation = 15
  AND (json IS NULL OR json::jsonb->>'relationType' IS NULL);

-- Insert default glossary term relation settings if they don't exist
-- This preserves any existing user customizations
INSERT INTO openmetadata_settings (configtype, json)
SELECT 'glossaryTermRelationSettings', '{"relationTypes":[{"name":"relatedTo","displayName":"Related To","description":"General association between terms that are conceptually connected.","rdfPredicate":"https://open-metadata.org/ontology/relatedTo","isSymmetric":true,"isTransitive":false,"isCrossGlossaryAllowed":true,"category":"associative","isSystemDefined":true,"color":"#1890ff"},{"name":"synonym","displayName":"Synonym","description":"Terms that have the same meaning and can be used interchangeably.","rdfPredicate":"http://www.w3.org/2004/02/skos/core#exactMatch","isSymmetric":true,"isTransitive":false,"isCrossGlossaryAllowed":true,"category":"equivalence","isSystemDefined":true,"color":"#722ed1"},{"name":"antonym","displayName":"Antonym","description":"Terms that have opposite meanings.","rdfPredicate":"https://open-metadata.org/ontology/antonym","isSymmetric":true,"isTransitive":false,"isCrossGlossaryAllowed":true,"category":"associative","isSystemDefined":true,"color":"#f5222d"},{"name":"broader","displayName":"Broader","description":"A more general term (hypernym).","inverseRelation":"narrower","rdfPredicate":"http://www.w3.org/2004/02/skos/core#broader","isSymmetric":false,"isTransitive":true,"isCrossGlossaryAllowed":true,"category":"hierarchical","isSystemDefined":true,"color":"#597ef7"},{"name":"narrower","displayName":"Narrower","description":"A more specific term (hyponym).","inverseRelation":"broader","rdfPredicate":"http://www.w3.org/2004/02/skos/core#narrower","isSymmetric":false,"isTransitive":true,"isCrossGlossaryAllowed":true,"category":"hierarchical","isSystemDefined":true,"color":"#85a5ff"},{"name":"partOf","displayName":"Part Of","description":"This term is a part or component of another term.","inverseRelation":"hasPart","rdfPredicate":"https://open-metadata.org/ontology/partOf","isSymmetric":false,"isTransitive":false,"isCrossGlossaryAllowed":true,"category":"hierarchical","isSystemDefined":true,"color":"#13c2c2"},{"name":"hasPart","displayName":"Has Part","description":"This term has the other term as a part or component.","inverseRelation":"partOf","rdfPredicate":"https://open-metadata.org/ontology/hasPart","isSymmetric":false,"isTransitive":false,"isCrossGlossaryAllowed":true,"category":"hierarchical","isSystemDefined":true,"color":"#36cfc9"},{"name":"calculatedFrom","displayName":"Calculated From","description":"This term/metric is calculated or derived from another term.","inverseRelation":"usedToCalculate","rdfPredicate":"https://open-metadata.org/ontology/calculatedFrom","isSymmetric":false,"isTransitive":false,"isCrossGlossaryAllowed":true,"category":"associative","isSystemDefined":true,"color":"#faad14"},{"name":"usedToCalculate","displayName":"Used To Calculate","description":"This term is used in the calculation of another term.","inverseRelation":"calculatedFrom","rdfPredicate":"https://open-metadata.org/ontology/usedToCalculate","isSymmetric":false,"isTransitive":false,"isCrossGlossaryAllowed":true,"category":"associative","isSystemDefined":true,"color":"#ffc53d"},{"name":"seeAlso","displayName":"See Also","description":"Related term that may provide additional context.","rdfPredicate":"http://www.w3.org/2000/01/rdf-schema#seeAlso","isSymmetric":true,"isTransitive":false,"isCrossGlossaryAllowed":true,"category":"associative","isSystemDefined":true,"color":"#eb2f96"}]}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM openmetadata_settings WHERE configtype = 'glossaryTermRelationSettings'
);

-- Strip stale relatedTerms from glossary term entity JSON.
-- relatedTerms is now loaded from entity_relationship table, not from entity JSON.
-- Old data stored relatedTerms as EntityReference objects which fail to deserialize as TermRelation.
UPDATE glossary_term_entity
SET json = (json::jsonb - 'relatedTerms')::json
WHERE jsonb_exists(json::jsonb, 'relatedTerms');

-- Backfill conceptMappings for existing glossary terms
UPDATE glossary_term_entity
SET json = jsonb_set(COALESCE(json::jsonb, '{}'::jsonb), '{conceptMappings}', '[]'::jsonb)
WHERE json IS NULL OR json::jsonb->'conceptMappings' IS NULL;
