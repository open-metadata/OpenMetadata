package org.openmetadata.service.search;

import java.util.List;
import java.util.Map;
import lombok.Getter;

@Getter
public class SearchResultListMapper {
  public List<Map<String, Object>> results;
  public long total;
  public Object[] lastHitSortValues;

  public SearchResultListMapper(List<Map<String, Object>> results, long total) {
    this.results = results;
    this.total = total;
  }

  public SearchResultListMapper(
      List<Map<String, Object>> results, long total, Object[] lastHitSortValues) {
    this.results = results;
    this.total = total;
    this.lastHitSortValues = lastHitSortValues;
  }
}
