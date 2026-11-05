package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.services.connections.messaging.nats.BasicAuth;
import org.openmetadata.schema.services.connections.messaging.nats.NkeyAuth;
import org.openmetadata.schema.services.connections.messaging.nats.TokenAuth;
import org.openmetadata.schema.services.connections.pipeline.OpenLineageConnection;
import org.openmetadata.schema.services.connections.pipeline.openlineage.KafkaBrokerConfig;
import org.openmetadata.schema.services.connections.pipeline.openlineage.KinesisBrokerConfig;
import org.openmetadata.schema.services.connections.pipeline.openlineage.NatsBrokerConfig;
import org.openmetadata.schema.services.connections.pipeline.openlineage.nats.CredentialsAuth;
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
  void testConvertsNatsBrokerConfig() {
    NatsBrokerConfig natsBrokerConfig =
        new NatsBrokerConfig()
            .withNatsServers("nats://localhost:4222")
            .withStreamName("OPENLINEAGE")
            // jsonschema2pojo generates the oneOf as Object, so it arrives as a LinkedHashMap
            .withAuthType(Map.of("token", "s3cret"));

    OpenLineageConnection input = new OpenLineageConnection().withBrokerConfig(natsBrokerConfig);
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    OpenLineageConnection result = (OpenLineageConnection) converter.convert(rawInput);

    assertNotNull(result);
    assertInstanceOf(NatsBrokerConfig.class, result.getBrokerConfig());
    // a LinkedHashMap here would mean the secrets manager never sees the token
    assertInstanceOf(TokenAuth.class, ((NatsBrokerConfig) result.getBrokerConfig()).getAuthType());
  }

  @Test
  void testConvertsEachNatsAuthVariantToItsOwnClass() {
    assertInstanceOf(
        BasicAuth.class, convertedNatsAuth(Map.of("username", "ol", "password", "s3cret")));
    assertInstanceOf(NkeyAuth.class, convertedNatsAuth(Map.of("nkeySeed", "SUACSSL")));
    assertInstanceOf(
        CredentialsAuth.class, convertedNatsAuth(Map.of("credentials", "-----BEGIN NATS-----")));
  }

  @Test
  void testConvertsNatsTlsConfig() {
    NatsBrokerConfig natsBrokerConfig =
        new NatsBrokerConfig()
            .withNatsServers("nats://localhost:4222")
            .withStreamName("OPENLINEAGE")
            .withTlsConfig(Map.of("sslKey", "-----BEGIN PRIVATE KEY-----"));

    OpenLineageConnection input = new OpenLineageConnection().withBrokerConfig(natsBrokerConfig);
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    OpenLineageConnection result = (OpenLineageConnection) converter.convert(rawInput);

    assertInstanceOf(
        ValidateSSLClientConfig.class,
        ((NatsBrokerConfig) result.getBrokerConfig()).getTlsConfig());
  }

  private Object convertedNatsAuth(Map<String, String> authType) {
    NatsBrokerConfig natsBrokerConfig =
        new NatsBrokerConfig()
            .withNatsServers("nats://localhost:4222")
            .withStreamName("OPENLINEAGE")
            .withAuthType(authType);

    OpenLineageConnection input = new OpenLineageConnection().withBrokerConfig(natsBrokerConfig);
    Object rawInput = JsonUtils.readValue(JsonUtils.pojoToJson(input), Object.class);

    OpenLineageConnection result = (OpenLineageConnection) converter.convert(rawInput);

    return ((NatsBrokerConfig) result.getBrokerConfig()).getAuthType();
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
