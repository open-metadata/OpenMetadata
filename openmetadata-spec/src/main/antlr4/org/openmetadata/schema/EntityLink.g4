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
