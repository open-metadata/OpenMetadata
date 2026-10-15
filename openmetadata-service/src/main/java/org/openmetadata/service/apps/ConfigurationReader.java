package org.openmetadata.service.apps;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import io.dropwizard.configuration.ConfigurationException;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.ResourceConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.nio.file.Path;
import java.util.Map;
import org.apache.commons.text.StringSubstitutor;
import org.openmetadata.schema.api.configuration.apps.AppPrivateConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ConfigurationReader {
  private static final Path APPLICATIONS_DIRECTORY = Path.of("applications");
  private static final String CONFIG_FILE_NAME = "config.yaml";
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
    final String configFilePath = resolveConfigFilePath(appName);
    final URL resource = ConfigurationReader.class.getClassLoader().getResource(configFilePath);
    if (resource == null) {
      throw new IOException("Configuration file not found: " + configFilePath);
    }
    log.debug("Loaded config file from resource: {}", configFilePath);
    return JsonUtils.convertValue(readConfigResource(configFilePath), AppPrivateConfig.class);
  }

  private Map<String, Object> readConfigResource(String resourcePath)
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

  private String resolveConfigFilePath(String appName) {
    if (nullOrEmpty(appName)) {
      throw new IllegalArgumentException("Application name is required");
    }

    final Path configFilePath =
        APPLICATIONS_DIRECTORY.resolve(appName).resolve(CONFIG_FILE_NAME).normalize();
    if (configFilePath.isAbsolute() || !configFilePath.startsWith(APPLICATIONS_DIRECTORY)) {
      throw new IllegalArgumentException(
          "Application name resolves outside the application configuration directory");
    }
    return configFilePath.toString().replace(File.separatorChar, '/');
  }
}
