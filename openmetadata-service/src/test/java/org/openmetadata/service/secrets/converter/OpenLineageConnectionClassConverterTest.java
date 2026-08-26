package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.sasl.SASLClientConfig;
import org.openmetadata.schema.services.connections.messaging.SaslMechanismType;
import org.openmetadata.schema.services.connections.pipeline.OpenLineageConnection;
import org.openmetadata.schema.services.connections.pipeline.openlineage.KafkaBrokerConfig;
import org.openmetadata.schema.utils.JsonUtils;

class OpenLineageConnectionClassConverterTest {

  @Test
  void testConvertsKafkaBrokerConfigWithSaslPassword() {
    KafkaBrokerConfig brokerConfig =
        new KafkaBrokerConfig()
            .withBrokersUrl("broker:9092")
            .withTopicName("openlineage")
            .withSaslConfig(
                new SASLClientConfig()
                    .withSaslMechanism(SaslMechanismType.PLAIN)
                    .withSaslUsername("user")
                    .withSaslPassword("secret"));
    OpenLineageConnection input = new OpenLineageConnection().withBrokerConfig(brokerConfig);
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    OpenLineageConnection result =
        (OpenLineageConnection)
            ClassConverterFactory.getConverter(OpenLineageConnection.class).convert(rawInput);

    assertNotNull(result);
    assertInstanceOf(KafkaBrokerConfig.class, result.getBrokerConfig());
    assertNotNull(((KafkaBrokerConfig) result.getBrokerConfig()).getSaslConfig());
  }
}
