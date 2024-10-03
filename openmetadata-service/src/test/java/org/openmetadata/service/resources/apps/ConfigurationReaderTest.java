package org.openmetadata.service.resources.apps;

import static org.junit.Assert.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEqual;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import io.dropwizard.configuration.ConfigurationException;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.apps.AppPrivateConfig;
import org.openmetadata.service.apps.ConfigurationReader;

public class ConfigurationReaderTest {

  @Test
  public void testReadConfigFile() throws IOException, ConfigurationException {
    ConfigurationReader reader =
        new ConfigurationReader(
            Map.of(
                "ENV_VAR",
                "resolvedValue",
                "NESTED_ENV_VAR",
                "nestedValue",
                "LIST_ENV_VAR",
                "value1"));
    AppPrivateConfig appConfig = reader.readConfigFromResource("TestApplication");
    assertNotNull(appConfig);
    assertEqual("value1", appConfig.getParameters().getAdditionalProperties().get("key1"));
    assertEqual("resolvedValue", appConfig.getParameters().getAdditionalProperties().get("key2"));
    assertEqual("", appConfig.getParameters().getAdditionalProperties().get("emptyKey"));
    assertEqual("default", appConfig.getParameters().getAdditionalProperties().get("defaultKey"));
    Map<String, String> nested =
        (Map<String, String>) appConfig.getParameters().getAdditionalProperties().get("nested");
    assertEqual("nestedValue", nested.get("nestedKey"));
    List<String> list =
        (List<String>) appConfig.getParameters().getAdditionalProperties().get("list");
    assertEqual("value1", list.get(1));
  }

  @Test
  public void testInvalidConfig() {
    ConfigurationReader reader = new ConfigurationReader();
    assertThrows(RuntimeException.class, () -> reader.readConfigFromResource("InvalidConfig"));
  }

  @Test
  public void missingConfig() {
    ConfigurationReader reader = new ConfigurationReader();
    assertThrows(
        IOException.class,
        () -> {
          reader.readConfigFromResource("missing");
        });
  }
}
