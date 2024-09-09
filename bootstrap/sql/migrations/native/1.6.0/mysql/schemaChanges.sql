ALTER TABLE data_quality_data_time_series
ADD COLUMN id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,

ADD CONSTRAINT UNIQUE (id);

CREATE INDEX data_quality_data_time_series_id_index ON data_quality_data_time_series (id);
