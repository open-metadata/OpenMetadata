# Retention Configuration

Configure retention policy for ephemeral objects in OpenMetadata. These are not metadata entities but represent changes in the system that are used for tracking changes or statuses of processes. It is recommended to keep these records for a limited time to avoid unnecessary storage usage.

$$section
### Change Event Retention Period (days) $(id="changeEventRetentionPeriod")

Enter the retention period for change event records in days (e.g., 7 for one week, 30 for one month).

$$

$$section
### Activity Threads Retention Period (days) $(id="activityThreadsRetentionPeriod")

Enter the retention period for Activity Threads of type = 'Conversation' records in days (e.g., 30 for one month, 60 for two months).

$$

$$section
### App Records Retention Period (days) $(id="appRecordsRetentionPeriod")

Enter the retention period for app records (logs and statuses) in days (e.g., 7 for one week, 30 for one month).

$$