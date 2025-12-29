-- Insert Snowflake service with OAuth directly into database
-- This bypasses the Pydantic validation that doesn't support OAuth yet

-- First, let's prepare the connection config with OAuth
SET @service_json = JSON_OBJECT(
    'type', 'Snowflake',
    'account', 'FMFAHQK-GI58232',
    'warehouse', 'COMPUTE_WH',
    'database', 'CUSTOMERS',
    'username', 'VISHNU',
    'oauth', JSON_OBJECT(
        'clientId', '7ln6la3T0vzF4Nh0ttFw+1ULjkU=',
        'clientSecret', '2lduQWNOg4UKPiUVQXowVmxd5aS7rp/esu4GNcRCqcM=',
        'accessToken', 'ver:1-hint:754067412131846-ETMsDgAAAZtnMmkQABRBRVMvQ0JDL1BLQ1M1UGFkZGluZwEAABAAEC2AY/z63M3n8e4VBmxx9B0AAACwvUccsE/bCyOpExmSMBIzZMkZOFC+SPLec56vdnHhr5aTbsPh6cVba5iGaqETkT8TSox1Mz27hAPQ5uxBSka46P3h3NRUmMfQCXxf6reLUYbCp0Y0ia5W3FUAfRxfqNqixAoB3sxs+3p/yB5knrTr8tPaDKOP9CnYlGqWHe+F1fesCj5DOWOt/yyhz8t9UYsboteOdH8j5LaYMcQkQAWkPYzWnKkzEx2vteIMysSQsBkAFNHOqm972OqYX5gOGjeVpmhXJEu/',
        'refreshToken', 'ver:2-hint:11506176005-did:1011-ETMsDgAAAZtnMmkQABRBRVMvQ0JDL1BLQ1M1UGFkZGluZwEAABAAEOkBTh036dAR83adHmqbPCwAAAFgZgrd/cSx6SfBdYGoLm15d030QlbvrTLdgEyUxoRy1O88xkVI+tOQOGwpO6NwEDQT4GIv/x8ia/2eJ0BfvhdB7IuL0vdTSdtkXTz+WmkdmeLv4ILl2g0zbDYeWqe8MEMikIhF8zv5wyQ9FRH8mIm6xfloF6q10S5T2tLNwisBy55jcCx4SftfZok2XcSnw2W6RDUck3FssF0FOKj85tMJQXcl5jn5WZLRiwzjHJpuSAjA3wLRm/zg8WESE/aLxPDw8AWy8JfJEtVURRAiNgtTpHWrtEa9n24bqg5p8If+MPT7TogB6EFjtqIKQehGmUYZ66nmj7XlVeSKiUF/kL1TVjW3BqusodVcg08IIzOtV5s6Zyf0GBJZ+QD2lzW8TIw9A5uofUeey+r6kG6+RhO+2hWVADWuIBcjSgJjbh2ESWC0tKsiB6pAy8MV7tvTwlCMtdqV1zWXstmsMQgxoTSudgAUq5KLNZUaXJ5Bh/dLkHTSzbyANI0=',
        'tokenEndpoint', 'https://FMFAHQK-GI58232.snowflakecomputing.com/oauth/token-request',
        'expiresAt', UNIX_TIMESTAMP() + 599,
        'scopes', JSON_ARRAY()
    )
);

-- Insert the database service
INSERT INTO database_service (id, name, serviceType, json, updatedAt, updatedBy, deleted)
VALUES (
    UUID(),
    'test-snowflake-mcp',
    'Snowflake',
    JSON_OBJECT(
        'name', 'test-snowflake-mcp',
        'serviceType', 'Snowflake',
        'connection', JSON_OBJECT(
            'config', @service_json
        )
    ),
    UNIX_TIMESTAMP() * 1000,
    'admin',
    0
)
ON DUPLICATE KEY UPDATE
    json = JSON_OBJECT(
        'name', 'test-snowflake-mcp',
        'serviceType', 'Snowflake',
        'connection', JSON_OBJECT(
            'config', @service_json
        )
    ),
    updatedAt = UNIX_TIMESTAMP() * 1000;

SELECT 'Snowflake service created successfully!' AS result;
