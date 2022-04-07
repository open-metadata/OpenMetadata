#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import textwrap

TABLE_ELASTICSEARCH_INDEX_MAPPING = textwrap.dedent(
    """
     {
    "mappings":{
          "properties": {
            "name": {
              "type":"text"
            },
            "display_name": {
              "type": "text"
            },
            "owner": {
              "type": "text"
            },
            "deleted": {
              "type": "boolean"
            },
            "followers": {
              "type": "keyword"
            },
            "fqdn": {
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
              "type":"text"
            },
            "column_descriptions": {
              "type": "text"
            },
            "tags": {
              "type": "keyword"
            },
            "service": {
              "type": "keyword"
            },
            "service_type": {
              "type": "keyword"
            },
            "service_category": {
              "type": "keyword"
            },
            "entity_type": {
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
            "monthly_percentile_rank":{
              "type": "long"
            },
            "weekly_stats":{
              "type": "long"
            },
            "weekly_percentile_rank":{
              "type": "long"
            },
            "daily_percentile_rank": {
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

TOPIC_ELASTICSEARCH_INDEX_MAPPING = textwrap.dedent(
    """
    {
    "mappings":{
          "properties": {
            "name": {
              "type":"text"
            },
            "display_name": {
              "type": "text"
            },
            "owner": {
              "type": "text"
            },
            "deleted": {
              "type": "boolean"
            },
            "followers": {
              "type": "keyword"
            },
            "fqdn": {
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
            "tags": {
              "type": "keyword"
            },
            "service": {
              "type": "keyword"
            },
            "service_type": {
              "type": "keyword"
            },
            "service_category": {
              "type": "keyword"
            },
            "entity_type": {
              "type": "keyword"
            },
            "suggest": {
              "type": "completion"
            }
         }
      }
    }
    """
)

DASHBOARD_ELASTICSEARCH_INDEX_MAPPING = textwrap.dedent(
    """
    {
    "mappings":{
          "properties": {
            "name": {
              "type":"text"
            },
            "display_name": {
              "type": "text"
            },
            "owner": {
              "type": "keyword"
            },
            "deleted": {
              "type": "boolean"
            },
            "fqdn": {
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
            "chart_names": {
              "type":"text"
            },
            "chart_descriptions": {
              "type": "text"
            },
            "tier": {
              "type": "keyword"
            },
            "tags": {
              "type": "keyword"
            },
            "service": {
              "type": "keyword"
            },
            "service_type": {
              "type": "keyword"
            },
            "service_category": {
              "type": "keyword"
            },
            "entity_type": {
              "type": "keyword"
            },
            "suggest": {
              "type": "completion"
            },
             "monthly_stats":{
              "type": "long"
            },
            "monthly_percentile_rank":{
              "type": "long"
            },
            "weekly_stats":{
              "type": "long"
            },
            "weekly_percentile_rank":{
              "type": "long"
            },
            "daily_percentile_rank": {
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

PIPELINE_ELASTICSEARCH_INDEX_MAPPING = textwrap.dedent(
    """
    {
    "mappings":{
          "properties": {
            "name": {
              "type":"text"
            },
            "display_name": {
              "type": "text"
            },
            "fqdn": {
              "type": "keyword"
            },
            "owner": {
              "type": "keyword"
            },
            "deleted": {
              "type": "boolean"
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
            "task_names": {
              "type":"text"
            },
            "task_descriptions": {
              "type": "text"
            },
            "tier": {
              "type": "keyword"
            },
            "tags": {
              "type": "keyword"
            },
            "service": {
              "type": "keyword"
            },
            "service_type": {
              "type": "keyword"
            },
            "service_category": {
              "type": "keyword"
            },
            "entity_type": {
              "type": "keyword"
            },
            "suggest": {
              "type": "completion"
            }
         }
      }
    }
    """
)

USER_ELASTICSEARCH_INDEX_MAPPING = textwrap.dedent(
    """
     {
    "mappings":{
          "properties": {
            "name": {
              "type":"text"
            },
            "display_name": {
              "type": "text"
            },
            "email": {
              "type": "text"
            },
            "last_updated_timestamp": {
              "type": "date",
              "format": "epoch_second"
            },
            "entity_type": {
              "type": "keyword"
            },
            "teams": {
              "type": "keyword"
            },
            "roles": {
              "type": "keyword"
            },
            "deleted": {
              "type": "boolean"
            },
            "suggest": {
              "type": "completion"
            }
          }
        }
    }
    """
)

TEAM_ELASTICSEARCH_INDEX_MAPPING = textwrap.dedent(
    """
     {
    "mappings":{
          "properties": {
            "name": {
              "type":"text"
            },
            "display_name": {
              "type": "text"
            },
            "last_updated_timestamp": {
              "type": "date",
              "format": "epoch_second"
            },
            "entity_type": {
              "type": "keyword"
            },
            "deleted": {
              "type": "boolean"
            },
            "users": {
              "type": "keyword"
            },
            "owns": {
              "type": "keyword"
            },
            "suggest": {
              "type": "completion"
            }
          }
        }
    }
    """
)

GLOSSARY_TERM_ELASTICSEARCH_INDEX_MAPPING = textwrap.dedent(
    """
     {
    "mappings": {
        "properties": {
          "name": {
            "type": "text"
          },
          "display_name": {
            "type": "text"
          },
           "fqdn": {
              "type": "keyword"
            },
          "owner": {
            "type": "keyword"
          },
         "last_updated_timestamp": {
            "type": "date",
            "format": "epoch_second"
         },
         "description": {
            "type": "text"
         },
        "glossary_name": {
            "type": "keyword"
         },
        "glossary_id": {
            "type": "keyword"
        },
        "deleted": {
            "type": "boolean"
        },
        "status": {
            "type": "keyword"
        },
        "tags": {
            "type": "keyword"
        },
        "entity_type": {
            "type": "keyword"
        },
        "suggest": {
            "type": "completion"
        }
      }
    }
  }
    """
)
