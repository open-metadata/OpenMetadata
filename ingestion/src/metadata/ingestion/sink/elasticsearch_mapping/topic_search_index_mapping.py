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

TOPIC_ELASTICSEARCH_INDEX_MAPPING = textwrap.dedent(
    """
     {
    "mappings":{
          "properties": {
            "id": {
              "type": "text"
            },
            "name": {
              "type":"text",
              "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                }
              }
            },
            "fullyQualifiedName": {
              "type":"text"
            },
            "displayName": {
              "type": "text",
              "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 256
                }
              }
            },
             "description": {
              "type": "text"
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
            "schemaText": {
              "type": "text"
             },
             "schemaType": {
               "type": "text"
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
               "type": "boolean"
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
               "type": "boolean"
              },
              "href": {
               "type": "text"
              }
             }
            },
            "deleted": {
              "type": "boolean"
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
              "type": "completion"
            },
            "service_suggest": {
              "type": "completion"
            }
         }
      }
   }
   """
)
