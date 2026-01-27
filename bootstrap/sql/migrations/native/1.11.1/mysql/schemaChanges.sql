-- Add Flowable batch processing tables for history cleanup support
CREATE TABLE IF NOT EXISTS flw_ru_batch (
    id_ VARCHAR(64) NOT NULL, 
    rev_ INTEGER, 
    type_ VARCHAR(64) NOT NULL, 
    search_key_ VARCHAR(255), 
    search_key2_ VARCHAR(255), 
    create_time_ TIMESTAMP(3) NOT NULL, 
    complete_time_ TIMESTAMP(3), 
    status_ VARCHAR(255), 
    batch_doc_id_ VARCHAR(64), 
    tenant_id_ VARCHAR(255) DEFAULT '', 
    CONSTRAINT pk_flw_ru_batch PRIMARY KEY (id_)
);

CREATE INDEX idx_flw_ru_batch_type ON flw_ru_batch (type_);
CREATE INDEX idx_flw_ru_batch_search_key ON flw_ru_batch (search_key_);
CREATE INDEX idx_flw_ru_batch_status ON flw_ru_batch (status_);

CREATE TABLE IF NOT EXISTS flw_ru_batch_part (
    id_ VARCHAR(64) NOT NULL, 
    rev_ INTEGER, 
    batch_id_ VARCHAR(64), 
    type_ VARCHAR(64) NOT NULL, 
    scope_id_ VARCHAR(64), 
    sub_scope_id_ VARCHAR(64), 
    scope_type_ VARCHAR(64), 
    search_key_ VARCHAR(255), 
    search_key2_ VARCHAR(255), 
    create_time_ TIMESTAMP(3) NOT NULL, 
    complete_time_ TIMESTAMP(3), 
    status_ VARCHAR(255), 
    result_doc_id_ VARCHAR(64), 
    tenant_id_ VARCHAR(255) DEFAULT '', 
    CONSTRAINT pk_flw_ru_batch_part PRIMARY KEY (id_)
);

CREATE INDEX idx_flw_ru_batch_part_batch_id ON flw_ru_batch_part (batch_id_);
CREATE INDEX idx_flw_ru_batch_part_type ON flw_ru_batch_part (type_);
CREATE INDEX idx_flw_ru_batch_part_status ON flw_ru_batch_part (status_);

-- Update workflow settings with new history cleanup configuration fields
UPDATE openmetadata_settings
SET json = JSON_SET(
    JSON_SET(
        JSON_SET(
            JSON_SET(
                json,
                '$.historyCleanUpConfiguration.batchSize',
                1000
            ),
            '$.historyCleanUpConfiguration.timeCycleConfig',
            '0 0 0 ? * 1'
        ),
        '$.runTimeCleanUpConfiguration',
        JSON_OBJECT()
    ),
    '$.runTimeCleanUpConfiguration.batchSize',
    500
)
WHERE configType = 'workflowSettings';