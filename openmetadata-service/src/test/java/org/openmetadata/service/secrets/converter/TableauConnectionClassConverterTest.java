package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.credentials.TableauConnectedAppAuth;
import org.openmetadata.schema.services.connections.dashboard.TableauConnection;
import org.openmetadata.schema.services.connections.pipeline.TableauPipelineConnection;

/**
 * A connected app's secret value sits behind the {@code authType} oneOf, so it is masked and
 * encrypted only once the converter types it.
 */
class TableauConnectionClassConverterTest {

  private static final Map<String, Object> CONNECTION =
      Map.of(
          "hostPort",
          "https://tableau.example.com",
          "authType",
          Map.of(
              "clientId", "client-id",
              "secretId", "secret-id",
              "secretValue", "secret-value",
              "username", "api-user"));

  @Test
  void dashboardConnectionTypesAConnectedApp() {
    TableauConnection connection =
        (TableauConnection)
            ClassConverterFactory.getConverter(TableauConnection.class).convert(CONNECTION);

    TableauConnectedAppAuth auth =
        assertInstanceOf(TableauConnectedAppAuth.class, connection.getAuthType());
    assertEquals("secret-value", auth.getSecretValue());
  }

  @Test
  void pipelineConnectionTypesAConnectedApp() {
    TableauPipelineConnection connection =
        (TableauPipelineConnection)
            ClassConverterFactory.getConverter(TableauPipelineConnection.class).convert(CONNECTION);

    TableauConnectedAppAuth auth =
        assertInstanceOf(TableauConnectedAppAuth.class, connection.getAuthType());
    assertEquals("secret-value", auth.getSecretValue());
  }
}
