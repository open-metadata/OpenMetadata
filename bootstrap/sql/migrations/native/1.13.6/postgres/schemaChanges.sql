-- Pipeline alert starting watermark - OpenMetadata 1.13.6

-- Alerts must not fire for pipeline executions that finished before the alert existed (#31782).
-- Stamp the alerting watermark on subscriptions that already have a consumer offset; subscriptions
-- without one are stamped when that row is first created. 'timestamp' is deliberately untouched:
-- change_event_consumers derives a NOT NULL generated column from it.
UPDATE change_event_consumers
SET json = jsonb_set(
    json,
    '{startingTimestamp}',
    to_jsonb((EXTRACT(EPOCH FROM now()) * 1000)::bigint))
WHERE extension = 'eventSubscription.Offset'
  AND json ->> 'startingTimestamp' IS NULL;
