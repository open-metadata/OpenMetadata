package org.openmetadata.service.search;

public class UpdateSearchEventsConstant {
  private UpdateSearchEventsConstant() {
    /* Hidden constructor */
  }

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
}
