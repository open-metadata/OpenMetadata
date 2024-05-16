package org.openmetadata.service.search;

import lombok.Getter;

@Getter
public class SearchSortFilter {
  String sortField;
  String sortType;
  String sortNestedPath;
  String sortNestedMode;

  public SearchSortFilter(
      String sortField, String sortType, String sortNestedPath, String sortNestedMode) {
    this.sortField = sortField == null ? "name.keyword" : sortField;
    this.sortType = sortType == null ? "asc" : sortType;
    this.sortNestedPath = sortNestedPath;
    this.sortNestedMode = sortNestedMode;
  }

  public Boolean isSorted() {
    return sortField != null && sortType != null;
  }

  public Boolean isNested() {
    return sortNestedPath != null && sortNestedMode != null;
  }
}
