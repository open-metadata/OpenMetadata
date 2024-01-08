grammar EntityLink;

entitylink
    : RESERVED_START (RESERVED_SEPARATOR ENTITY_TYPE RESERVED_SEPARATOR NAME_OR_FQN)+ 
      (RESERVED_SEPARATOR ENTITY_FIELD (RESERVED_SEPARATOR NAME_OR_FQN)+)* RESERVED_END EOF
    ;

RESERVED_SEPARATOR
    : '::'
    ;

RESERVED_START
    : '<#E'
    ;

RESERVED_END
    : '>'
    ;

ENTITY_TYPE
    : 'table' | 'database' | 'databaseSchema' | 'metrics' | 'dashboard' | 'pipeline'
    | 'chart' | 'report' | 'topic' | 'mlmodel' | 'bot' | 'THREAD' | 'location'
    | 'glossary' | 'glossaryTerm' | 'tag' | 'classification' | 'type'
    | 'testDefinition' | 'testSuite' | 'testCase' | 'dashboardDataModel'
    ;

ENTITY_FIELD
    : 'columns' | 'description' | 'tags' | 'tasks'
    ;

NAME_OR_FQN
    : ~(':')+ ('>')*? ~(':'|'>')+
    ;
