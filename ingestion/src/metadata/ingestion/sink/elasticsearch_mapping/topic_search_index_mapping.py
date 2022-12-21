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
"""
Defines the Elasticsearch mapping for Topics
"""
import textwrap

TOPIC_ELASTICSEARCH_INDEX_MAPPING = textwrap.dedent(
    """
{
"settings": {
   "analysis": {
      "normalizer": {
        "lowercase_normalizer": {
          "type": "custom",
          "char_filter": [],
          "filter": [
            "lowercase"
          ]
        }
      },
      "analyzer": {
        "om_analyzer": {
          "tokenizer": "letter",
          "filter": [
            "lowercase",
            "om_stemmer"
          ]
        }
      },
      "filter": {
        "om_stemmer": {
          "type": "stemmer",
          "name": "english"
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "id": {
        "type": "text"
      },
      "name": {
        "type": "text",
        "fields": {
          "keyword": {
            "type": "keyword",
            "ignore_above": 256
          }
        }
      },
      "fullyQualifiedName": {
        "type": "text"
      },
      "displayName": {
        "type": "text",
        "analyzer": "om_analyzer"
      },
      "description": {
        "type": "text",
         "analyzer": "om_analyzer"
      },
      "version": {
        "type": "float"
      },
      "updatedAt": {
        "type": "date",
        "format": "epoch_second"
      },
      "updatedBy": {
        "type": "text"
      },
      "href": {
        "type": "text"
      },
      "messageSchema": {
        "properties": {
          "schemaType": {
            "type": "keyword",
            "normalizer": "lowercase_normalizer"
          },
          "schemaFields": {
            "properties": {
              "name": {
                "type": "keyword",
                "normalizer": "lowercase_normalizer",
                "fields": {
                  "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                  }
                }
              },
              "dataType": {
                "type": "text"
              },
              "description": {
                "type": "text",
                "analyzer": "om_analyzer"
              },
              "fullyQualifiedName": {
                "type": "text"
              },
              "tags": {
                "properties": {
                  "tagFQN": {
                    "type": "keyword"
                  },
                  "labelType": {
                    "type": "keyword"
                  },
                  "description": {
                    "type": "text"
                  },
                  "source": {
                    "type": "keyword"
                  },
                  "state": {
                    "type": "keyword"
                  }
                }
              }
            }
          }
        }
      },
      "cleanupPolicies": {
        "type": "keyword"
      },
      "replicationFactor": {
        "type": "integer"
      },
      "maximumMessageSize": {
        "type": "integer"
      },
      "retentionSize": {
        "type": "integer"
      },
      "service": {
        "properties": {
          "id": {
            "type": "keyword",
            "fields": {
              "keyword": {
                "type": "keyword",
                "ignore_above": 36
              }
            }
          },
          "type": {
            "type": "keyword"
          },
          "name": {
            "type": "keyword",
            "fields": {
              "keyword": {
                "type": "keyword",
                "ignore_above": 256
              }
            }
          },
          "fullyQualifiedName": {
            "type": "text"
          },
          "description": {
            "type": "text"
          },
          "deleted": {
            "type": "text"
          },
          "href": {
            "type": "text"
          }
        }
      },
      "owner": {
        "properties": {
          "id": {
            "type": "keyword",
            "fields": {
              "keyword": {
                "type": "keyword",
                "ignore_above": 36
              }
            }
          },
          "type": {
            "type": "keyword"
          },
          "name": {
            "type": "keyword",
            "fields": {
              "keyword": {
                "type": "keyword",
                "ignore_above": 256
              }
            }
          },
          "fullyQualifiedName": {
            "type": "text"
          },
          "description": {
            "type": "text"
          },
          "deleted": {
            "type": "text"
          },
          "href": {
            "type": "text"
          }
        }
      },
      "deleted": {
        "type": "text"
      },
      "followers": {
        "type": "keyword"
      },
      "tier": {
        "properties": {
          "tagFQN": {
            "type": "keyword"
          },
          "labelType": {
            "type": "keyword"
          },
          "description": {
            "type": "text"
          },
          "source": {
            "type": "keyword"
          },
          "state": {
            "type": "keyword"
          }
        }
      },
      "tags": {
        "properties": {
          "tagFQN": {
            "type": "keyword"
          },
          "labelType": {
            "type": "keyword"
          },
          "description": {
            "type": "text"
          },
          "source": {
            "type": "keyword"
          },
          "state": {
            "type": "keyword"
          }
        }
      },
      "serviceType": {
        "type": "keyword"
      },
      "entityType": {
        "type": "keyword"
      },
      "suggest": {
        "type": "completion",
        "contexts": [
          {
            "name": "deleted",
            "type": "category",
            "path": "deleted"
          }
        ]
      },
      "service_suggest": {
        "type": "completion"
      }
    }
  }
}
"""
)
