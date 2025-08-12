---
title: Data Retention Application
slug: /applications/data-retention
collate: true
---

# Data Retention Application

The **Data Retention** application in **OpenMetadata** automates the cleanup of the internal database to maintain long-term performance and prevent data bloat. It provides administrators with an efficient mechanism to define retention policies for event-related records, ensuring scalability and compliance with data management practices.

## Overview

As **OpenMetadata** processes events related to metadata changes and pipeline executions, it stores these events in internal tables. Over time, these tables can grow significantly and affect system performance. The **Data Retention App** enables automated and scheduled cleanup of outdated records.

### Key Features

- Automated cleanup of outdated internal records.
- Configurable retention periods for different data categories.
- Helps maintain system performance and database efficiency.
- Supports compliance with organizational data retention policies.

## Configuration Options

- **Configuration Key:** `changeEventRetentionPeriod`  
  **Description:** Number of days to retain change event records  
  **Default Value:** `7`  

{% note %}

The retention period is applied to each cleanup target based on its timestamp.

{% /note %}

## Cleanup Targets

The app deletes old records from the following internal tables:

- **change_events:** Stores all metadata change event logs.
- **successful_sent_change_events:** Tracks successfully processed events.
- **consumers_dlq:** Dead Letter Queue for failed events.

## Implementation Details

- **Schedule:** Runs weekly by default.  
- **Cron:** `0 0 * * 0` (every Sunday at midnight).  
- **Batch Processing:** Cleans up records in batches of 10,000.  
- **Triggering:** Can be executed manually or allowed to run on schedule.  
- **Application Class:** `org.openmetadata.service.apps.bundles.dataRetention.DataRetention`  
- **Permission Requirement:** Requires admin privileges to configure or trigger.  

## How to Access

1. Go to **Settings > Applications** and then click on **Add apps**.

{% image
src="/images/v1.10/applications/ret.png"
alt="Install Data Retention Application"
caption="Install Data Retention Application"
/%}

2. Select or install the **Data Retention** application.

{% image
src="/images/v1.10/applications/ret1.png"
alt="Install Data Retention Application"
caption="Install Data Retention Application"
/%}

3. Configure the desired retention period.

{% image
src="/images/v1.10/applications/ret2.png"
alt="configuration"
caption="Configuration"
/%}

4. Run manually or let it operate on its default schedule.

{% image
src="/images/v1.10/applications/ret3.png"
alt="scheduling"
caption="scheduling"
/%}
