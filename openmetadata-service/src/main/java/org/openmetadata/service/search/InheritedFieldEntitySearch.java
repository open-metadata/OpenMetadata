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

import java.util.List;
import java.util.function.Supplier;
import org.openmetadata.schema.type.EntityReference;

public interface InheritedFieldEntitySearch {

  InheritedFieldResult getEntitiesForField(
      InheritedFieldQuery query, Supplier<InheritedFieldResult> fallback);

  Integer getCountForField(InheritedFieldQuery query, Supplier<Integer> fallback);

  enum QueryFilterType {
    DOMAIN_ASSETS,
    OWNER_ASSETS,
    TAG_ASSETS,
    GENERIC
  }

  class InheritedFieldQuery {
    private final String fieldPath;
    private final String fieldValue;
    private final boolean supportsHierarchy;
    private final String entityTypeFilter;
    private final int from;
    private final int size;
    private final boolean includeDeleted;
    private final QueryFilterType filterType;

    private InheritedFieldQuery(Builder builder) {
      this.fieldPath = builder.fieldPath;
      this.fieldValue = builder.fieldValue;
      this.supportsHierarchy = builder.supportsHierarchy;
      this.entityTypeFilter = builder.entityTypeFilter;
      this.from = builder.from;
      this.size = builder.size;
      this.includeDeleted = builder.includeDeleted;
      this.filterType = builder.filterType;
    }

    public String getFieldPath() {
      return fieldPath;
    }

    public String getFieldValue() {
      return fieldValue;
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

    public static Builder builder() {
      return new Builder();
    }

    public static class Builder {
      private String fieldPath;
      private String fieldValue;
      private boolean supportsHierarchy = false;
      private String entityTypeFilter;
      private int from = 0;
      private int size = 100;
      private boolean includeDeleted = false;
      private QueryFilterType filterType = QueryFilterType.GENERIC;

      public Builder fieldPath(String fieldPath) {
        this.fieldPath = fieldPath;
        return this;
      }

      public Builder fieldValue(String fieldValue) {
        this.fieldValue = fieldValue;
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

      public InheritedFieldQuery build() {
        if (fieldPath == null || fieldValue == null) {
          throw new IllegalArgumentException("fieldPath and fieldValue are required");
        }
        return new InheritedFieldQuery(this);
      }
    }

    public static InheritedFieldQuery forDomain(String domainFqn) {
      return builder()
          .fieldPath("domains.fullyQualifiedName")
          .fieldValue(domainFqn)
          .supportsHierarchy(true)
          .filterType(QueryFilterType.DOMAIN_ASSETS)
          .includeDeleted(true)
          .build();
    }

    public static InheritedFieldQuery forOwner(String ownerId) {
      return builder()
          .fieldPath("owners.id")
          .fieldValue(ownerId)
          .supportsHierarchy(false)
          .filterType(QueryFilterType.OWNER_ASSETS)
          .build();
    }

    public static InheritedFieldQuery forTag(String tagFqn) {
      return builder()
          .fieldPath("tags.tagFQN")
          .fieldValue(tagFqn)
          .supportsHierarchy(false)
          .filterType(QueryFilterType.TAG_ASSETS)
          .build();
    }
  }

  class InheritedFieldResult {
    private final List<EntityReference> entities;
    private final Integer total;

    public InheritedFieldResult(List<EntityReference> entities, Integer total) {
      this.entities = entities;
      this.total = total;
    }

    public List<EntityReference> getEntities() {
      return entities;
    }

    public Integer getTotal() {
      return total;
    }
  }
}
