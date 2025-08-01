package org.openmetadata.service.apps;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import io.dropwizard.configuration.ConfigurationException;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.ResourceConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import java.io.IOException;
import java.net.URL;
import java.util.Map;
import org.apache.commons.text.StringSubstitutor;
import org.openmetadata.schema.api.configuration.apps.AppPrivateConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ConfigurationReader {
  private static final Logger log = LoggerFactory.getLogger(ConfigurationReader.class);
  private final StringSubstitutor substitutor;
  private final ObjectMapper mapper = new ObjectMapper(new YAMLFactory());
  private final YamlConfigurationFactory<Object> factory =
      new YamlConfigurationFactory<>(Object.class, null, mapper, "app");

  public ConfigurationReader(Map<String, String> envMap) {
    // envMap is for custom environment variables (e.g., for testing), defaulting to the system
    // environment.
    substitutor =
        envMap == null ? new EnvironmentVariableSubstitutor(false) : new StringSubstitutor(envMap);
  }

  public ConfigurationReader() {
    this(System.getenv());
  }

  public AppPrivateConfig readConfigFromResource(String appName)
      throws IOException, ConfigurationException {
    String configFilePath = "applications/" + appName + "/config.yaml";
    URL resource = ConfigurationReader.class.getClassLoader().getResource(configFilePath);
    if (resource == null) {
      throw new IOException("Configuration file not found: " + configFilePath);
    }
    log.debug("Loaded config file from resource: {}", configFilePath);
    return JsonUtils.convertValue(readConfigResource(configFilePath), AppPrivateConfig.class);
  }

  public Map<String, Object> readConfigResource(String resourcePath)
      throws IOException, ConfigurationException {
    try {
      return (Map<String, Object>)
          factory.build(
              new SubstitutingSourceProvider(
                  new ResourceConfigurationSourceProvider(), substitutor),
              resourcePath);
    } catch (ClassCastException e) {
      throw new RuntimeException("Configuration file is not a valid YAML file", e);
    }
  }
}
