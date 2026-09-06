-- Pipeline alert starting watermark - OpenMetadata 2.0.2

-- Alerts must not fire for pipeline executions that finished before the alert existed (#31782).
-- Stamp the alerting watermark on subscriptions that already have a consumer offset; subscriptions
-- without one are stamped when that row is first created. '$.timestamp' is deliberately untouched:
-- change_event_consumers derives a NOT NULL generated column from it.
UPDATE change_event_consumers
SET json = JSON_SET(json, '$.startingTimestamp', CAST(UNIX_TIMESTAMP(NOW(3)) * 1000 AS UNSIGNED))
WHERE extension = 'eventSubscription.Offset'
  AND JSON_EXTRACT(json, '$.startingTimestamp') IS NULL;
