-- Alert jobs are stored with the runtime's own job class, whatever consumer the alert names, so a
-- stored job never names a consumer class. A job a previous release stored under a consumer's
-- class is moved to it here; the alert reconciler would otherwise do it, one round at a time.
UPDATE QRTZ_JOB_DETAILS
SET JOB_CLASS_NAME = 'org.openmetadata.service.events.consumer.ConsumerJob'
WHERE SCHED_NAME = 'OMEventSubScheduler' AND JOB_GROUP = 'OMAlertJobGroup';
