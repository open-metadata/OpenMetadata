grammar EntityLink;

entitylink: startpoint (RESERVED link)+ endpoint EOF;
link:  (entity_type|ENTITY_FQN|entity_field|ENTITY_ATTRIBUTE)*;

RESERVED: '::';
ENTITY_ATTRIBUTE: [a-z]+;
ENTITY_FQN: [a-zA-Z0-9,._"']+ ;
startpoint: '<#E';
endpoint: '>';
entity_type: ('table'|'database'|'databaseSchema'|'metrics'|'dashboard'|'pipeline'|'chart'|'report'|'topic'|'mlmodel'|'bot'|'THREAD'|'location'|'glossary'|'glossaryTerm'|'tag'|'tagCategory'|'type'|'testDefinition'|'testSuite'|'testCase');
entity_field: ('columns'| 'description' | 'tags' | 'tasks' );
