---
title: Data Observability | OpenMetadata Observability Guide
slug: /how-to-guides/data-quality-observability/observability
---

# Data Observability

OpenMetadata has been providing observability alerts right from the start to notify users of important data lifecycle events: schema modifications, ownership shifts, and tagging updates. Users can define fine-grained alerts and notifications.

Starting from the 1.3 release, Data Observability alerts have been completely revamped, simplifying the process of monitoring data. Users can quickly create alerts for:
- **Changes in the Metadata:** such as schema changes,
- **Data Quality Failures:** to filter by Test Suite,
- **Pipeline Status Failures:** when ingesting runs from your ETL systems, and
- **Ingestion Pipeline Monitoring:** for OpenMetadata’s ingestion workflows

Depending on your use cases, notifications can be sent to owners, admins, teams, or users, providing a more personalized and informed experience. Teams can configure their dedicated Slack, MS Teams, or Google Chat channels to receive notifications related to their data assets, streamlining communication and collaboration. With the alerts and notifications in OpenMetadata, users can send Announcements over email, Slack, or Teams. Alerts are sent to a user when they are mentioned in a task or an activity feed.

{% youtube videoId="0QlFSIovjOQ" start="0:00" end="2:09" width="800px" height="450px" /%}

{%inlineCallout
    icon="MdAddAlert"
    bold="Observability Alerts"
    href="/how-to-guides/data-quality-observability/observability/alerts"%}
    Set up observability alerts in OpenMetadata.
{%/inlineCallout%}