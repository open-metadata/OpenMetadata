package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.ServiceConnections;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtS3Config;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.services.connections.messaging.NatsConnection;
import org.openmetadata.schema.services.connections.messaging.nats.NatsTokenAuth;
import org.openmetadata.schema.utils.JsonUtils;

class SchemaClassConverterTest {
  @ParameterizedTest
  @ValueSource(
      strings = {
        "{\"username\":\"u\",\"pasword\":\"never-echo\"}",
        "{\"username\":\"u\",\"password\":null,\"obsolete\":true}",
        "{\"username\":\"u\",\"password\":\"never-echo\",\"obsolete\":true}"
      })
  void malformedSecretWritesFailWithoutEchoingValues(String json) {
    SchemaConversionException failure =
        assertThrows(
            SchemaConversionException.class,
            () ->
                ClassConverterFactory.convertProperty(
                    NatsConnection.class, "authType", JsonUtils.readValue(json, Map.class)));
    assertFalse(failure.getMessage().contains("never-echo"));
    assertTrue(failure.getMessage().contains("authType"));
  }

  @Test
  void readingAServiceConnectionSelectsTheWrapperWhoseConfigMatches() {
    Object input =
        Map.of(
            "serviceConnection",
            Map.of(
                "config",
                Map.of(
                    "type",
                    "Mysql",
                    "username",
                    "user",
                    "hostPort",
                    "localhost:3306",
                    "authType",
                    Map.of("password", "secret"))));
    ServiceConnections read =
        assertInstanceOf(
            ServiceConnections.class,
            ClassConverterFactory.getConverter(ServiceConnections.class).convertForRead(input));
    DatabaseConnection wrapper =
        assertInstanceOf(DatabaseConnection.class, read.getServiceConnection());
    assertInstanceOf(MysqlConnection.class, wrapper.getConfig());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void optionalSslTypoIsRejected(boolean jsonTree) {
    Map<String, Object> raw = Map.of("sslkey", "never-echo");
    SchemaConversionException failure =
        assertThrows(
            SchemaConversionException.class,
            () ->
                ClassConverterFactory.convertProperty(
                    NatsConnection.class,
                    "tlsConfig",
                    jsonTree ? JsonUtils.valueToTree(raw) : raw));
    assertTrue(failure.getMessage().contains("sslkey"));
    assertFalse(failure.getMessage().contains("never-echo"));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void rootReadFailureKeepsUnknownFieldsAndEveryAuthBranch(boolean jsonTree) {
    Map<String, Object> raw =
        Map.of(
            "type",
            "Nats",
            "oldField",
            List.of("preserve"),
            "authType",
            Map.of("password", Map.of("nested", "secret"), "token", "other-secret"));
    SchemaBackedMap read =
        assertInstanceOf(
            SchemaBackedMap.class,
            ClassConverterFactory.getConverter(NatsConnection.class)
                .convertForRead(jsonTree ? JsonUtils.valueToTree(raw) : raw));
    assertEquals(raw, read);
    List<List<String>> paths = new ArrayList<>();
    read.visitSecrets(
        slot -> {
          paths.add(slot.path());
          slot.setValue("masked");
        });
    assertTrue(paths.contains(List.of("AuthType", "Password")), paths.toString());
    assertTrue(paths.contains(List.of("AuthType", "Token")), paths.toString());
    assertEquals(Map.of("password", "masked", "token", "masked"), read.get("authType"));
    assertEquals(List.of("preserve"), read.get("oldField"));
    assertFalse(JsonUtils.pojoToJson(read).contains("ownerPathLengths"));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void typedApplicationKeepsItsTypeAndProtectsAnInvalidNestedMap(boolean jsonTree) {
    Map<String, Object> raw =
        Map.of("waiiInstance", "https://waii.example", "token", "secret", "obsolete", true);
    ApplicationPipeline input =
        new ApplicationPipeline().withAppPrivateConfig(jsonTree ? JsonUtils.valueToTree(raw) : raw);
    ApplicationPipeline read =
        assertInstanceOf(
            ApplicationPipeline.class,
            ClassConverterFactory.getConverter(ApplicationPipeline.class).convertForRead(input));
    SchemaBackedMap privateConfig =
        assertInstanceOf(SchemaBackedMap.class, read.getAppPrivateConfig());
    privateConfig.visitSecrets(slot -> slot.setValue("masked"));
    assertEquals("masked", privateConfig.get("token"));
    assertEquals(true, privateConfig.get("obsolete"));
    assertThrows(
        SchemaConversionException.class,
        () -> ClassConverterFactory.getConverter(ApplicationPipeline.class).convert(input));
  }

  @Test
  void requiredSecretCannotBeAJsonNullInsideAMap() {
    SchemaConversionException failure =
        assertThrows(
            SchemaConversionException.class,
            () ->
                ClassConverterFactory.convertProperty(
                    NatsConnection.class,
                    "authType",
                    Map.of("username", "u", "password", JsonUtils.readTree("null"))));
    assertTrue(failure.getMessage().contains("authType.password"));
    assertTrue(failure.getMessage().contains("is required"));
  }

  @Test
  void jsonTreesAreTypedAtRootAndUnionPropertyBoundaries() {
    NatsConnection connection =
        assertInstanceOf(
            NatsConnection.class,
            ClassConverterFactory.getConverter(NatsConnection.class)
                .convert(
                    JsonUtils.readTree(
                        """
                        {"natsServers":"nats://localhost:4222","authType":{"token":"secret"}}
                        """)));
    assertEquals(
        "secret", assertInstanceOf(NatsTokenAuth.class, connection.getAuthType()).getToken());
    assertEquals(
        "secret",
        assertInstanceOf(
                NatsTokenAuth.class,
                ClassConverterFactory.convertProperty(
                    NatsConnection.class, "authType", JsonUtils.readTree("{\"token\":\"secret\"}")))
            .getToken());
    assertEquals(
        Map.of(),
        ClassConverterFactory.convertProperty(
            SourceConfig.class, "config", JsonUtils.readTree("{}")));
  }

  @Test
  void nestedJsonTreeScalarsAndArraysUseTheirJavaValueTypes() {
    NatsConnection connection =
        assertInstanceOf(
            NatsConnection.class,
            ClassConverterFactory.getConverter(NatsConnection.class)
                .convert(
                    Map.of(
                        "natsServers", JsonUtils.readTree("\"nats://localhost:4222\""),
                        "authType", Map.of("token", JsonUtils.readTree("\"secret\"")),
                        "topicFilterPattern",
                            Map.of("includes", JsonUtils.readTree("[\"orders.*\"]")))));
    assertEquals("nats://localhost:4222", connection.getNatsServers());
    assertEquals(
        "secret", assertInstanceOf(NatsTokenAuth.class, connection.getAuthType()).getToken());
    assertEquals(List.of("orders.*"), connection.getTopicFilterPattern().getIncludes());
  }

  @Test
  void malformedMapsContainingJsonTreesStillMaskEveryAuthBranch() {
    Map<String, Object> raw =
        Map.of(
            "oldField",
            "preserve",
            "authType",
            JsonUtils.readTree("{\"password\":\"secret\",\"token\":\"other-secret\"}"));
    SchemaBackedMap read =
        assertInstanceOf(
            SchemaBackedMap.class,
            ClassConverterFactory.getConverter(NatsConnection.class).convertForRead(raw));
    read.visitSecrets(slot -> slot.setValue("masked"));
    assertEquals(Map.of("password", "masked", "token", "masked"), read.get("authType"));
    assertEquals("preserve", read.get("oldField"));
    assertEquals("secret", JsonUtils.valueToTree(raw).at("/authType/password").asText());
  }

  @Test
  void rawMapPathsMatchDeclaredGettersAndFlattenedDynamicEntries() {
    Map<String, Object> raw =
        Map.of(
            "obsolete",
            true,
            "consumerConfig",
            Map.of(
                "sasl.password",
                "declared",
                "custom.key",
                "dynamic",
                "number",
                4,
                "nested",
                Map.of("leave", "alone")));
    SchemaBackedMap read =
        assertInstanceOf(
            SchemaBackedMap.class,
            ClassConverterFactory.getConverter(KafkaConnection.class).convertForRead(raw));
    List<SchemaBackedMap.SecretSlot> slots = new ArrayList<>();
    read.visitSecrets(slots::add);
    SchemaBackedMap.SecretSlot declared =
        slots.stream().filter(slot -> !slot.mapEntry()).findFirst().orElseThrow();
    assertEquals(List.of("ConsumerConfig", "SaslPassword"), declared.path());
    assertEquals(List.of("consumerConfig", "sasl.password"), declared.jsonPath());
    assertEquals(List.of(1), declared.ownerPathLengths());
    SchemaBackedMap.SecretSlot dynamic =
        slots.stream().filter(SchemaBackedMap.SecretSlot::mapEntry).findFirst().orElseThrow();
    assertEquals(List.of("ConsumerConfig", "AdditionalProperties", "custom.key"), dynamic.path());
    assertEquals(List.of("consumerConfig", "custom.key"), dynamic.jsonPath());
    assertEquals(List.of(1, 2), dynamic.ownerPathLengths());
    assertEquals(2, slots.size());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void absentDefaultedDiscriminatorIsAllowedButExplicitNullIsNot(boolean jsonTree) {
    Map<String, Object> source = new HashMap<>();
    source.put(
        "dbtSecurityConfig", Map.of("awsRegion", "us-east-1", "awsSecretAccessKey", "secret"));
    DbtPipeline pipeline =
        assertInstanceOf(
            DbtPipeline.class,
            ClassConverterFactory.convertProperty(
                SourceConfig.class, "config", Map.of("dbtConfigSource", source)));
    DbtS3Config config = assertInstanceOf(DbtS3Config.class, pipeline.getDbtConfigSource());
    assertEquals("s3", config.getDbtConfigType().toString());
    assertEquals("secret", config.getDbtSecurityConfig().getAwsSecretAccessKey());
    source.put("dbtConfigType", jsonTree ? JsonUtils.readTree("null") : null);
    assertThrows(
        SchemaConversionException.class,
        () ->
            ClassConverterFactory.convertProperty(
                SourceConfig.class, "config", Map.of("dbtConfigSource", source)));
    assertThrows(
        SchemaConversionException.class,
        () ->
            ClassConverterFactory.convertProperty(
                NatsConnection.class, "authType", Map.of("username", "u")));
  }
}
