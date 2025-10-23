package org.openmetadata.service.search.elasticsearch.aggregations;

import es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.json.JsonpMapper;
import jakarta.json.spi.JsonProvider;
import jakarta.json.stream.JsonParser;
import java.io.StringReader;
import java.util.HashMap;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.service.search.SearchAggregationNode;

@Setter
@Getter
public class ElasticFilterAggregations implements ElasticAggregations {
  private String aggregationName;
  private Aggregation aggregation;
  private Map<String, Aggregation> subAggregations = new HashMap<>();
  private JsonpMapper mapper;

  public ElasticFilterAggregations() {}

  public ElasticFilterAggregations(JsonpMapper mapper) {
    this.mapper = mapper;
  }

  @Override
  public void createAggregation(SearchAggregationNode node) {
    Map<String, String> params = node.getValue();
    String queryJson = params.get("query");
    this.aggregationName = node.getName();

    try {
      if (mapper == null) {
        throw new IllegalStateException("JsonpMapper is required for filter aggregations");
      }

      JsonProvider provider = mapper.jsonProvider();
      JsonParser parser = provider.createParser(new StringReader(queryJson));
      Query filterQuery = Query._DESERIALIZER.deserialize(parser, mapper);

      this.aggregation = Aggregation.of(a -> a.filter(filterQuery));
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid filter query JSON: " + queryJson, e);
    }
  }

  @Override
  public void setSubAggregations(Map<String, Aggregation> subAggregations) {
    this.subAggregations = subAggregations;
  }
}
