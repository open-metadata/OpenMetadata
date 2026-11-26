package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assumptions.assumeTrue;

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
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchLineChartAggregator;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.core.SearchRequest;

@Execution(ExecutionMode.CONCURRENT)
class OpenSearchCategoricalAxisRealEngineIT extends CategoricalAxisSelectionBase {

  @BeforeAll
  static void onlyOnOpenSearch() {
    assumeTrue(
        "opensearch".equalsIgnoreCase(System.getProperty("searchType", "elasticsearch")),
        "needs the opensearch client");
  }

  private final OpenSearchLineChartAggregator aggregator = new OpenSearchLineChartAggregator();

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
