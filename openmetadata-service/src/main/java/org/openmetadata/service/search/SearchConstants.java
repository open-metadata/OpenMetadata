package org.openmetadata.service.search;

public class SearchConstants {
  private SearchConstants() {}

  public static final String SERVICE_ID = "service.id";
  public static final String SERVICE_NAME = "service.name";
  public static final String DATABASE_NAME = "database.name";

  public static final String DATABASE_ID = "database.id";

  public static final String DATABASE_SCHEMA_ID = "databaseSchema.id";
  public static final String SENDING_REQUEST_TO_ELASTIC_SEARCH =
      "Sending request to ElasticSearch {}";
  public static final String TAGS_FQN = "tags.tagFQN";

  public static final String PARENT = "parent";
  public static final String TEST_SUITES = "testSuites";
  public static final String SEARCH_SOURCE = "_source";

  public static final String CONTENT_TYPE = "application/json";
  public static final String CONTENT_TYPE_HEADER = "content-type";
  public static final String HITS = "hits";

  public static final String FULLY_QUALIFIED_NAME = "fullyQualifiedName";
  public static final String ENTITY_TYPE = "entityType";
  public static final String ID = "id";
  public static final String QUERY = "query";
  public static final String INDEX = "index";
  public static final String BOOL = "bool";
  public static final String FILTER = "filter";

  public static final String FAILED_TO_CREATE_INDEX_MESSAGE =
      "Failed to Create Index for entity {} due to ";

  public static final String DATA_ASSET = "dataAsset";
}
