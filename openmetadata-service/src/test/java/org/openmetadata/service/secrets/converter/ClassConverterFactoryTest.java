package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtGCSConfig;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.security.ssl.ValidateSSLClientConfig;
import org.openmetadata.schema.services.connections.dashboard.LookerConnection;
import org.openmetadata.schema.services.connections.dashboard.SupersetConnection;
import org.openmetadata.schema.services.connections.dashboard.TableauConnection;
import org.openmetadata.schema.services.connections.database.BigQueryConnection;
import org.openmetadata.schema.services.connections.database.ClickzettaConnection;
import org.openmetadata.schema.services.connections.database.DatalakeConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.services.connections.database.SalesforceConnection;
import org.openmetadata.schema.services.connections.database.TrinoConnection;
import org.openmetadata.schema.services.connections.database.datalake.GCSConfig;
import org.openmetadata.schema.services.connections.messaging.NatsConnection;
import org.openmetadata.schema.services.connections.messaging.PubSubConnection;
import org.openmetadata.schema.services.connections.pipeline.AirflowConnection;
import org.openmetadata.schema.services.connections.pipeline.MatillionConnection;
import org.openmetadata.schema.services.connections.pipeline.OpenLineageConnection;
import org.openmetadata.schema.services.connections.pipeline.PrefectConnection;
import org.openmetadata.schema.services.connections.pipeline.openlineage.NatsBrokerConfig;
import org.openmetadata.schema.services.connections.search.ElasticSearchConnection;
import org.openmetadata.schema.services.connections.storage.GCSConnection;

public class ClassConverterFactoryTest {

  @ParameterizedTest
  @ValueSource(
      classes = {
        AirflowConnection.class,
        BigQueryConnection.class,
        ClickzettaConnection.class,
        DatalakeConnection.class,
        MysqlConnection.class,
        PostgresConnection.class,
        DbtGCSConfig.class,
        DbtPipeline.class,
        GCSConfig.class,
        GCSConnection.class,
        ElasticSearchConnection.class,
        LookerConnection.class,
        SSOAuthMechanism.class,
        SupersetConnection.class,
        GCPCredentials.class,
        TableauConnection.class,
        TestServiceConnectionRequest.class,
        TrinoConnection.class,
        Workflow.class,
        SalesforceConnection.class,
        MatillionConnection.class,
        OpenLineageConnection.class,
        NatsBrokerConfig.class,
        NatsConnection.class,
        PubSubConnection.class,
        PrefectConnection.class,
      })
  void testClassConverterIsSet(Class<?> clazz) {
    assertFalse(
        ClassConverterFactory.getConverter(clazz) instanceof DefaultConnectionClassConverter);
  }

  @Test
  void testClassConvertedMapIsNotModified() {
    int originalSize = ClassConverterFactory.getConverterMap().size();
    ClassConverterFactory.getConverter(AirflowConnection.class);
    ClassConverterFactory.getConverter(BigQueryConnection.class);
    assertEquals(originalSize, ClassConverterFactory.getConverterMap().size());
  }

  @Test
  void testMergeDisjointReturnsTheUnion() {
    Map<Class<?>, ClassConverter> merged =
        ClassConverterFactory.mergeDisjoint(
            Map.of(MysqlConnection.class, new MysqlConnectionClassConverter()),
            Map.of(PostgresConnection.class, new PostgresConnectionClassConverter()));

    assertEquals(2, merged.size());
    assertInstanceOf(MysqlConnectionClassConverter.class, merged.get(MysqlConnection.class));
    assertInstanceOf(PostgresConnectionClassConverter.class, merged.get(PostgresConnection.class));
  }

  @Test
  void testMergeDisjointRejectsAClassClaimedTwice() {
    // The NatsConnection case: a dedicated converter that also types authType, and a
    // generic one that only types tlsConfig. Merging used to let the generic one win in
    // silence, leaving the auth token unencrypted and unmasked.
    Map<Class<?>, ClassConverter> dedicated =
        Map.of(NatsConnection.class, new NatsConnectionClassConverter());
    Map<Class<?>, ClassConverter> nested =
        Map.of(
            NatsConnection.class,
            new NestedConfigClassConverter(
                NatsConnection.class, Map.of("tlsConfig", List.of(ValidateSSLClientConfig.class))));

    IllegalStateException thrown =
        assertThrows(
            IllegalStateException.class,
            () -> ClassConverterFactory.mergeDisjoint(dedicated, nested));

    assertTrue(
        thrown.getMessage().contains(NatsConnection.class.getName()),
        "the message has to name the class so the duplicate can be found: " + thrown.getMessage());
  }
}
