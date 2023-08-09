package org.openmetadata.service.search;

import org.elasticsearch.search.builder.SearchSourceBuilder;

public class HelperClass {

  public SearchSourceBuilder buildSourceBuilder(String query, int from, int size){
    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    return searchSourceBuilder;
  }

}
