grammar EntityLink;

entitylink
    : RESERVED_START (separator entity_type separator name_or_fqn)+
      (separator entity_field (separator name_or_fqn)*)* '>' EOF
    ;


entity_type
    : ENTITY_TYPE # entityType
    ;

name_or_fqn
    : NAME_OR_FQN # nameOrFQN
    ;

entity_field
    : ENTITY_FIELD # entityField
    ;


separator
    : '::'
    ;

RESERVED_START
    : '<#E'
    ;

ENTITY_TYPE
    : 'table'
    | 'topic'
    | 'classification'
    | 'dashboard'
    | 'pipeline'
    | 'database'
    | 'databaseSchema'
    | 'glossary'
    | 'glossaryTerm'
    | 'databaseService'
    | 'messagingService'
    | 'metadataService'
    | 'dashboardService'
    | 'pipelineService'
    | 'mlmodelService'
    | 'storageService'
    | 'searchService'
    | 'webhook'
    | 'mlmodel'
    | 'type'
    | 'team'
    | 'user'
    | 'bot'
    | 'role'
    | 'policy'
    | 'testSuite'
    | 'testCase'
    | 'dataInsightChart'
    | 'kpi'
    | 'alert'
    | 'container'
    | 'tag'
    | 'dashboardDataModel'
    | 'subscription'
    | 'chart'
    | 'domain'
    | 'dataProduct'
    | 'sampleData'
    | 'storedProcedure'
    | 'searchIndex'
    | 'appMarketPlaceDefinition'
    | 'app'
    | 'persona'
    | 'docStore'
    | 'page'
    | 'KnowLedgePanels'
    | 'govern'
    | 'all'
    | 'customMetric'
    | 'eventsubscription'
    ;

ENTITY_FIELD
    : 'description'
    | 'columns'
    | 'schemaFields'
    | 'tags'
    | 'tasks'
    | 'mlFeatures'
    | 'schemaText'
    | 'owner'
    | 'reviewers'
    | 'synonyms'
    | 'relatedTerms'
    | 'references'
    | 'extension'
    | 'displayName'
    | 'name'
    | 'messageSchema'
    | 'charts'
    | 'dataModel'
    | 'constraint'
    | 'tableConstraints'
    | 'partitions'
    | 'replicationFactor'
    | 'sourceUrl'
    | 'mutuallyExclusive'
    | 'experts'
    | 'fields'
    | 'followers'
    | 'appConfiguration'
    | 'appSchedule'
    | 'votes'
    | 'profile'
    | 'roles'
    | 'deleted'
    | 'lifeCycle'
    | 'api_client_id'
    | 'sourceHash'
    | 'testCaseResult'
    | 'tests'
    | 'pipelineStatus'
    | 'dataProducts'
    | 'parameterValues'
    | 'retentionPeriod'
    | 'parent'
    | 'teams'
    | 'personas'
    | 'ingestionPipeline'
    ;

    

NAME_OR_FQN
    : ~(':')+ ('>')*? ~(':'|'>')+
    ;
