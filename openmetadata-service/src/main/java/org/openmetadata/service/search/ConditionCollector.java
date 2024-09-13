package org.openmetadata.service.search;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.service.search.queries.OMQueryBuilder;

public class ConditionCollector {
  private List<OMQueryBuilder> mustConditions = new ArrayList<>();
  private List<OMQueryBuilder> shouldConditions = new ArrayList<>();
  private List<OMQueryBuilder> mustNotConditions = new ArrayList<>();

  public void addMust(OMQueryBuilder query) {
    mustConditions.add(query);
  }

  public void addShould(OMQueryBuilder query) {
    shouldConditions.add(query);
  }

  public void addMustNot(OMQueryBuilder query) {
    mustNotConditions.add(query);
  }

  public List<OMQueryBuilder> getMustConditions() {
    return mustConditions;
  }

  public List<OMQueryBuilder> getShouldConditions() {
    return shouldConditions;
  }

  public List<OMQueryBuilder> getMustNotConditions() {
    return mustNotConditions;
  }
}
