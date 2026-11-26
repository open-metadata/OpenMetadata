package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assumptions.assumeTrue;

import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.HashMap;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchLineChartAggregator;

@Execution(ExecutionMode.CONCURRENT)
class ElasticSearchCategoricalAxisRealEngineIT extends CategoricalAxisSelectionBase {

  @BeforeAll
  static void onlyOnElasticsearch() {
    assumeTrue(
        "elasticsearch".equalsIgnoreCase(System.getProperty("searchType", "elasticsearch")),
        "needs the elasticsearch client");
  }

  private final ElasticSearchLineChartAggregator aggregator =
      new ElasticSearchLineChartAggregator();

  @BeforeEach
  void seedFixture() throws Exception {
    seed();
  }

  @Override
  protected String engineUrl() {
    return "http://"
        + TestSuiteBootstrap.getSearchHost()
        + ":"
        + TestSuiteBootstrap.getSearchPort();
  }

  @Override
  protected String requestFor(LineChart lineChart) {
    SearchRequest request =
        aggregator.prepareSearchRequest(
            new DataInsightCustomChart()
                .withName("categorical_axis_chart")
                .withChartDetails(lineChart),
            0L,
            System.currentTimeMillis(),
            new ArrayList<>(),
            new HashMap<>(),
            true);
    StringWriter out = new StringWriter();
    JacksonJsonpMapper mapper = new JacksonJsonpMapper(MAPPER);
    JsonGenerator generator = mapper.jsonProvider().createGenerator(out);
    request.serialize(generator, mapper);
    generator.close();
    return out.toString();
  }
}
