package org.openmetadata.service.search.dataInsight;

import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.HashMap;
import org.junit.jupiter.api.BeforeEach;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.service.search.opensearch.dataInsightAggregator.OpenSearchLineChartAggregator;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.core.SearchRequest;

@Testcontainers(disabledWithoutDocker = true)
class OpenSearchCategoricalAxisRealEngineTest extends CategoricalAxisSelectionTestBase {

  @Container
  static final GenericContainer<?> ENGINE =
      new GenericContainer<>("opensearchproject/opensearch:3.4.0")
          .withEnv("discovery.type", "single-node")
          .withEnv("DISABLE_SECURITY_PLUGIN", "true")
          .withEnv("OPENSEARCH_JAVA_OPTS", "-Xms512m -Xmx512m")
          .withExposedPorts(9200)
          .waitingFor(Wait.forHttp("/_cluster/health").forStatusCode(200));

  private final OpenSearchLineChartAggregator aggregator = new OpenSearchLineChartAggregator();

  @BeforeEach
  void seedFixture() throws Exception {
    seed();
  }

  @Override
  protected String engineUrl() {
    return "http://" + ENGINE.getHost() + ":" + ENGINE.getMappedPort(9200);
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
