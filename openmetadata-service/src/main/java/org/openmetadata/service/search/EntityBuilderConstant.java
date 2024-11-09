package org.openmetadata.service.search;

public class EntityBuilderConstant {

  public static final String FIELD_DESCRIPTION = "description";
  public static final String FIELD_FOLLOWERS = "followers";
  public static final String FIELD_TAGS = "tags";
  public static final String UNIFIED = "unified";
  public static final String ES_MESSAGE_SCHEMA_FIELD = "messageSchema.schemaFields.name";
  public static final String ES_MESSAGE_SCHEMA_FIELD_KEYWORD =
      "messageSchema.schemaFields.name.keyword";
  public static final String API_RESPONSE_SCHEMA_FIELD = "responseSchema.schemaFields.name";
  public static final String API_RESPONSE_SCHEMA_FIELD_KEYWORD =
      "responseSchema.schemaFields.name.keyword";
  public static final String ES_TAG_FQN_FIELD = "tags.tagFQN";

  public static final String COLUMNS_NAME_KEYWORD = "columns.name.keyword";
  public static final String FIELD_COLUMN_NAMES = "columnNames";
  public static final String SCHEMA_FIELD_NAMES = "fieldNames";
  public static final String OWNER_DISPLAY_NAME_KEYWORD = "owners.displayName.keyword";
  public static final String DOMAIN_DISPLAY_NAME_KEYWORD = "domain.displayName.keyword";
  public static final String DATA_MODEL_COLUMNS_NAME_KEYWORD = "dataModel.columns.name.keyword";
  public static final String NAME_KEYWORD = "name.keyword";
  public static final String FIELD_NAME_NGRAM = "name.ngram";
  public static final String DISPLAY_NAME_KEYWORD = "displayName.keyword";
  public static final String FIELD_DISPLAY_NAME_NGRAM = "displayName.ngram";
  public static final String PRE_TAG = "<span class=\"text-highlighter\">";
  public static final String POST_TAG = "</span>";
  public static final Integer MAX_AGGREGATE_SIZE = 10000;
  public static final Integer MAX_RESULT_HITS = 10000;
  public static final Integer MAX_ANALYZED_OFFSET = 1000;
  public static final String QUERY = "query";
  public static final String QUERY_NGRAM = "query.ngram";

  public static final String FULLY_QUALIFIED_NAME_PARTS = "fqnParts";

  public static final String FULLY_QUALIFIED_NAME = "fullyQualifiedName";

  private EntityBuilderConstant() {
    /* private constructor for utility class */
  }
}
