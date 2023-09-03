START TRANSACTION;
-- We'll rank all the runs (timestamps) for every day, and delete all the data but the most recent one.
DELETE FROM report_data_time_series WHERE JSON_EXTRACT(json, '$.id') IN (
	select ids FROM (
		SELECT 
		(json ->> '$.id') AS ids,
		DENSE_RANK() OVER(PARTITION BY `date` ORDER BY `timestamp` DESC) as denseRank
		FROM (
			SELECT
			*
			FROM report_data_time_series rdts
			WHERE json ->> '$.reportDataType' = 'WebAnalyticEntityViewReportData'
		) duplicates
		ORDER BY `date` DESC, `timestamp` DESC
		) as dense_ranked
		WHERE denseRank != 1
);

DELETE FROM report_data_time_series WHERE JSON_EXTRACT(json, '$.id') IN (
	select ids FROM (
		SELECT 
		(json ->> '$.id') AS ids,
		DENSE_RANK() OVER(PARTITION BY `date` ORDER BY `timestamp` DESC) as denseRank
		FROM (
			SELECT
			*
			FROM report_data_time_series rdts
			WHERE json ->> '$.reportDataType' = 'EntityReportData'
		) duplicates
		ORDER BY `date` DESC, `timestamp` DESC
		) as dense_ranked
		WHERE denseRank != 1
);

DELETE FROM report_data_time_series WHERE JSON_EXTRACT(json, '$.id') IN (
	select ids FROM (
		SELECT 
		(json ->> '$.id') AS ids,
		DENSE_RANK() OVER(PARTITION BY `date` ORDER BY `timestamp` DESC) as denseRank
		FROM (
			SELECT
			*
			FROM report_data_time_series rdts
			WHERE json ->> '$.reportDataType' = 'WebAnalyticUserActivityReportData'
		) duplicates
		ORDER BY `date` DESC, `timestamp` DESC
		) as dense_ranked
		WHERE denseRank != 1
);
COMMIT;