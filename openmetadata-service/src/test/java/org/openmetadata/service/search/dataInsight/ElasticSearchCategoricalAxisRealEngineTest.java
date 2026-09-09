package org.openmetadata.service.search.dataInsight;

import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.Function;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchLineChartAggregator;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
class ElasticSearchCategoricalAxisRealEngineTest extends CategoricalAxisSelectionTestBase {

  @Container
  static final GenericContainer<?> ENGINE =
      new GenericContainer<>("docker.elastic.co/elasticsearch/elasticsearch:9.3.0")
          .withEnv("discovery.type", "single-node")
          .withEnv("xpack.security.enabled", "false")
          .withEnv("ES_JAVA_OPTS", "-Xms512m -Xmx512m")
          .withExposedPorts(9200)
          .waitingFor(Wait.forHttp("/_cluster/health").forStatusCode(200));

  private final ElasticSearchLineChartAggregator aggregator =
      new ElasticSearchLineChartAggregator();

  @BeforeEach
  void seedFixture() throws Exception {
    seed();
  }

  @Override
  protected String engineUrl() {
    return "http://" + ENGINE.getHost() + ":" + ENGINE.getMappedPort(9200);
  }

  @Override
  protected String rankedRequest() {
    LineChart lineChart =
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withName("tables")
                        .withFunction(Function.COUNT)
                        .withField("id.keyword")
                        .withFilter(TABLE_FILTER)))
            .withxAxisField(X_AXIS_FIELD);
    SearchRequest request =
        aggregator.prepareSearchRequest(
            new DataInsightCustomChart().withName("tables_per_service").withChartDetails(lineChart),
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
