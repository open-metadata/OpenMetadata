-- Add the supportsProfiler field to the MongoDB connection configuration
UPDATE dbservice_entity
SET json = jsonb_set(json::jsonb, '{connection,config,supportsProfiler}', 'true'::jsonb)
WHERE serviceType = 'MongoDB';

UPDATE installed_apps
SET json = jsonb_set(
        json::jsonb #- '{appSchedule,scheduleType}',
        '{appSchedule,scheduleTimeline}',
        (json #> '{appSchedule,scheduleType}')::jsonb,
        true
    );