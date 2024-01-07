---
title: Data Quality and Profiler
slug: /how-to-guides/data-quality-profiler
---

# Overview of Data Quality and Profiler

With OpenMetadata, you can build trust in your data by creating tests to monitor that the data is complete, fresh, and accurate. OpenMetadata supports data quality tests for all of the supported database connectors. Users can run tests at the table and column levels to verify their data for business as well as technical use cases.

The profiler in OpenMetadata helps to understand the shape of your data and to quickly validate assumptions. The data profiler helps to capture table usage statistics over a period of time. This happens as part of profiler ingestion. Data profiles enable you to check for null values in non-null columns, for duplicates in a unique column, etc. You can gain a better understanding of column data distributions through the descriptive statistics provided.

OpenMetadata provides Data Quality workflows, which helps with:
- **Native tests** for all database connectors to run assertions.
- **Alerting system** to send notifications on test failure.
- **Health dashboard** to track realtime test failure and to prioritize efforts.
- **Resolution workflow** to inform the data consumer on test resolutions.

The data quality in OpenMetadata is also **extensible** to adapt to your needs. 

{% image
src="/images/v1.2/how-to-guides/quality/quality1.png"
alt="Profiler & Data Quality"
caption="Profiler & Data Quality"
/%}

Watch the video to understand OpenMetadata’s native Data Profiler and Data Quality tests.

{%  youtube videoId="gLdTOF81YpI" start="0:00" end="1:08:10" width="560px" height="315px" /%}

Watch the video on Data Quality Simplified to effortlessly build, deploy, monitor, and configure alerts using OpenMetadata's no-code platform

{%  youtube videoId="ihwtuNHt1kI" start="0:00" end="29:08" width="560px" height="315px" /%}

{%inlineCalloutContainer%}
 {%inlineCallout
  color="violet-70"
  bold="Profiler and Data Quality Tab"
  icon="MdSecurity"
  href="/how-to-guides/data-quality-profiler/tab"%}
  Get a complete picture of the Table Profile, Column Profile, and Data Quality details.
 {%/inlineCallout%}
 {%inlineCallout
  color="violet-70"
  bold="Write and Deploy No-Code Test Cases"
  icon="MdSecurity"
  href="/how-to-guides/data-quality-profiler/test"%}
  Verify your data quality with table and column level tests.
 {%/inlineCallout%}
 {%inlineCallout
  color="violet-70"
  bold="Set Alerts for Test Case Fails"
  icon="MdSecurity"
  href="/how-to-guides/data-quality-profiler/alerts"%}
  Get notified when a data quality test fails.
 {%/inlineCallout%}
{%/inlineCalloutContainer%}