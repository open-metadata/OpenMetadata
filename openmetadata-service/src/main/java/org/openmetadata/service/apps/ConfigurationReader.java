package org.openmetadata.service.apps;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import joptsimple.internal.Strings;
import org.apache.commons.text.StringSubstitutor;
import org.openmetadata.schema.api.configuration.apps.AppPrivateConfig;
import org.openmetadata.service.util.JsonUtils;

public class ConfigurationReader {

  private final Map<String, String> envMap;

  public ConfigurationReader(Map<String, String> envMap) {
    this.envMap = envMap;
  }

  public ConfigurationReader() {
    this.envMap = System.getenv();
  }

  public AppPrivateConfig readConfigFromResource(String appName) throws IOException {
    String configFilePath = "applications/" + appName + "/config.yaml";
    try (InputStream inputStream =
        ConfigurationReader.class.getClassLoader().getResourceAsStream(configFilePath)) {
      if (inputStream == null) {
        throw new IOException("Configuration file not found: " + configFilePath);
      }
      return JsonUtils.convertValue(readConfigFile(inputStream), AppPrivateConfig.class);
    }
  }

  public Map<String, Object> readConfigFile(InputStream configStream) throws IOException {
    ObjectMapper mapper = new ObjectMapper(new YAMLFactory());
    Map<String, Object> config = mapper.readValue(configStream, Map.class);
    resolveEnvVariablesInMap(config);
    return mapper.convertValue(config, Map.class);
  }

  private void resolveEnvVariablesInMap(Map<String, Object> map) {
    for (Map.Entry<String, Object> entry : map.entrySet()) {
      if (entry.getValue() instanceof String) {
        map.put(entry.getKey(), resolveEnvVariables((String) entry.getValue(), envMap));
      } else if (entry.getValue() instanceof Map) {
        resolveEnvVariablesInMap((Map<String, Object>) entry.getValue());
      } else if (entry.getValue() instanceof List) {
        resolveEnvVariablesInList((List<Object>) entry.getValue());
      }
    }
  }

  private void resolveEnvVariablesInList(List<Object> list) {
    for (int i = 0; i < list.size(); i++) {
      Object element = list.get(i);
      if (element instanceof String) {
        list.set(i, resolveEnvVariables((String) element, envMap));
      } else if (element instanceof Map) {
        resolveEnvVariablesInMap((Map<String, Object>) element);
      } else if (element instanceof List) {
        resolveEnvVariablesInList((List<Object>) element);
      }
    }
  }

  public static String resolveEnvVariables(String value, Map<String, String> envMap) {
    StringSubstitutor substitutor = new StringSubstitutor(envMap);
    String resolved = substitutor.replace(value);
    return resolved.equals("\"\"") ? Strings.EMPTY : resolved;
  }
}
