grammar JdbcUri;

jdbcUrl
    : 'jdbc:' DATABASE_TYPE serverName? PORT_NUMBER? ('/' databaseName)? (CONNECTION_ARG_INIT CONNECTION_ARG (AMP CONNECTION_ARG)*)? schemaTable?
    ;

schemaTable
    : COLON (schemaName PERIOD)? tableName
    ;

databaseName
    : IDENTIFIER?
    ;

schemaName
    : IDENTIFIER
    ;

tableName
    : IDENTIFIER
    ;


DATABASE_TYPE
    : 'mysql'
    | 'postgresql'
    | 'oracle:thin'
    | 'clickhouse'
    | 'trino'
    | 'presto'
    | 'vertica'
    | 'hive2'
    | 'redshift'
    ;

URI_SEPARATOR
    : '://'
    | ':@//'
    | ':@'
    ;

serverName
    : HOST_NAME
    | IPV4_ADDRESS
    | IPV6_ADDRESS
    | URI_SEPARATOR IDENTIFIER
    | URI_SEPARATOR
    ;

PORT_NUMBER
    : COLON [0-9]+
    ;

IDENTIFIER
    : [a-zA-Z][a-zA-Z0-9_]*
    ;


HOST_NAME
    : URI_SEPARATOR [a-zA-Z][a-zA-Z0-9.-]*[a-zA-Z0-9]
    ;


IPV4_ADDRESS
    : URI_SEPARATOR [0-9]+ PERIOD [0-9]+ PERIOD [0-9]+ PERIOD [0-9]+
    ;

IPV6_ADDRESS
    : URI_SEPARATOR '[' HEXDIGIT+ (COLON HEXDIGIT+)* (COLON IPV4_ADDRESS)? ']'
    ;

HEXDIGIT
    : [0-9a-fA-F]
    ;

CONNECTION_ARG
    : IDENTIFIER '=' IDENTIFIER
    ;

CONNECTION_ARG_INIT
    : '?'
    ;

PERIOD
    : '.'
    ;

COLON
    : ':'
    ;

AMP
    : '&'
    ;

WS
    : [ \t\r\n]+ -> skip
    ;

