package org.openmetadata.service.search;

public class EntityBuilderConstant {
  public static final String UNIFIED = "unified";
  public static final String ES_MESSAGE_SCHEMA_FIELD = "messageSchema.schemaFields.name";
  public static final String ES_TAG_FQN_FIELD = "tags.tagFQN";
  public static final String NAME_KEYWORD = "name.keyword";
  public static final String FIELD_NAME_NGRAM = "name.ngram";
  public static final String DISPLAY_NAME_KEYWORD = "displayName.keyword";
  public static final String FIELD_DISPLAY_NAME_NGRAM = "displayName.ngram";
  public static final String FIELD_DESCRIPTION_NGRAM = "description.ngram";
  public static final String PRE_TAG = "<span class=\"text-highlighter\">";
  public static final String POST_TAG = "</span>";
  public static final Integer MAX_AGGREGATE_SIZE = 50;
  public static final Integer MAX_RESULT_HITS = 10000;
  public static final String QUERY = "query";
  public static final String QUERY_NGRAM = "query.ngram";

  private EntityBuilderConstant() {
    /* private constructor for utility class */
  }
}
