ALTER TABLE test_case ADD COLUMN status VARCHAR(56) GENERATED ALWAYS AS (json -> 'testCaseResult' ->> 'testCaseStatus') STORED NULL;
ALTER TABLE test_case ADD COLUMN entityLink VARCHAR(512) GENERATED ALWAYS AS (json ->> 'entityLink') STORED NOT NULL;

-- change scheduleType to scheduleTimeline
UPDATE installed_apps
SET json = jsonb_set(
        json::jsonb #- '{appSchedule,scheduleType}',
        '{appSchedule,scheduleTimeline}',
        (json #> '{appSchedule,scheduleType}')::jsonb,
        true
    );
delete from apps_extension_time_series;
