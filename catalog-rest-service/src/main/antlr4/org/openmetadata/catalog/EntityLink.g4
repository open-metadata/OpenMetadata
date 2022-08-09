grammar EntityLink;

entitylink: STARTPOINT SEPARATOR ENTITY_TYPE SEPARATOR ENTITY_FQN (SEPARATOR ENTITY_FIELD (SEPARATOR ENTITY_ATTRIBUTE)*)* ENDPOINT;

ENTITY_TYPE: ('table'|'pipeline'|'dashboard'|'topic');
STARTPOINT: '<#E' ;
ENDPOINT: '>';
SEPARATOR: '::';
ENTITY_FIELD: ('columns'| 'description' | 'tags' | 'tasks' );
ENTITY_ATTRIBUTE: [a-z]+;
ENTITY_FQN: [a-zA-Z0-9,._"']+ ;
