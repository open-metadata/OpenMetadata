---
title: Data Quality | OpenMetadata Quality Management Guide
slug: /how-to-guides/data-quality-observability/quality
---

# Overview of Data Quality

With OpenMetadata, you can build trust in your data by creating tests to monitor that the data is complete, fresh, and accurate. OpenMetadata supports data quality tests for all of the supported database connectors. Users can run tests at the table and column levels to verify their data for business as well as technical use cases.

OpenMetadata provides Data Quality workflows, which helps with:
- **Native tests** for all database connectors to run assertions.
- **Alerting system** to send notifications on test failure.
- **Health dashboard** to track realtime test failure and to prioritize efforts.
- **Resolution workflow** to inform the data consumer on test resolutions.

The data quality in OpenMetadata is also **extensible** to adapt to your needs. 

{% image
src="/images/v1.7/how-to-guides/quality/quality1.png"
alt="Profiler & Data Quality"
caption="Profiler & Data Quality"
/%}

Watch the video to understand OpenMetadata’s native Data Profiler and Data Quality tests.

{%  youtube videoId="gLdTOF81YpI" start="0:00" end="1:08:10" width="800px" height="450px" /%}

Watch the video on Data Quality Simplified to effortlessly build, deploy, monitor, and configure alerts using OpenMetadata's no-code platform

{%  youtube videoId="ihwtuNHt1kI" start="0:00" end="29:08" width="800px" height="450px" /%}

Here's the latest on OpenMetadata's data quality.
{%  youtube videoId="UbNOje0kf6E" start="0:00" end="54:52" width="800px" height="450px" /%}

{%inlineCalloutContainer%}
 {%inlineCallout
  color="violet-70"
  bold="Data Quality Tab"
  icon="MdSecurity"
  href="/how-to-guides/data-quality-observability/quality/tab"%}
  Get a complete picture of the Data Quality details.
 {%/inlineCallout%}
 {%inlineCallout
  color="violet-70"
  bold="Write and Deploy No-Code Test Cases from the UI"
  icon="MdSecurity"
  href="/how-to-guides/data-quality-observability/quality/test"%}
  Verify your data quality with table and column level tests.
 {%/inlineCallout%}
 {%inlineCallout
    icon="MdGppGood"
    bold="Configure Data Quality"
    href="/how-to-guides/data-quality-observability/quality/configure"%}
    Configure and run data quality pipelines with the built-in tests in OpenMetadata.
 {%/inlineCallout%}
 {%inlineCallout
    icon="MdAssignmentTurnedIn"
    bold="Tests - YAML Config"
    href="/how-to-guides/data-quality-observability/quality/tests-yaml"%}
    Learn how to configure data quality tests in the YAML config file.
 {%/inlineCallout%}
 {%inlineCallout
    icon="MdOutlineDashboardCustomize"
    bold="Custom Tests"
    href="/how-to-guides/data-quality-observability/quality/custom-tests"%}
    Write your own data quality tests and test suites.
 {%/inlineCallout%}
{%/inlineCalloutContainer%}