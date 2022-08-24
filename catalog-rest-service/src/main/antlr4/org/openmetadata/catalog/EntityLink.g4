grammar EntityLink;

entitylink
    : '<#E' ('::' entity)+ '>' EOF
    ;

entity
    : ENTITY_TYPE # entityType
    | ENTITY_FQN # entityFqn
    | ENTITY_FIELD # entityField
    ;

ENTITY_TYPE
    : 'table'
    | 'database'
    | 'databaseSchema'
    | 'metrics'
    | 'dashboard'
    | 'pipeline'
    | 'chart'
    | 'report'
    | 'topic'
    | 'mlmodel'
    | 'bot'
    | 'THREAD'
    | 'location'
    | 'glossary'
    | 'glossaryTerm'
    | 'tag'
    | 'tagCategory'
    | 'type'
    | 'testDefinition'
    | 'testSuite'
    | 'testCase'
    ;
ENTITY_FIELD
    : 'columns'
    | 'description' 
    | 'tags' 
    | 'tasks'
    ;
RESERVED
    : '::'
    ;
ENTITY_FQN
    : [a-zA-Z0-9,._"']+
    ;
