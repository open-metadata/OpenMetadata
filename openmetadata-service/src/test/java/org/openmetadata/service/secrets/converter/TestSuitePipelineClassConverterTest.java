package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;

class TestSuitePipelineClassConverterTest {

  private static final String SECRET = "test-suite-secret";

  @Test
  void connectionIsTypedByItsConfigTypeAndMasked() {
    IngestionPipeline pipeline =
        testSuitePipeline(
            Map.of(
                "type", "Mysql",
                "hostPort", "mysql:3306",
                "username", "om",
                "authType", Map.of("password", SECRET)));

    EntityMaskerFactory.createEntityMasker().maskIngestionPipeline(pipeline);

    assertInstanceOf(MysqlConnection.class, connectionOf(pipeline).getConfig());
    assertFalse(JsonUtils.pojoToJson(pipeline).contains(SECRET));
  }

  /** {@code type} is optional in every connection schema, so a stored config may lack it. */
  @Test
  void connectionWithoutAResolvableTypeIsLeftAsItIsInsteadOfFailingTheRead() {
    for (Map<String, Object> config :
        List.<Map<String, Object>>of(
            Map.of("hostPort", "mysql:3306", "authType", Map.of("password", SECRET)),
            Map.of("type", "NotAConnector", "password", SECRET))) {
      IngestionPipeline pipeline = testSuitePipeline(config);

      assertDoesNotThrow(
          () -> EntityMaskerFactory.createEntityMasker().maskIngestionPipeline(pipeline));
      assertEquals(config, JsonUtils.convertValue(connectionOf(pipeline).getConfig(), Map.class));
    }
  }

  private static DatabaseConnection connectionOf(IngestionPipeline pipeline) {
    return (DatabaseConnection)
        ((TestSuitePipeline) pipeline.getSourceConfig().getConfig())
            .getServiceConnections()
            .getFirst()
            .getServiceConnection();
  }

  private static IngestionPipeline testSuitePipeline(Map<String, Object> connectionConfig) {
    return new IngestionPipeline()
        .withName("test-suite")
        .withPipelineType(PipelineType.TEST_SUITE)
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    Map.of(
                        "type",
                        "TestSuite",
                        "serviceConnections",
                        List.of(
                            Map.of(
                                "serviceName",
                                "mysql",
                                "serviceConnection",
                                Map.of("config", connectionConfig))))));
  }
}
