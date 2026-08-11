/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
/**
 * RDF indexing application configuration.
 */
export interface RDFIndexingAppConfig {
    /**
     * Maximum number of entities processed in a batch.
     */
    batchSize?: number;
    /**
     * Number of consumer threads to use for non-distributed RDF reindexing
     */
    consumerThreads?: number;
    /**
     * List of entities that you need to reindex. Leave empty to index all supported entities.
     */
    entities?: Entity[];
    /**
     * Number of entities per partition for distributed RDF indexing. Smaller values create more
     * partitions for better distribution across servers.
     */
    partitionSize?: number;
    /**
     * Number of producer threads to use for non-distributed RDF reindexing
     */
    producerThreads?: number;
    /**
     * Queue size to use internally for non-distributed RDF reindexing.
     */
    queueSize?: number;
    /**
     * Recreate the RDF store before indexing.
     */
    recreateIndex?: boolean;
    /**
     * Application Type
     */
    type?: RDFIndexingType;
    /**
     * Enable distributed RDF indexing across multiple servers with partition coordination and
     * recovery.
     */
    useDistributedIndexing?: boolean;
}

export enum Entity {
    AIApplication = "aiApplication",
    AIGovernancePolicy = "aiGovernancePolicy",
    APICollection = "apiCollection",
    APIEndpoint = "apiEndpoint",
    APIService = "apiService",
    App = "app",
    AppMarketPlaceDefinition = "appMarketPlaceDefinition",
    Bot = "bot",
    Chart = "chart",
    Classification = "classification",
    Container = "container",
    Dashboard = "dashboard",
    DashboardDataModel = "dashboardDataModel",
    DashboardService = "dashboardService",
    DataContract = "dataContract",
    DataInsightChart = "dataInsightChart",
    DataInsightCustomChart = "dataInsightCustomChart",
    DataProduct = "dataProduct",
    Database = "database",
    DatabaseSchema = "databaseSchema",
    DatabaseService = "databaseService",
    Directory = "directory",
    Document = "document",
    Domain = "domain",
    DriveService = "driveService",
    Eventsubscription = "eventsubscription",
    File = "file",
    Glossary = "glossary",
    GlossaryTerm = "glossaryTerm",
    IngestionPipeline = "ingestionPipeline",
    Kpi = "kpi",
    LearningResource = "learningResource",
    LlmModel = "llmModel",
    LlmService = "llmService",
    MessagingService = "messagingService",
    MetadataService = "metadataService",
    Metric = "metric",
    Mlmodel = "mlmodel",
    MlmodelService = "mlmodelService",
    NotificationTemplate = "notificationTemplate",
    Persona = "persona",
    Pipeline = "pipeline",
    PipelineService = "pipelineService",
    Policy = "policy",
    PromptTemplate = "promptTemplate",
    Query = "query",
    Report = "report",
    Role = "role",
    SearchIndex = "searchIndex",
    SearchService = "searchService",
    SecurityService = "securityService",
    Spreadsheet = "spreadsheet",
    StorageService = "storageService",
    StoredProcedure = "storedProcedure",
    Table = "table",
    Tag = "tag",
    Team = "team",
    TestCase = "testCase",
    TestConnectionDefinition = "testConnectionDefinition",
    TestDefinition = "testDefinition",
    TestSuite = "testSuite",
    Topic = "topic",
    Type = "type",
    User = "user",
    WebAnalyticEvent = "webAnalyticEvent",
    Workflow = "workflow",
    WorkflowDefinition = "workflowDefinition",
    Worksheet = "worksheet",
}

/**
 * Application Type
 *
 * Application type.
 */
export enum RDFIndexingType {
    RDFIndexing = "RdfIndexing",
}
