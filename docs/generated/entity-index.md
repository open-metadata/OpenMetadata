<!-- GENERATED FILE — DO NOT EDIT. Run `make generate-entity-index`. -->

# Entity Index

One row per first-class entity schema, with the artifacts codegen and routing
derive from it. **Generated** from the JSON schemas and JAX-RS resources — do not
hand-edit; run `make generate-entity-index` (or `make generate-reference-docs`).

- **Entity** = a schema under `openmetadata-spec/src/main/resources/json/schema/entity/**`
  that declares a `javaType` and a top-level `id` property.
- **Java** is read from the schema's `javaType`. **Python** / **TypeScript** paths follow the
  codegen conventions (datamodel-code-generator / quicktype); the TS column shows `—` when the
  committed `.ts` is absent.
- **REST resource** is joined from `extends EntityResource<Entity, …>`; `—` means no dedicated
  `EntityResource` was found (the entity may be exposed via a shared or non-`EntityResource` route).

**87 entities** · 62 with a dedicated `EntityResource`.

## entity/(root)

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| Bot | `openmetadata-spec/src/main/resources/json/schema/entity/bot.json` | `org.openmetadata.schema.entity.Bot` | `metadata.generated.schema.entity.bot` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/bot.ts` | `org.openmetadata.service.resources.bots.BotResource` |
| Type | `openmetadata-spec/src/main/resources/json/schema/entity/type.json` | `org.openmetadata.schema.entity.Type` | `metadata.generated.schema.entity.type` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/type.ts` | `org.openmetadata.service.resources.types.TypeResource` |

## entity/activity

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| ActivityEvent | `openmetadata-spec/src/main/resources/json/schema/entity/activity/activityEvent.json` | `org.openmetadata.schema.entity.activity.ActivityEvent` | `metadata.generated.schema.entity.activity.activityEvent` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/activity/activityEvent.ts` | — |
| ActivityStreamConfig | `openmetadata-spec/src/main/resources/json/schema/entity/activity/activityStreamConfig.json` | `org.openmetadata.schema.entity.activity.ActivityStreamConfig` | `metadata.generated.schema.entity.activity.activityStreamConfig` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/activity/activityStreamConfig.ts` | — |

## entity/ai

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| AIApplication | `openmetadata-spec/src/main/resources/json/schema/entity/ai/aiApplication.json` | `org.openmetadata.schema.entity.ai.AIApplication` | `metadata.generated.schema.entity.ai.aiApplication` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/ai/aiApplication.ts` | `org.openmetadata.service.resources.ai.AIApplicationResource` |
| AIFrameworkControl | `openmetadata-spec/src/main/resources/json/schema/entity/ai/aiFrameworkControl.json` | `org.openmetadata.schema.entity.ai.AIFrameworkControl` | `metadata.generated.schema.entity.ai.aiFrameworkControl` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/ai/aiFrameworkControl.ts` | `org.openmetadata.service.resources.ai.AIFrameworkControlResource` |
| AIGovernanceFramework | `openmetadata-spec/src/main/resources/json/schema/entity/ai/aiGovernanceFramework.json` | `org.openmetadata.schema.entity.ai.AIGovernanceFramework` | `metadata.generated.schema.entity.ai.aiGovernanceFramework` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/ai/aiGovernanceFramework.ts` | `org.openmetadata.service.resources.ai.AIGovernanceFrameworkResource` |
| AIGovernancePolicy | `openmetadata-spec/src/main/resources/json/schema/entity/ai/aiGovernancePolicy.json` | `org.openmetadata.schema.entity.ai.AIGovernancePolicy` | `metadata.generated.schema.entity.ai.aiGovernancePolicy` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/ai/aiGovernancePolicy.ts` | `org.openmetadata.service.resources.ai.AIGovernancePolicyResource` |
| AgentExecution | `openmetadata-spec/src/main/resources/json/schema/entity/ai/agentExecution.json` | `org.openmetadata.schema.entity.ai.AgentExecution` | `metadata.generated.schema.entity.ai.agentExecution` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/ai/agentExecution.ts` | — |
| AuditReport | `openmetadata-spec/src/main/resources/json/schema/entity/ai/auditReport.json` | `org.openmetadata.schema.entity.ai.AuditReport` | `metadata.generated.schema.entity.ai.auditReport` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/ai/auditReport.ts` | `org.openmetadata.service.resources.ai.AuditReportResource` |
| LLMModel | `openmetadata-spec/src/main/resources/json/schema/entity/ai/llmModel.json` | `org.openmetadata.schema.entity.ai.LLMModel` | `metadata.generated.schema.entity.ai.llmModel` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/ai/llmModel.ts` | `org.openmetadata.service.resources.ai.LLMModelResource` |
| McpExecution | `openmetadata-spec/src/main/resources/json/schema/entity/ai/mcpExecution.json` | `org.openmetadata.schema.entity.ai.McpExecution` | `metadata.generated.schema.entity.ai.mcpExecution` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/ai/mcpExecution.ts` | — |
| McpServer | `openmetadata-spec/src/main/resources/json/schema/entity/ai/mcpServer.json` | `org.openmetadata.schema.entity.ai.McpServer` | `metadata.generated.schema.entity.ai.mcpServer` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/ai/mcpServer.ts` | `org.openmetadata.service.resources.ai.McpServerResource` |
| PromptTemplate | `openmetadata-spec/src/main/resources/json/schema/entity/ai/promptTemplate.json` | `org.openmetadata.schema.entity.ai.PromptTemplate` | `metadata.generated.schema.entity.ai.promptTemplate` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/ai/promptTemplate.ts` | `org.openmetadata.service.resources.ai.PromptTemplateResource` |

## entity/applications

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| App | `openmetadata-spec/src/main/resources/json/schema/entity/applications/app.json` | `org.openmetadata.schema.entity.app.App` | `metadata.generated.schema.entity.applications.app` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/applications/app.ts` | `org.openmetadata.service.resources.apps.AppResource` |
| AppMarketPlaceDefinition | `openmetadata-spec/src/main/resources/json/schema/entity/applications/marketplace/appMarketPlaceDefinition.json` | `org.openmetadata.schema.entity.app.AppMarketPlaceDefinition` | `metadata.generated.schema.entity.applications.marketplace.appMarketPlaceDefinition` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/applications/marketplace/appMarketPlaceDefinition.ts` | `org.openmetadata.service.resources.apps.AppMarketPlaceResource` |

## entity/automations

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| Workflow | `openmetadata-spec/src/main/resources/json/schema/entity/automations/workflow.json` | `org.openmetadata.schema.entity.automations.Workflow` | `metadata.generated.schema.entity.automations.workflow` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/automations/workflow.ts` | `org.openmetadata.service.resources.automations.WorkflowResource` |

## entity/classification

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| Classification | `openmetadata-spec/src/main/resources/json/schema/entity/classification/classification.json` | `org.openmetadata.schema.entity.classification.Classification` | `metadata.generated.schema.entity.classification.classification` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/classification/classification.ts` | `org.openmetadata.service.resources.tags.ClassificationResource` |
| Tag | `openmetadata-spec/src/main/resources/json/schema/entity/classification/tag.json` | `org.openmetadata.schema.entity.classification.Tag` | `metadata.generated.schema.entity.classification.tag` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/classification/tag.ts` | `org.openmetadata.service.resources.tags.TagResource` |

## entity/context

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| ContextMemory | `openmetadata-spec/src/main/resources/json/schema/entity/context/contextMemory.json` | `org.openmetadata.schema.entity.context.ContextMemory` | `metadata.generated.schema.entity.context.contextMemory` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/context/contextMemory.ts` | `org.openmetadata.service.resources.context.ContextMemoryResource` |

## entity/data

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| APICollection | `openmetadata-spec/src/main/resources/json/schema/entity/data/apiCollection.json` | `org.openmetadata.schema.entity.data.APICollection` | `metadata.generated.schema.entity.data.apiCollection` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/apiCollection.ts` | `org.openmetadata.service.resources.apis.APICollectionResource` |
| APIEndpoint | `openmetadata-spec/src/main/resources/json/schema/entity/data/apiEndpoint.json` | `org.openmetadata.schema.entity.data.APIEndpoint` | `metadata.generated.schema.entity.data.apiEndpoint` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/apiEndpoint.ts` | `org.openmetadata.service.resources.apis.APIEndpointResource` |
| Chart | `openmetadata-spec/src/main/resources/json/schema/entity/data/chart.json` | `org.openmetadata.schema.entity.data.Chart` | `metadata.generated.schema.entity.data.chart` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/chart.ts` | `org.openmetadata.service.resources.charts.ChartResource` |
| Container | `openmetadata-spec/src/main/resources/json/schema/entity/data/container.json` | `org.openmetadata.schema.entity.data.Container` | `metadata.generated.schema.entity.data.container` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/container.ts` | `org.openmetadata.service.resources.storages.ContainerResource` |
| ContextFile | `openmetadata-spec/src/main/resources/json/schema/entity/data/contextFile.json` | `org.openmetadata.schema.entity.data.ContextFile` | `metadata.generated.schema.entity.data.contextFile` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/contextFile.ts` | `org.openmetadata.service.resources.drive.ContextFileResource` |
| ContextFileContent | `openmetadata-spec/src/main/resources/json/schema/entity/data/contextFileContent.json` | `org.openmetadata.schema.entity.data.ContextFileContent` | `metadata.generated.schema.entity.data.contextFileContent` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/contextFileContent.ts` | — |
| Dashboard | `openmetadata-spec/src/main/resources/json/schema/entity/data/dashboard.json` | `org.openmetadata.schema.entity.data.Dashboard` | `metadata.generated.schema.entity.data.dashboard` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/dashboard.ts` | `org.openmetadata.service.resources.dashboards.DashboardResource` |
| DashboardDataModel | `openmetadata-spec/src/main/resources/json/schema/entity/data/dashboardDataModel.json` | `org.openmetadata.schema.entity.data.DashboardDataModel` | `metadata.generated.schema.entity.data.dashboardDataModel` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/dashboardDataModel.ts` | `org.openmetadata.service.resources.datamodels.DashboardDataModelResource` |
| DataContract | `openmetadata-spec/src/main/resources/json/schema/entity/data/dataContract.json` | `org.openmetadata.schema.entity.data.DataContract` | `metadata.generated.schema.entity.data.dataContract` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/dataContract.ts` | `org.openmetadata.service.resources.data.DataContractResource` |
| Database | `openmetadata-spec/src/main/resources/json/schema/entity/data/database.json` | `org.openmetadata.schema.entity.data.Database` | `metadata.generated.schema.entity.data.database` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/database.ts` | `org.openmetadata.service.resources.databases.DatabaseResource` |
| DatabaseSchema | `openmetadata-spec/src/main/resources/json/schema/entity/data/databaseSchema.json` | `org.openmetadata.schema.entity.data.DatabaseSchema` | `metadata.generated.schema.entity.data.databaseSchema` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/databaseSchema.ts` | `org.openmetadata.service.resources.databases.DatabaseSchemaResource` |
| Directory | `openmetadata-spec/src/main/resources/json/schema/entity/data/directory.json` | `org.openmetadata.schema.entity.data.Directory` | `metadata.generated.schema.entity.data.directory` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/directory.ts` | `org.openmetadata.service.resources.drives.DirectoryResource` |
| File | `openmetadata-spec/src/main/resources/json/schema/entity/data/file.json` | `org.openmetadata.schema.entity.data.File` | `metadata.generated.schema.entity.data.file` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/file.ts` | `org.openmetadata.service.resources.drives.FileResource` |
| Folder | `openmetadata-spec/src/main/resources/json/schema/entity/data/folder.json` | `org.openmetadata.schema.entity.data.Folder` | `metadata.generated.schema.entity.data.folder` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/folder.ts` | `org.openmetadata.service.resources.drive.FolderResource` |
| Glossary | `openmetadata-spec/src/main/resources/json/schema/entity/data/glossary.json` | `org.openmetadata.schema.entity.data.Glossary` | `metadata.generated.schema.entity.data.glossary` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/glossary.ts` | `org.openmetadata.service.resources.glossary.GlossaryResource` |
| GlossaryTerm | `openmetadata-spec/src/main/resources/json/schema/entity/data/glossaryTerm.json` | `org.openmetadata.schema.entity.data.GlossaryTerm` | `metadata.generated.schema.entity.data.glossaryTerm` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/glossaryTerm.ts` | `org.openmetadata.service.resources.glossary.GlossaryTermResource` |
| Metric | `openmetadata-spec/src/main/resources/json/schema/entity/data/metric.json` | `org.openmetadata.schema.entity.data.Metric` | `metadata.generated.schema.entity.data.metric` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/metric.ts` | `org.openmetadata.service.resources.metrics.MetricResource` |
| MetricGroup | `openmetadata-spec/src/main/resources/json/schema/entity/data/metricGroup.json` | `org.openmetadata.schema.entity.data.MetricGroup` | `metadata.generated.schema.entity.data.metricGroup` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/metricGroup.ts` | `org.openmetadata.service.resources.metrics.MetricGroupResource` |
| MlModel | `openmetadata-spec/src/main/resources/json/schema/entity/data/mlmodel.json` | `org.openmetadata.schema.entity.data.MlModel` | `metadata.generated.schema.entity.data.mlmodel` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/mlmodel.ts` | `org.openmetadata.service.resources.mlmodels.MlModelResource` |
| OntologyAxiom | `openmetadata-spec/src/main/resources/json/schema/entity/data/ontologyAxiom.json` | `org.openmetadata.schema.entity.data.OntologyAxiom` | `metadata.generated.schema.entity.data.ontologyAxiom` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/ontologyAxiom.ts` | `org.openmetadata.service.resources.ontology.OntologyAxiomResource` |
| OntologyChangeSet | `openmetadata-spec/src/main/resources/json/schema/entity/data/ontologyChangeSet.json` | `org.openmetadata.schema.entity.data.OntologyChangeSet` | `metadata.generated.schema.entity.data.ontologyChangeSet` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/ontologyChangeSet.ts` | `org.openmetadata.service.resources.ontology.OntologyChangeSetResource` |
| Page | `openmetadata-spec/src/main/resources/json/schema/entity/data/page.json` | `org.openmetadata.schema.entity.data.Page` | `metadata.generated.schema.entity.data.page` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/page.ts` | `org.openmetadata.service.resources.knowledge.KnowledgePageResource` |
| PageHierarchy | `openmetadata-spec/src/main/resources/json/schema/entity/data/pageHierarchy.json` | `org.openmetadata.schema.entity.data.PageHierarchy` | `metadata.generated.schema.entity.data.pageHierarchy` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/pageHierarchy.ts` | — |
| Pipeline | `openmetadata-spec/src/main/resources/json/schema/entity/data/pipeline.json` | `org.openmetadata.schema.entity.data.Pipeline` | `metadata.generated.schema.entity.data.pipeline` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/pipeline.ts` | `org.openmetadata.service.resources.pipelines.PipelineResource` |
| Query | `openmetadata-spec/src/main/resources/json/schema/entity/data/query.json` | `org.openmetadata.schema.entity.data.Query` | `metadata.generated.schema.entity.data.query` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/query.ts` | `org.openmetadata.service.resources.query.QueryResource` |
| QueryCostRecord | `openmetadata-spec/src/main/resources/json/schema/entity/data/queryCostRecord.json` | `org.openmetadata.schema.entity.data.QueryCostRecord` | `metadata.generated.schema.entity.data.queryCostRecord` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/queryCostRecord.ts` | — |
| RelationshipType | `openmetadata-spec/src/main/resources/json/schema/entity/data/relationshipType.json` | `org.openmetadata.schema.entity.data.RelationshipType` | `metadata.generated.schema.entity.data.relationshipType` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/relationshipType.ts` | `org.openmetadata.service.resources.ontology.RelationshipTypeResource` |
| Report | `openmetadata-spec/src/main/resources/json/schema/entity/data/report.json` | `org.openmetadata.schema.entity.data.Report` | `metadata.generated.schema.entity.data.report` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/report.ts` | `org.openmetadata.service.resources.reports.ReportResource` |
| SearchIndex | `openmetadata-spec/src/main/resources/json/schema/entity/data/searchIndex.json` | `org.openmetadata.schema.entity.data.SearchIndex` | `metadata.generated.schema.entity.data.searchIndex` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/searchIndex.ts` | `org.openmetadata.service.resources.searchindex.SearchIndexResource` |
| Spreadsheet | `openmetadata-spec/src/main/resources/json/schema/entity/data/spreadsheet.json` | `org.openmetadata.schema.entity.data.Spreadsheet` | `metadata.generated.schema.entity.data.spreadsheet` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/spreadsheet.ts` | `org.openmetadata.service.resources.drives.SpreadsheetResource` |
| StoredProcedure | `openmetadata-spec/src/main/resources/json/schema/entity/data/storedProcedure.json` | `org.openmetadata.schema.entity.data.StoredProcedure` | `metadata.generated.schema.entity.data.storedProcedure` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/storedProcedure.ts` | `org.openmetadata.service.resources.databases.StoredProcedureResource` |
| Table | `openmetadata-spec/src/main/resources/json/schema/entity/data/table.json` | `org.openmetadata.schema.entity.data.Table` | `metadata.generated.schema.entity.data.table` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/table.ts` | `org.openmetadata.service.resources.databases.TableResource` |
| Topic | `openmetadata-spec/src/main/resources/json/schema/entity/data/topic.json` | `org.openmetadata.schema.entity.data.Topic` | `metadata.generated.schema.entity.data.topic` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/topic.ts` | `org.openmetadata.service.resources.topics.TopicResource` |
| Worksheet | `openmetadata-spec/src/main/resources/json/schema/entity/data/worksheet.json` | `org.openmetadata.schema.entity.data.Worksheet` | `metadata.generated.schema.entity.data.worksheet` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/data/worksheet.ts` | `org.openmetadata.service.resources.drives.WorksheetResource` |

## entity/datacontract

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| DataContractResult | `openmetadata-spec/src/main/resources/json/schema/entity/datacontract/dataContractResult.json` | `org.openmetadata.schema.entity.datacontract.DataContractResult` | `metadata.generated.schema.entity.datacontract.dataContractResult` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/datacontract/dataContractResult.ts` | — |
| ODCSDataContract | `openmetadata-spec/src/main/resources/json/schema/entity/datacontract/odcs/odcsDataContract.json` | `org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract` | `metadata.generated.schema.entity.datacontract.odcs.odcsDataContract` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/datacontract/odcs/odcsDataContract.ts` | — |

## entity/docStore

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| Document | `openmetadata-spec/src/main/resources/json/schema/entity/docStore/document.json` | `org.openmetadata.schema.entities.docStore.Document` | `metadata.generated.schema.entity.docStore.document` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/docStore/document.ts` | `org.openmetadata.service.resources.docstore.DocStoreResource` |

## entity/domains

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| DataProduct | `openmetadata-spec/src/main/resources/json/schema/entity/domains/dataProduct.json` | `org.openmetadata.schema.entity.domains.DataProduct` | `metadata.generated.schema.entity.domains.dataProduct` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/domains/dataProduct.ts` | `org.openmetadata.service.resources.domains.DataProductResource` |
| Domain | `openmetadata-spec/src/main/resources/json/schema/entity/domains/domain.json` | `org.openmetadata.schema.entity.domains.Domain` | `metadata.generated.schema.entity.domains.domain` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/domains/domain.ts` | `org.openmetadata.service.resources.domains.DomainResource` |

## entity/events

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| NotificationTemplate | `openmetadata-spec/src/main/resources/json/schema/entity/events/notificationTemplate.json` | `org.openmetadata.schema.entity.events.NotificationTemplate` | `metadata.generated.schema.entity.events.notificationTemplate` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/events/notificationTemplate.ts` | `org.openmetadata.service.resources.events.NotificationTemplateResource` |

## entity/feed

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| Announcement | `openmetadata-spec/src/main/resources/json/schema/entity/feed/announcement.json` | `org.openmetadata.schema.entity.feed.Announcement` | `metadata.generated.schema.entity.feed.announcement` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/feed/announcement.ts` | `org.openmetadata.service.resources.feeds.AnnouncementResource` |
| Conversation | `openmetadata-spec/src/main/resources/json/schema/entity/feed/conversation.json` | `org.openmetadata.schema.entity.feed.Conversation` | `metadata.generated.schema.entity.feed.conversation` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/feed/conversation.ts` | — |
| ConversationReply | `openmetadata-spec/src/main/resources/json/schema/entity/feed/conversationReply.json` | `org.openmetadata.schema.entity.feed.ConversationReply` | `metadata.generated.schema.entity.feed.conversationReply` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/feed/conversationReply.ts` | — |
| TaskFormSchema | `openmetadata-spec/src/main/resources/json/schema/entity/feed/taskFormSchema.json` | `org.openmetadata.schema.entity.feed.TaskFormSchema` | `metadata.generated.schema.entity.feed.taskFormSchema` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/feed/taskFormSchema.ts` | `org.openmetadata.service.resources.feeds.TaskFormSchemaResource` |

## entity/learning

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| LearningResource | `openmetadata-spec/src/main/resources/json/schema/entity/learning/learningResource.json` | `org.openmetadata.schema.entity.learning.LearningResource` | `metadata.generated.schema.entity.learning.learningResource` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/learning/learningResource.ts` | `org.openmetadata.service.resources.learning.LearningResourceResource` |

## entity/policies

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| Policy | `openmetadata-spec/src/main/resources/json/schema/entity/policies/policy.json` | `org.openmetadata.schema.entity.policies.Policy` | `metadata.generated.schema.entity.policies.policy` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/policies/policy.ts` | `org.openmetadata.service.resources.policies.PolicyResource` |

## entity/services

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| ApiService | `openmetadata-spec/src/main/resources/json/schema/entity/services/apiService.json` | `org.openmetadata.schema.entity.services.ApiService` | `metadata.generated.schema.entity.services.apiService` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/apiService.ts` | — |
| DashboardService | `openmetadata-spec/src/main/resources/json/schema/entity/services/dashboardService.json` | `org.openmetadata.schema.entity.services.DashboardService` | `metadata.generated.schema.entity.services.dashboardService` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/dashboardService.ts` | — |
| DatabaseService | `openmetadata-spec/src/main/resources/json/schema/entity/services/databaseService.json` | `org.openmetadata.schema.entity.services.DatabaseService` | `metadata.generated.schema.entity.services.databaseService` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/databaseService.ts` | — |
| DriveService | `openmetadata-spec/src/main/resources/json/schema/entity/services/driveService.json` | `org.openmetadata.schema.entity.services.DriveService` | `metadata.generated.schema.entity.services.driveService` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/driveService.ts` | — |
| IngestionPipeline | `openmetadata-spec/src/main/resources/json/schema/entity/services/ingestionPipelines/ingestionPipeline.json` | `org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline` | `metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/ingestionPipelines/ingestionPipeline.ts` | `org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResource` |
| LLMService | `openmetadata-spec/src/main/resources/json/schema/entity/services/llmService.json` | `org.openmetadata.schema.entity.services.LLMService` | `metadata.generated.schema.entity.services.llmService` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/llmService.ts` | — |
| McpService | `openmetadata-spec/src/main/resources/json/schema/entity/services/mcpService.json` | `org.openmetadata.schema.entity.services.McpService` | `metadata.generated.schema.entity.services.mcpService` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/mcpService.ts` | — |
| MessagingService | `openmetadata-spec/src/main/resources/json/schema/entity/services/messagingService.json` | `org.openmetadata.schema.entity.services.MessagingService` | `metadata.generated.schema.entity.services.messagingService` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/messagingService.ts` | — |
| MetadataService | `openmetadata-spec/src/main/resources/json/schema/entity/services/metadataService.json` | `org.openmetadata.schema.entity.services.MetadataService` | `metadata.generated.schema.entity.services.metadataService` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/metadataService.ts` | — |
| MlModelService | `openmetadata-spec/src/main/resources/json/schema/entity/services/mlmodelService.json` | `org.openmetadata.schema.entity.services.MlModelService` | `metadata.generated.schema.entity.services.mlmodelService` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/mlmodelService.ts` | — |
| PipelineService | `openmetadata-spec/src/main/resources/json/schema/entity/services/pipelineService.json` | `org.openmetadata.schema.entity.services.PipelineService` | `metadata.generated.schema.entity.services.pipelineService` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/pipelineService.ts` | — |
| SearchService | `openmetadata-spec/src/main/resources/json/schema/entity/services/searchService.json` | `org.openmetadata.schema.entity.services.SearchService` | `metadata.generated.schema.entity.services.searchService` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/searchService.ts` | — |
| SecurityService | `openmetadata-spec/src/main/resources/json/schema/entity/services/securityService.json` | `org.openmetadata.schema.entity.services.SecurityService` | `metadata.generated.schema.entity.services.securityService` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/securityService.ts` | — |
| StorageService | `openmetadata-spec/src/main/resources/json/schema/entity/services/storageService.json` | `org.openmetadata.schema.entity.services.StorageService` | `metadata.generated.schema.entity.services.storageService` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/storageService.ts` | — |
| TestConnectionDefinition | `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/testConnectionDefinition.json` | `org.openmetadata.schema.entity.services.connections.TestConnectionDefinition` | `metadata.generated.schema.entity.services.connections.testConnectionDefinition` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/services/connections/testConnectionDefinition.ts` | `org.openmetadata.service.resources.services.connections.TestConnectionDefinitionResource` |

## entity/tasks

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| Task | `openmetadata-spec/src/main/resources/json/schema/entity/tasks/task.json` | `org.openmetadata.schema.entity.tasks.Task` | `metadata.generated.schema.entity.tasks.task` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/tasks/task.ts` | `org.openmetadata.service.resources.tasks.TaskResource` |

## entity/teams

| Entity | Schema | Java | Python | TypeScript | REST resource |
|---|---|---|---|---|---|
| Persona | `openmetadata-spec/src/main/resources/json/schema/entity/teams/persona.json` | `org.openmetadata.schema.entity.teams.Persona` | `metadata.generated.schema.entity.teams.persona` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/teams/persona.ts` | `org.openmetadata.service.resources.teams.PersonaResource` |
| Role | `openmetadata-spec/src/main/resources/json/schema/entity/teams/role.json` | `org.openmetadata.schema.entity.teams.Role` | `metadata.generated.schema.entity.teams.role` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/teams/role.ts` | `org.openmetadata.service.resources.teams.RoleResource` |
| Team | `openmetadata-spec/src/main/resources/json/schema/entity/teams/team.json` | `org.openmetadata.schema.entity.teams.Team` | `metadata.generated.schema.entity.teams.team` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/teams/team.ts` | `org.openmetadata.service.resources.teams.TeamResource` |
| TeamHierarchy | `openmetadata-spec/src/main/resources/json/schema/entity/teams/teamHierarchy.json` | `org.openmetadata.schema.entity.teams.TeamHierarchy` | `metadata.generated.schema.entity.teams.teamHierarchy` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/teams/teamHierarchy.ts` | — |
| User | `openmetadata-spec/src/main/resources/json/schema/entity/teams/user.json` | `org.openmetadata.schema.entity.teams.User` | `metadata.generated.schema.entity.teams.user` | `openmetadata-ui/src/main/resources/ui/src/generated/entity/teams/user.ts` | `org.openmetadata.service.resources.teams.UserResource` |
