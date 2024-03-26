ALTER TABLE test_case ADD COLUMN status VARCHAR(56) GENERATED ALWAYS AS (json ->> '$.testCaseResult.testCaseStatus') STORED NULL;
ALTER TABLE test_case ADD COLUMN entityLink VARCHAR(512) GENERATED ALWAYS AS (json ->> '$.entityLink') STORED NOT NULL;

-- Change scheduleType to scheduleTimeline
UPDATE installed_apps
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.appSchedule.scheduleType'),
        '$.appSchedule.scheduleTimeline',
        JSON_EXTRACT(json, '$.appSchedule.scheduleType')
    );
delete from apps_extension_time_series;
