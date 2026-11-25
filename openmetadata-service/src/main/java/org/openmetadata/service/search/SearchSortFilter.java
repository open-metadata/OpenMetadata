package org.openmetadata.service.search;

import lombok.Getter;

@Getter
public class SearchSortFilter {
  String sortField;
  String sortType;
  String sortNestedPath;
  String sortNestedMode;

  /** Breaks ties on the sort field, in the same order; null when nothing does. */
  String thenSortField;

  public SearchSortFilter(
      String sortField, String sortType, String sortNestedPath, String sortNestedMode) {
    this.sortField = sortField == null ? "name.keyword" : sortField;
    this.sortType = sortType == null ? "asc" : sortType;
    this.sortNestedPath = sortNestedPath;
    this.sortNestedMode = sortNestedMode;
  }

  public SearchSortFilter thenBy(String field) {
    this.thenSortField = field;
    return this;
  }

  public Boolean isSorted() {
    return sortField != null && sortType != null;
  }

  public Boolean isNested() {
    return sortNestedPath != null && sortNestedMode != null;
  }
}
