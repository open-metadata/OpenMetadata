import textwrap

TABLE_ELASTICSEARCH_INDEX_MAPPING = textwrap.dedent(
    """
    {
    "mappings":{
          "properties": {
            "table_name": {
              "type":"text",
              "analyzer": "keyword"
            },
            "schema": {
              "type":"text",
              "analyzer": "simple",
              "fields": {
                "raw": {
                  "type": "keyword"
                }
              }
            },
            "display_name": {
              "type": "keyword"
            },
            "owner": {
              "type": "keyword"
            },
            "followers": {
              "type": "keyword"
            },
            "last_updated_timestamp": {
              "type": "date",
              "format": "epoch_second"
            },
            "description": {
              "type": "text"
            },
            "tier": {
              "type": "keyword"
            },
            "column_names": {
              "type":"keyword"
            },
            "column_descriptions": {
              "type": "text"
            },
            "tags": {
              "type": "keyword"
            },
            "badges": {
              "type": "text"
            },
            "service": {
              "type": "keyword"
            },
            "service_type": {
              "type": "keyword"
            },
            "database": {
              "type": "keyword"
            },
            "suggest": {
              "type": "completion"
            },
            "monthly_stats":{
              "type": "long"
            },
            "weekly_stats":{
              "type": "long"
            },
            "daily_stats": {
              "type": "long"
            }
          }
        }
    }
    """
)