grammar EntityLink;

entitylink
    : RESERVED_START (separator entity_type separator nameOrFqn)+
      (separator entity_field (separator nameOrFqn)*)* '>' EOF
    ;


entity_type
    : ENTITY_TYPE # entityType
    ;

nameOrFqn
    : NAME_OR_FQN
    | ENTITY_TYPE
    | ENTITY_FIELD
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
    | 'securityService'
    | 'driveService'
    | 'webhook'
    | 'mlmodel'
    | 'team'
    | 'user'
    | 'bot'
    | 'role'
    | 'policy'
    | 'testSuite'
    | 'testCase'
    | 'testDefinition'
    | 'testConnectionDefinition'
    | 'dataInsightChart'
    | 'dataInsightCustomChart'
    | 'kpi'
    | 'alert'
    | 'container'
    | 'tag'
    | 'dashboardDataModel'
    | 'subscription'
    | 'chart'
    | 'domain'
    | 'dataProduct'
    | 'dataContract'
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
    | 'ingestionPipeline'
    | 'apiCollection'
    | 'apiEndpoint'
    | 'apiService'
    | 'workflowDefinition'
    | 'spreadsheet'
    | 'worksheet'
    | 'webAnalyticEvent'
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
    ;

    

NAME_OR_FQN
    : ( ~[:>] | ':' ~[:] | . '>' . )+
    ;
