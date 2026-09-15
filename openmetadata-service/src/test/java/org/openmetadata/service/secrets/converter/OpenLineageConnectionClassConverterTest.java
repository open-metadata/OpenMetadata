package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.services.connections.pipeline.OpenLineageConnection;
import org.openmetadata.schema.services.connections.pipeline.openlineage.KafkaBrokerConfig;
import org.openmetadata.schema.services.connections.pipeline.openlineage.KinesisBrokerConfig;
import org.openmetadata.schema.utils.JsonUtils;

class OpenLineageConnectionClassConverterTest {

  private final ClassConverter converter =
      ClassConverterFactory.getConverter(OpenLineageConnection.class);

  @Test
  void testConvertsKafkaBrokerConfig() {
    KafkaBrokerConfig kafkaBrokerConfig =
        new KafkaBrokerConfig().withBrokersUrl("broker:9092").withTopicName("openlineage");

    OpenLineageConnection input = new OpenLineageConnection().withBrokerConfig(kafkaBrokerConfig);
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    OpenLineageConnection result = (OpenLineageConnection) converter.convert(rawInput);

    assertNotNull(result);
    assertInstanceOf(KafkaBrokerConfig.class, result.getBrokerConfig());
  }

  @Test
  void testConvertsKinesisBrokerConfig() {
    KinesisBrokerConfig kinesisBrokerConfig =
        new KinesisBrokerConfig()
            .withStreamName("openlineage-stream")
            .withAwsConfig(new AWSCredentials().withAwsRegion("us-east-1"));

    OpenLineageConnection input = new OpenLineageConnection().withBrokerConfig(kinesisBrokerConfig);
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    OpenLineageConnection result = (OpenLineageConnection) converter.convert(rawInput);

    assertNotNull(result);
    assertInstanceOf(KinesisBrokerConfig.class, result.getBrokerConfig());
  }

  @Test
  void testNullBrokerConfigDoesNotThrow() {
    OpenLineageConnection input = new OpenLineageConnection();
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    OpenLineageConnection result = (OpenLineageConnection) converter.convert(rawInput);

    assertNotNull(result);
    assertNull(result.getBrokerConfig());
  }
}
