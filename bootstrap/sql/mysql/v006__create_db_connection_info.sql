--
-- Drop indexes for deleted boolean column
-- Drop unused indexes for updatedAt and updatedBy
--
RENAME TABLE airflow_pipeline_entity to ingestion_pipeline_entity;
