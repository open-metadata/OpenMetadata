import textwrap

GLOSSARY_TERM_ELASTICSEARCH_INDEX_MAPPING = textwrap.dedent(
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
            "synonyms": {
              "type": "text"
            },
             "glossary": {
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
            "children": {
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
            "relatedTerms": {
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
             "reviewers": {
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
            "usageCount": {
               "type": "integer"
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
            "deleted": {
              "type": "boolean"
            },
            "status": {
              "type": "text"
            },
            "suggest": {
              "type": "completion"
            }
         }
      }
   }
    """
)
