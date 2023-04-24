---
title: Latest Release
slug: /releases/latest-release
---

# 1.0 Release 🎉

## Ingestion
- We are improving the overall UX and UI around creating new connections to your sources. When integrating your systems, you will now have detailed documentation on all the necessary information directly in the app.
- Testing the connection is no longer an OK/KO response. We are testing every internal step of the metadata extraction process to let you know which specific permissions you might be missing, and if all or only partial metadata will be ingested based on that.
- We have improved the performance of multiple connectors (e.g., Redshift) by fetching as much information as possible in bulk.
- We are providing more levers for you to tune how you want the ingestion to behave, enabling or disabling the ingestion of tags or owners.
- We have improved the parsing process and the overall performance of the dbt workflows
- New Impala Connector. In the next release we'll remove the impala schemes from the Hive connector

## Data Models
- Dashboard Services now support the concept of Data Models: data that can be directly defined and managed in the Dashboard tooling itself, such as LookML models in Looker.
- Data Models will help us close the gap between engineering and business by providing all the necessary metadata from sources typically used and managed by analysts or business users.
- The first implementation has been done for Tableau and Looker.

## Storage Services
- Based on all your feedback, we have added a new way to handle Storage Services. Thank you for your ideas and contributions.
- The Data Lake connector ingested one table per file, which covered only some of the use cases in a Data Platform.
- With the new Storage Services, you now have complete control over how you want to present your data lakes in OpenMetadata.
- The first implementation has been done on S3, and you can specify your tables and partitions and see them reflected with the rest of your metadata.
- This has been a major contribution from Cristian Calugaru, Principal Engineer @Forter

## Query as an Entity & UI Overhaul
- While we were already ingesting queries in the Usage Workflows, their presentation and the overall interaction with users in the platform was lacking.
- In this release, we allow users to also manually enter the queries they want to share with the rest of their peers, and discuss and react to the other present queries in each table.

## Security:
- Added SAML support
- **[DEPRECATION NOTICE]** SSO Service accounts for Bots will be deprecated. JWT authentication will be the preferred method.

## Auto PII Classification:
- During the profiler workflow, users can now choose to have PII data automatically tagged as such using NLP models on the ingested sample data.

## Global search
- You can search for glossary terms/tags from the global search.

## Localisation
- Full support of English (US) language with partial support of languages like: French, Chinese, Japanese, Portuguese and Spanish.
- We are happy to have your contributions to the above languages you can find the details for your contribution [here](/how-to-guides/how-to-add-language-support#how-to-add-language-support).
