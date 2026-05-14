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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class SearchFieldResolutionTest {

  @Test
  void convertsTextFieldsToKeyword() {
    assertEquals(
        "name.keyword", SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("name"));
    assertEquals(
        "displayName.keyword",
        SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("displayName"));
  }

  @Test
  void preservesFieldsAlreadyWithKeywordSuffix() {
    assertEquals(
        "name.keyword",
        SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("name.keyword"));
    assertEquals(
        "displayName.keyword",
        SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("displayName.keyword"));
  }

  @Test
  void preservesSpecialEsFields() {
    assertEquals("_score", SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("_score"));
    assertEquals("_key", SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("_key"));
    assertEquals("_count", SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("_count"));
  }

  @Test
  void preservesNestedPathsAlreadyQualified() {
    assertEquals(
        "columns.name.keyword",
        SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("columns.name.keyword"));
    assertEquals(
        "tags.tagFQN", SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("tags.tagFQN"));
    assertEquals(
        "domains.fullyQualifiedName",
        SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("domains.fullyQualifiedName"));
  }

  @Test
  void doesNotAppendKeywordToNestedTextPaths() {
    assertEquals(
        "columns.name",
        SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("columns.name"));
    assertEquals(
        "service.name",
        SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("service.name"));
  }

  @Test
  void preservesFlatKeywordSortFields() {
    assertEquals(
        "ownerDisplayName",
        SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("ownerDisplayName"));
    assertEquals(
        "ownerName", SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("ownerName"));
  }

  @Test
  void remapsOwnerFields() {
    assertEquals(
        "ownerDisplayName",
        SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("owners.displayName.keyword"));
    assertEquals(
        "ownerName",
        SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("owners.name.keyword"));
    assertEquals(
        "ownerDisplayName",
        SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("owners.displayName"));
    assertEquals(
        "ownerName", SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("owners.name"));
  }

  @Test
  void preservesNumericAndDateFields() {
    assertEquals(
        "timestamp", SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("timestamp"));
    assertEquals(
        "updatedAt", SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("updatedAt"));
    assertEquals("version", SearchSourceBuilderFactory.resolveFieldForSortOrAggregation("version"));
  }

  @Test
  void handlesNullAndEmpty() {
    assertNull(SearchSourceBuilderFactory.resolveFieldForSortOrAggregation(null));
    assertEquals("", SearchSourceBuilderFactory.resolveFieldForSortOrAggregation(""));
  }
}
