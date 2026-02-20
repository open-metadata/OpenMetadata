/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.search;

import static org.openmetadata.service.Entity.DATA_PRODUCT;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.InheritedFieldEntitySearch.InheritedFieldQuery;

@Slf4j
public class QueryFilterBuilder {

  private static final String QUERY_KEY = "query";
  private static final String BOOL_KEY = "bool";
  private static final String MUST_KEY = "must";
  private static final String MUST_NOT_KEY = "must_not";
  private static final String SHOULD_KEY = "should";
  private static final String TERM_KEY = "term";
  private static final String MATCH_KEY = "match";
  private static final String PREFIX_KEY = "prefix";
  private static final String DELETED_KEY = "deleted";
  private static final String ENTITY_TYPE_KEY = "entityType";
  private static final String EMPTY_JSON = "{}";
  private static final String HIERARCHY_SEPARATOR = ".";

  private static final ObjectMapper MAPPER = JsonUtils.getObjectMapper();

  public static String buildDomainAssetsFilter(InheritedFieldQuery query) {
    ObjectNode queryFilter = MAPPER.createObjectNode();
    ObjectNode queryNode = queryFilter.putObject(QUERY_KEY);
    ObjectNode boolNode = queryNode.putObject(BOOL_KEY);
    ArrayNode mustArray = boolNode.putArray(MUST_KEY);

    addHierarchyCondition(mustArray, query.getFieldPath(), query.getFieldValue());
    addCommonFilters(mustArray, query);

    // Exclude data products from domain assets
    ArrayNode mustNotArray = boolNode.putArray(MUST_NOT_KEY);
    ObjectNode dataProductNode = MAPPER.createObjectNode();
    dataProductNode.putObject(TERM_KEY).put(ENTITY_TYPE_KEY, DATA_PRODUCT);
    mustNotArray.add(dataProductNode);

    return serializeQuery(queryFilter);
  }

  public static String buildDomainAssetsCountFilter(String fieldPath) {
    ObjectNode queryFilter = MAPPER.createObjectNode();
    ObjectNode queryNode = queryFilter.putObject(QUERY_KEY);
    ObjectNode boolNode = queryNode.putObject(BOOL_KEY);
    ArrayNode mustArray = boolNode.putArray(MUST_KEY);

    // Must have domains field
    ObjectNode existsNode = MAPPER.createObjectNode();
    existsNode.putObject("exists").put("field", fieldPath);
    mustArray.add(existsNode);

    // Exclude data products from domain assets
    ArrayNode mustNotArray = boolNode.putArray(MUST_NOT_KEY);
    ObjectNode dataProductNode = MAPPER.createObjectNode();
    dataProductNode.putObject(TERM_KEY).put(ENTITY_TYPE_KEY, DATA_PRODUCT);
    mustNotArray.add(dataProductNode);

    return serializeQuery(queryFilter);
  }

  public static String buildOwnerAssetsFilter(InheritedFieldQuery query) {
    ObjectNode queryFilter = MAPPER.createObjectNode();
    ObjectNode queryNode = queryFilter.putObject(QUERY_KEY);
    ObjectNode boolNode = queryNode.putObject(BOOL_KEY);
    ArrayNode mustArray = boolNode.putArray(MUST_KEY);

    // owners.fullyQualifiedName is a text field, use match query for exact matching
    addMatchCondition(mustArray, query.getFieldPath(), query.getFieldValue());
    addCommonFilters(mustArray, query);

    return serializeQuery(queryFilter);
  }

  public static String buildTagAssetsFilter(InheritedFieldQuery query) {
    ObjectNode queryFilter = MAPPER.createObjectNode();
    ObjectNode queryNode = queryFilter.putObject(QUERY_KEY);
    ObjectNode boolNode = queryNode.putObject(BOOL_KEY);
    ArrayNode mustArray = boolNode.putArray(MUST_KEY);

    addExactMatchCondition(mustArray, query.getFieldPath(), query.getFieldValue());
    addCommonFilters(mustArray, query);

    return serializeQuery(queryFilter);
  }

  public static String buildGenericFilter(InheritedFieldQuery query) {
    ObjectNode queryFilter = MAPPER.createObjectNode();
    ObjectNode queryNode = queryFilter.putObject(QUERY_KEY);
    ObjectNode boolNode = queryNode.putObject(BOOL_KEY);
    ArrayNode mustArray = boolNode.putArray(MUST_KEY);

    if (query.isSupportsHierarchy()) {
      addHierarchyCondition(mustArray, query.getFieldPath(), query.getFieldValue());
    } else {
      addExactMatchCondition(mustArray, query.getFieldPath(), query.getFieldValue());
    }
    addCommonFilters(mustArray, query);

    return serializeQuery(queryFilter);
  }

  public static String buildUserAssetsFilter(InheritedFieldQuery query) {
    ObjectNode queryFilter = MAPPER.createObjectNode();
    ObjectNode queryNode = queryFilter.putObject(QUERY_KEY);
    ObjectNode boolNode = queryNode.putObject(BOOL_KEY);
    ArrayNode mustArray = boolNode.putArray(MUST_KEY);

    // owners.id is a keyword field, use term query with OR condition
    addOrCondition(mustArray, query.getFieldPath(), query.getFieldValues());
    addCommonFilters(mustArray, query);

    return serializeQuery(queryFilter);
  }

  private static void addHierarchyCondition(
      ArrayNode mustArray, String fieldPath, String fieldValue) {
    ObjectNode fieldCondition = MAPPER.createObjectNode();
    ObjectNode innerBool = fieldCondition.putObject(BOOL_KEY);
    ArrayNode shouldArray = innerBool.putArray(SHOULD_KEY);

    ObjectNode termNode = MAPPER.createObjectNode();
    termNode.putObject(TERM_KEY).put(fieldPath, fieldValue);
    shouldArray.add(termNode);

    ObjectNode prefixNode = MAPPER.createObjectNode();
    prefixNode.putObject(PREFIX_KEY).put(fieldPath, fieldValue + HIERARCHY_SEPARATOR);
    shouldArray.add(prefixNode);

    mustArray.add(fieldCondition);
  }

  private static void addExactMatchCondition(
      ArrayNode mustArray, String fieldPath, String fieldValue) {
    ObjectNode termNode = MAPPER.createObjectNode();
    termNode.putObject(TERM_KEY).put(fieldPath, fieldValue);
    mustArray.add(termNode);
  }

  private static void addMatchCondition(ArrayNode mustArray, String fieldPath, String fieldValue) {
    ObjectNode matchNode = MAPPER.createObjectNode();
    matchNode.putObject(MATCH_KEY).put(fieldPath, fieldValue);
    mustArray.add(matchNode);
  }

  private static void addOrCondition(
      ArrayNode mustArray, String fieldPath, List<String> fieldValues) {
    ObjectNode orCondition = MAPPER.createObjectNode();
    ObjectNode innerBool = orCondition.putObject(BOOL_KEY);
    ArrayNode shouldArray = innerBool.putArray(SHOULD_KEY);

    for (String value : fieldValues) {
      ObjectNode termNode = MAPPER.createObjectNode();
      termNode.putObject(TERM_KEY).put(fieldPath, value);
      shouldArray.add(termNode);
    }

    mustArray.add(orCondition);
  }

  private static void addCommonFilters(ArrayNode mustArray, InheritedFieldQuery query) {
    if (!query.isIncludeDeleted()) {
      ObjectNode deletedNode = MAPPER.createObjectNode();
      deletedNode.putObject(TERM_KEY).put(DELETED_KEY, false);
      mustArray.add(deletedNode);
    }

    if (query.getEntityTypeFilter() != null && !query.getEntityTypeFilter().isEmpty()) {
      ObjectNode entityTypeNode = MAPPER.createObjectNode();
      entityTypeNode.putObject(TERM_KEY).put(ENTITY_TYPE_KEY, query.getEntityTypeFilter());
      mustArray.add(entityTypeNode);
    }
  }

  private static String serializeQuery(ObjectNode queryFilter) {
    try {
      return MAPPER.writeValueAsString(queryFilter);
    } catch (JsonProcessingException e) {
      LOG.warn("Failed to serialize query filter", e);
      return EMPTY_JSON;
    }
  }
}
