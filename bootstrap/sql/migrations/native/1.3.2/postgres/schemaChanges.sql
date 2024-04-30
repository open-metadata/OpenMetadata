ALTER TABLE test_case ADD COLUMN status VARCHAR(56) GENERATED ALWAYS AS (json -> 'testCaseResult' ->> 'testCaseStatus') STORED NULL;
ALTER TABLE test_case ADD COLUMN entityLink VARCHAR(512) GENERATED ALWAYS AS (json ->> 'entityLink') STORED NOT NULL;
