/*
 *  Copyright 2024 Collate.
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

import java.util.List;
import java.util.Set;

/**
 * Single source of truth for the denormalized search-index fields that product features beyond
 * Explore depend on. RBAC, Data Quality, Incident Manager, Lineage, and Data Insights all query
 * these fields directly, so renaming, retyping, or dropping one of them in a mapping silently
 * breaks those consumers (empty facets, wrong access-control results, zeroed Data Quality widgets)
 * with no compile-time or boot-time failure.
 *
 * <p>{@code SearchConsumerFieldContractTest} references this class so the contract lives in one
 * place: it fails CI when a shipped mapping file renames, retypes, or drops one of these fields.
 * (Deployed-index staleness is covered separately by {@code SystemRepository}'s "Search Reindex
 * Status" check, which compares mapping hashes rather than these specific fields.)
 */
public final class SearchConsumerFields {
  private SearchConsumerFields() {}

  /**
   * A denormalized leaf field and the type it must keep. Validated "where present" — a mapping that
   * does not define the path is out of scope (e.g. {@code testCaseResult.testCaseStatus} exists
   * only on the test-case indexes). Catches the dangerous silent break: a retype (keyword to text)
   * that kills the aggregations, sorts, and term filters every consumer builds on these fields.
   */
  public record ConsumerField(String path, String expectedType, String consumers) {}

  public static final List<ConsumerField> TYPED_LEAF_FIELDS =
      List.of(
          new ConsumerField(
              "tags.tagFQN",
              "keyword",
              "RBAC tag rules, Explore tag facet, Data Quality tag filter, column-lineage tags"),
          new ConsumerField(
              "tier.tagFQN",
              "keyword",
              "RBAC Tier rules, Explore tier facet, Data Quality tier widgets, Data Insights tier"),
          new ConsumerField(
              "certification.tagLabel.tagFQN",
              "keyword",
              "RBAC certification rules, Explore and Data Quality certification filters"),
          new ConsumerField(
              "classificationTags", "keyword", "Explore classification facet, tag aggregations"),
          new ConsumerField("glossaryTags", "keyword", "Explore glossary facet, tag aggregations"),
          new ConsumerField(
              "domains.fullyQualifiedName",
              "keyword",
              "RBAC domain rules, Data Quality and Incident domain filters, domain asset counts"),
          new ConsumerField(
              "fqnParts", "keyword", "Search autocomplete/suggest, hierarchical search"),
          new ConsumerField(
              "testCaseResult.testCaseStatus",
              "keyword",
              "Test Suite execution summary, Data Quality status filter"),
          new ConsumerField(
              "testCaseResolutionStatusType",
              "keyword",
              "Incident Manager listing and aggregations"));

  /**
   * Core data-asset entity types verified to expose the full denormalized field set at the top
   * level. Used as a canary: the shared doc-builder pipeline writes these fields into every data
   * asset, so if it drops one it drops from all of these at once. {@code table} is intentionally
   * excluded — its static mapping does not declare {@code fqnParts} top-level (it is dynamically
   * mapped), which would be a false positive for that one field.
   */
  public static final Set<String> CANARY_DATA_ASSET_ENTITIES =
      Set.of(
          "dashboard",
          "pipeline",
          "topic",
          "container",
          "mlmodel",
          "dashboardDataModel",
          "searchIndex",
          "apiEndpoint",
          "metric",
          "chart");

  /** Top-level denormalized fields every {@link #CANARY_DATA_ASSET_ENTITIES} index must expose. */
  public static final Set<String> CANARY_REQUIRED_TOP_LEVEL_FIELDS =
      Set.of(
          "fqnParts",
          "tier",
          "tags",
          "owners",
          "domains",
          "certification",
          "classificationTags",
          "glossaryTags");
}
