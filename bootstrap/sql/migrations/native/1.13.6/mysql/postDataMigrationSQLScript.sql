-- Data Insights: give the charts that report on data assets one definition of a data asset.
--
-- The di-data-assets-* pattern these charts read also resolves the data-quality aliases, and those
-- documents are time series rather than entities, so they carry no entityType. A breakdown grouped
-- on entityType.keyword puts a document missing that field in no bucket, while the summary cards'
-- original filter was a list of must_not term clauses -- every one of which a document *lacking*
-- the field satisfies. Each card therefore ran ahead of the breakdown beneath it by the number of
-- test case results in the window (issue #31478). Requiring entityType to exist is the only
-- predicate that separates the two, and the breakdown's excludeGroups is widened to the same three
-- governance types the filter excludes so the two sides cannot drift again.
--
-- Replaces the 1.13.5 Java data migration, which no deployment ran: 1.13.5-release had already
-- shipped and been recorded, and MigrationWorkflow never reprocesses a recorded version's
-- runDataMigration() once it is no longer the release train's highest. SQL statements are not
-- behind that gate -- they are replayed whenever their checksum is absent from
-- SERVER_MIGRATION_SQL_LOGS -- so expressing the repair as SQL is what makes it reach the
-- deployments that are already on 1.13.5 or 1.13.6.
--
-- Both statements are guarded on the stored value, so a deployment that already holds the corrected
-- definitions is left untouched.

-- Scope every data-asset metric to documents that actually carry an entityType.
UPDATE di_chart_entity
SET json = JSON_SET(json, '$.chartDetails.metrics[0].filter', '{"query":{"bool":{"must":[{"exists":{"field":"entityType"}}],"must_not":[{"term":{"entityType.keyword":"tag"}},{"term":{"entityType.keyword":"glossaryTerm"}},{"term":{"entityType.keyword":"dataProduct"}}]}}}')
WHERE name IN (
    'total_data_assets',
    'total_data_assets_by_tier',
    'total_data_assets_summary_card',
    'total_data_assets_with_tier_summary_card',
    'percentage_of_data_asset_with_description',
    'percentage_of_data_asset_with_owner',
    'percentage_of_service_with_description',
    'percentage_of_service_with_owner',
    'data_assets_with_description_summary_card',
    'data_assets_with_owner_summary_card',
    'percentage_of_data_asset_with_description_kpi',
    'percentage_of_data_asset_with_owner_kpi',
    'number_of_data_asset_with_description_kpi',
    'number_of_data_asset_with_owner_kpi'
  )
  AND JSON_TYPE(JSON_EXTRACT(json, '$.chartDetails.metrics')) = 'ARRAY'
  AND JSON_LENGTH(json, '$.chartDetails.metrics') = 1
  AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.chartDetails.metrics[0].filter')), '') <> '{"query":{"bool":{"must":[{"exists":{"field":"entityType"}}],"must_not":[{"term":{"entityType.keyword":"tag"}},{"term":{"entityType.keyword":"glossaryTerm"}},{"term":{"entityType.keyword":"dataProduct"}}]}}}';

-- Drop the same governance types from the breakdown that the filter above drops from the card.
UPDATE di_chart_entity
SET json = JSON_SET(json, '$.chartDetails.excludeGroups', CAST('["tag","glossaryTerm","dataProduct"]' AS JSON))
WHERE name IN (
    'total_data_assets',
    'total_data_assets_by_tier',
    'total_data_assets_summary_card',
    'total_data_assets_with_tier_summary_card',
    'percentage_of_data_asset_with_description',
    'percentage_of_data_asset_with_owner',
    'percentage_of_service_with_description',
    'percentage_of_service_with_owner',
    'data_assets_with_description_summary_card',
    'data_assets_with_owner_summary_card',
    'percentage_of_data_asset_with_description_kpi',
    'percentage_of_data_asset_with_owner_kpi',
    'number_of_data_asset_with_description_kpi',
    'number_of_data_asset_with_owner_kpi'
  )
  AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.chartDetails.groupBy')) = 'entityType.keyword'
  AND COALESCE(JSON_EXTRACT(json, '$.chartDetails.excludeGroups'), CAST('null' AS JSON)) <> CAST('["tag","glossaryTerm","dataProduct"]' AS JSON);
