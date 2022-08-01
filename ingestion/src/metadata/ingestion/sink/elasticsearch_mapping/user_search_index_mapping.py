import textwrap

USER_ELASTICSEARCH_INDEX_MAPPING = textwrap.dedent(
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
            "email": {
              "type": "text"
             },
             "isAdmin": {
               "type": "text"
             }, 
             "teams": {
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
            "roles": {
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
            "inheritedRoles": {
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
            "entityType": {
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
