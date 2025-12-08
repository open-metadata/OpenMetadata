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

import static org.openmetadata.service.search.SearchConstants.DEFAULT_SORT_FIELD;
import static org.openmetadata.service.search.SearchConstants.DEFAULT_SORT_ORDER;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.openmetadata.schema.type.EntityReference;

public interface InheritedFieldEntitySearch {

  InheritedFieldResult getEntitiesForField(
      InheritedFieldQuery query, Supplier<InheritedFieldResult> fallback);

  Integer getCountForField(InheritedFieldQuery query, Supplier<Integer> fallback);

  Map<String, Integer> getAggregatedCountsByField(String fieldPath, String queryFilter);

  enum QueryFilterType {
    DOMAIN_ASSETS,
    OWNER_ASSETS,
    TAG_ASSETS,
    USER_ASSETS,
    GENERIC
  }

  class InheritedFieldQuery {
    private final String fieldPath;
    private final String fieldValue;
    private final List<String> fieldValues;
    private final boolean supportsHierarchy;
    private final String entityTypeFilter;
    private final int from;
    private final int size;
    private final boolean includeDeleted;
    private final QueryFilterType filterType;
    private final String sortField;
    private final String sortOrder;

    private InheritedFieldQuery(Builder builder) {
      this.fieldPath = builder.fieldPath;
      this.fieldValue = builder.fieldValue;
      this.fieldValues = builder.fieldValues;
      this.supportsHierarchy = builder.supportsHierarchy;
      this.entityTypeFilter = builder.entityTypeFilter;
      this.from = builder.from;
      this.size = builder.size;
      this.includeDeleted = builder.includeDeleted;
      this.filterType = builder.filterType;
      this.sortField = builder.sortField;
      this.sortOrder = builder.sortOrder;
    }

    public String getFieldPath() {
      return fieldPath;
    }

    public String getFieldValue() {
      return fieldValue;
    }

    public List<String> getFieldValues() {
      return fieldValues;
    }

    public boolean isSupportsHierarchy() {
      return supportsHierarchy;
    }

    public String getEntityTypeFilter() {
      return entityTypeFilter;
    }

    public int getFrom() {
      return from;
    }

    public int getSize() {
      return size;
    }

    public boolean isIncludeDeleted() {
      return includeDeleted;
    }

    public QueryFilterType getFilterType() {
      return filterType;
    }

    public String getSortField() {
      return sortField;
    }

    public String getSortOrder() {
      return sortOrder;
    }

    public static Builder builder() {
      return new Builder();
    }

    public static class Builder {
      private String fieldPath;
      private String fieldValue;
      private List<String> fieldValues;
      private boolean supportsHierarchy = false;
      private String entityTypeFilter;
      private int from = 0;
      private int size = 100;
      private boolean includeDeleted = false;
      private QueryFilterType filterType = QueryFilterType.GENERIC;
      private String sortField = DEFAULT_SORT_FIELD;
      private String sortOrder = DEFAULT_SORT_ORDER;

      public Builder fieldPath(String fieldPath) {
        this.fieldPath = fieldPath;
        return this;
      }

      public Builder fieldValue(String fieldValue) {
        this.fieldValue = fieldValue;
        return this;
      }

      public Builder fieldValues(List<String> fieldValues) {
        this.fieldValues = fieldValues;
        return this;
      }

      public Builder supportsHierarchy(boolean supportsHierarchy) {
        this.supportsHierarchy = supportsHierarchy;
        return this;
      }

      public Builder entityTypeFilter(String entityTypeFilter) {
        this.entityTypeFilter = entityTypeFilter;
        return this;
      }

      public Builder from(int from) {
        this.from = from;
        return this;
      }

      public Builder size(int size) {
        this.size = size;
        return this;
      }

      public Builder includeDeleted(boolean includeDeleted) {
        this.includeDeleted = includeDeleted;
        return this;
      }

      public Builder filterType(QueryFilterType filterType) {
        this.filterType = filterType;
        return this;
      }

      public Builder sortField(String sortField) {
        this.sortField = sortField;
        return this;
      }

      public Builder sortOrder(String sortOrder) {
        this.sortOrder = sortOrder;
        return this;
      }

      public InheritedFieldQuery build() {
        if (fieldPath == null) {
          throw new IllegalArgumentException("fieldPath is required");
        }
        if (fieldValue == null && (fieldValues == null || fieldValues.isEmpty())) {
          throw new IllegalArgumentException("Either fieldValue or fieldValues is required");
        }
        return new InheritedFieldQuery(this);
      }
    }

    public static InheritedFieldQuery forDomain(String domainFqn, int offset, int limit) {
      return builder()
          .fieldPath("domains.fullyQualifiedName")
          .fieldValue(domainFqn)
          .supportsHierarchy(true)
          .filterType(QueryFilterType.DOMAIN_ASSETS)
          .includeDeleted(true)
          .from(offset)
          .size(limit)
          .build();
    }

    public static InheritedFieldQuery forTag(String tagFqn, int offset, int limit) {
      return builder()
          .fieldPath("tags.tagFQN")
          .fieldValue(tagFqn)
          .supportsHierarchy(false)
          .filterType(QueryFilterType.TAG_ASSETS)
          .includeDeleted(true)
          .from(offset)
          .size(limit)
          .build();
    }

    public static InheritedFieldQuery forDataProduct(String dataProductFqn, int offset, int limit) {
      return builder()
          .fieldPath("dataProducts.fullyQualifiedName")
          .fieldValue(dataProductFqn)
          .supportsHierarchy(false)
          .filterType(QueryFilterType.GENERIC)
          .includeDeleted(false)
          .from(offset)
          .size(limit)
          .build();
    }

    public static InheritedFieldQuery forGlossaryTerm(
        String glossaryTermFqn, int offset, int limit) {
      return builder()
          .fieldPath("tags.tagFQN")
          .fieldValue(glossaryTermFqn)
          .supportsHierarchy(false)
          .filterType(QueryFilterType.TAG_ASSETS)
          .includeDeleted(true)
          .from(offset)
          .size(limit)
          .build();
    }

    public static InheritedFieldQuery forTeam(String teamId, int offset, int limit) {
      return builder()
          .fieldPath("owners.id")
          .fieldValue(teamId)
          .supportsHierarchy(false)
          .filterType(QueryFilterType.OWNER_ASSETS)
          .includeDeleted(true)
          .from(offset)
          .size(limit)
          .build();
    }

    public static InheritedFieldQuery forUser(
        String userId, List<String> teamIds, int offset, int limit) {
      List<String> ownerIds = new ArrayList<>();
      ownerIds.add(userId);
      if (teamIds != null) {
        ownerIds.addAll(teamIds);
      }
      return builder()
          .fieldPath("owners.id")
          .fieldValues(ownerIds)
          .supportsHierarchy(false)
          .filterType(QueryFilterType.USER_ASSETS)
          .includeDeleted(true)
          .from(offset)
          .size(limit)
          .build();
    }
  }

  record InheritedFieldResult(List<EntityReference> entities, Integer total) {}
}
