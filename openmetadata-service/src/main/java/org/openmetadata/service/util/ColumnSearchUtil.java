/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTagsWithPreFetched;
import static org.openmetadata.service.resources.tags.TagLabelUtil.batchFetchDerivedTags;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Shared server-side column search + tag/glossary filtering for entities whose children are {@link
 * Column} trees (Table, Dashboard Data Model). Keeps the paginated column search consistent across
 * entities: a matched node is returned at its real depth under its ancestor path, and the tag
 * filter resolves the same direct + glossary-derived tags shown on each column.
 */
@Slf4j
public final class ColumnSearchUtil {
  private ColumnSearchUtil() {}

  private static final String SORT_BY_ORDINAL_POSITION = "ordinalPosition";
  private static final String SORT_ORDER_DESC = "desc";

  /**
   * Column-level tag filter. {@code tagFQNs} and {@code glossaryTermFQNs} mirror the two independent
   * column filters in the UI. Values within each group are OR-ed; the two groups are AND-ed when
   * both are present (matching AntD's cross-column filter semantics).
   */
  public record ColumnTagFilter(Set<String> tagFQNs, Set<String> glossaryTermFQNs) {
    public boolean isEmpty() {
      return nullOrEmpty(tagFQNs) && nullOrEmpty(glossaryTermFQNs);
    }
  }

  /**
   * Prune the column tree to nodes that match the search term and tag filter, keeping every matched
   * node at its real depth together with its ancestor path. Mirrors the UI's getFilteredTagsData so
   * the server-side filter renders the same nested view, paginated across the whole entity instead
   * of the loaded page. A node is kept when it matches itself or has a kept descendant; a kept
   * node's children are pruned to the matched paths only.
   */
  public static List<Column> pruneColumnsToMatches(
      List<Column> columns,
      String searchTerm,
      ColumnTagFilter columnTagFilter,
      Map<String, List<TagLabel>> tagsByHash) {
    List<Column> pruned = new ArrayList<>();
    for (Column column : columns) {
      List<Column> prunedChildren =
          nullOrEmpty(column.getChildren())
              ? new ArrayList<>()
              : pruneColumnsToMatches(
                  column.getChildren(), searchTerm, columnTagFilter, tagsByHash);
      boolean matches = columnMatchesSearch(column, searchTerm, columnTagFilter, tagsByHash);
      if (matches || !prunedChildren.isEmpty()) {
        column.setChildren(prunedChildren);
        pruned.add(column);
      }
    }
    return pruned;
  }

  private static boolean columnMatchesSearch(
      Column column,
      String searchTerm,
      ColumnTagFilter columnTagFilter,
      Map<String, List<TagLabel>> tagsByHash) {
    boolean matchesQuery = searchTerm == null || columnNameMatches(column, searchTerm);
    boolean matchesTags =
        columnTagFilter == null
            || columnTagFilter.isEmpty()
            || columnMatchesTagFilter(column, columnTagFilter, tagsByHash);
    return matchesQuery && matchesTags;
  }

  private static boolean columnNameMatches(Column column, String searchTerm) {
    boolean nameMatches =
        column.getName() != null && column.getName().toLowerCase().contains(searchTerm);
    boolean displayNameMatches =
        column.getDisplayName() != null
            && column.getDisplayName().toLowerCase().contains(searchTerm);
    return nameMatches || displayNameMatches;
  }

  public static Comparator<Column> columnComparator(String sortBy, String sortOrder) {
    Comparator<Column> comparator;
    if (SORT_BY_ORDINAL_POSITION.equals(sortBy)) {
      comparator =
          Comparator.comparing(
              Column::getOrdinalPosition, Comparator.nullsLast(Comparator.naturalOrder()));
    } else {
      comparator =
          Comparator.comparing(
              Column::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
    }
    if (SORT_ORDER_DESC.equalsIgnoreCase(sortOrder)) {
      comparator = comparator.reversed();
    }
    return comparator;
  }

  private static boolean columnMatchesTagFilter(
      Column column, ColumnTagFilter columnTagFilter, Map<String, List<TagLabel>> tagsByHash) {
    List<TagLabel> tags =
        tagsByHash.get(FullyQualifiedName.buildHash(column.getFullyQualifiedName()));
    Set<String> columnTagFQNs =
        nullOrEmpty(tags)
            ? Set.of()
            : tags.stream().map(TagLabel::getTagFQN).collect(Collectors.toSet());
    return matchesTagGroup(columnTagFQNs, columnTagFilter.tagFQNs())
        && matchesTagGroup(columnTagFQNs, columnTagFilter.glossaryTermFQNs());
  }

  private static boolean matchesTagGroup(Set<String> columnTagFQNs, Set<String> filterGroup) {
    return nullOrEmpty(filterGroup) || filterGroup.stream().anyMatch(columnTagFQNs::contains);
  }

  public static List<Column> flattenColumns(List<Column> columns) {
    List<Column> flattened = new ArrayList<>();
    for (Column column : columns) {
      flattened.add(column);
      if (!nullOrEmpty(column.getChildren())) {
        flattened.addAll(flattenColumns(column.getChildren()));
      }
    }
    return flattened;
  }

  /**
   * Resolve column tags the same way the column list responses (and therefore the UI filter
   * dropdown) see them: direct tag_usage rows enriched with glossary-derived tags. The raw DAO is
   * used instead of the service-layer helper so certification-classification tags are not stripped,
   * keeping the filter consistent with the tags shown on each column.
   */
  public static Map<String, List<TagLabel>> resolveColumnTagsForFilter(
      String entityFqn, CollectionDAO daoCollection) {
    Map<String, List<TagLabel>> directTagsByHash =
        daoCollection.tagUsageDAO().getTagsByPrefix(entityFqn, ".%", true);
    if (nullOrEmpty(directTagsByHash)) {
      return Map.of();
    }
    List<TagLabel> allDirectTags =
        directTagsByHash.values().stream().flatMap(List::stream).collect(Collectors.toList());
    Map<String, List<TagLabel>> derivedTagsMap;
    try {
      derivedTagsMap = batchFetchDerivedTags(allDirectTags);
    } catch (Exception ex) {
      LOG.warn("Failed to fetch derived tags for column tag filter; matching direct tags only", ex);
      derivedTagsMap = Map.of();
    }
    Map<String, List<TagLabel>> effectiveTagsByHash = new HashMap<>();
    for (Map.Entry<String, List<TagLabel>> entry : directTagsByHash.entrySet()) {
      effectiveTagsByHash.put(
          entry.getKey(), addDerivedTagsWithPreFetched(entry.getValue(), derivedTagsMap));
    }
    return effectiveTagsByHash;
  }
}
