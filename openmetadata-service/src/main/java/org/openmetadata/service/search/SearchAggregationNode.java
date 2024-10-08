package org.openmetadata.service.search;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class SearchAggregationNode {
  String type;
  String name;
  Map<String, String> value;
  List<SearchAggregationNode> children = new ArrayList<>();

  public SearchAggregationNode(String type, String name, Map<String, String> value) {
    this.type = type;
    this.name = name;
    this.value = value;
  }

  public SearchAggregationNode() {
    // Default constructor
  }

  public void addChild(SearchAggregationNode child) {
    children.add(child);
  }
}
