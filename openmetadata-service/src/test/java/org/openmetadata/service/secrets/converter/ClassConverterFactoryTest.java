package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.messaging.NatsConnection;
import org.openmetadata.schema.services.connections.messaging.nats.NatsBasicAuth;

class ClassConverterFactoryTest {
  @Test
  void convertersAreReusedWithoutMutatingTheKnownTypes() {
    int size = ClassConverterFactory.getConverterMap().size();
    assertSame(
        ClassConverterFactory.getConverter(NatsConnection.class),
        ClassConverterFactory.getConverter(NatsConnection.class));
    assertSame(
        ClassConverterFactory.getConverter(String.class),
        ClassConverterFactory.getConverter(String.class));
    assertEquals(size, ClassConverterFactory.getConverterMap().size());
    assertThrows(
        UnsupportedOperationException.class, () -> ClassConverterFactory.getConverterMap().clear());
  }

  @Test
  void nonUnionPropertiesAndNullAreSupported() {
    assertEquals(
        "user", ClassConverterFactory.convertProperty(MysqlConnection.class, "username", "user"));
    assertNull(ClassConverterFactory.getConverter(NatsConnection.class).convert(null));
  }

  @Test
  void writesRejectUndeclaredFieldsAndReadsKeepTheEntireObject() {
    Map<String, Object> stored = Map.of("password", "secret", "token", "second", "obsolete", true);
    assertThrows(
        SchemaConversionException.class,
        () -> ClassConverterFactory.convertProperty(NatsConnection.class, "authType", stored));
    SchemaBackedMap read =
        assertInstanceOf(
            SchemaBackedMap.class,
            ClassConverterFactory.convertPropertyForRead(NatsConnection.class, "authType", stored));
    assertEquals(stored, read);
    read.visitSecrets(slot -> slot.setValue("masked"));
    assertEquals(Map.of("password", "masked", "token", "masked", "obsolete", true), read);
    assertEquals("secret", stored.get("password"));
  }

  @Test
  void aValidUnionIsTyped() {
    Object value =
        ClassConverterFactory.convertProperty(
            NatsConnection.class, "authType", Map.of("username", "user", "password", "secret"));
    assertEquals("secret", assertInstanceOf(NatsBasicAuth.class, value).getPassword());
  }

  @Test
  void openApplicationMapsStayDynamic() {
    Map<String, Object> privateConfig = Map.of("token", "dynamic-value");
    Object converted =
        ClassConverterFactory.convertProperty(
            SourceConfig.class,
            "config",
            Map.of(
                "type",
                "Application",
                "appConfig",
                Map.of("type", "AgentTypeTestApp"),
                "appPrivateConfig",
                privateConfig));
    ApplicationPipeline pipeline = assertInstanceOf(ApplicationPipeline.class, converted);
    assertEquals(privateConfig, pipeline.getAppPrivateConfig());
    assertEquals(Map.of("type", "AgentTypeTestApp"), pipeline.getAppConfig());
  }

  @Test
  void unknownTypelessPipelineRemainsForHigherLevelValidation() {
    Map<String, Object> config = Map.of("includeTables", true);
    assertSame(config, ClassConverterFactory.convertProperty(SourceConfig.class, "config", config));
  }

  @Test
  void typelessPipelineDoesNotBypassUnknownFieldValidation() {
    assertThrows(
        SchemaConversionException.class,
        () ->
            ClassConverterFactory.convertProperty(
                SourceConfig.class, "config", Map.of("bogus", "x")));
    assertInstanceOf(
        SchemaBackedMap.class,
        ClassConverterFactory.convertPropertyForRead(
            SourceConfig.class, "config", Map.of("bogus", "x")));
  }

  @Test
  void schemaFactsDeriveImmediateCredentialRoots() {
    var roots = SchemaFacts.passwordChildren(SourceConfig.class, "config");
    assertTrue(
        roots.containsAll(
            Set.of(
                "dbtConfigSource",
                "storageMetadataConfigSource",
                "serviceConnections",
                "appConfig",
                "appPrivateConfig")),
        roots.toString());
    assertFalse(roots.contains("scheduleInterval"));
    assertThrows(UnsupportedOperationException.class, () -> roots.add("other"));
  }
}
