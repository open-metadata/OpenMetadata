package org.openmetadata.service.util;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.lang.reflect.Field;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;

@Slf4j
public class ConfigurationHolder {
  public enum ConfigurationType {
    AUTHORIZERCONFIG("authorizerConfiguration"),
    AUTHENTICATIONCONFIG("authenticationConfiguration"),
    SMTPCONFIG("email");
    private String value;

    ConfigurationType(String value) {
      this.value = value;
    }

    public String getValue() {
      return value;
    }

    @Override
    public String toString() {
      return String.valueOf(value);
    }

    public static ConfigurationType fromValue(String text) {
      for (ConfigurationType b : ConfigurationType.values()) {
        if (String.valueOf(b.value).equals(text)) {
          return b;
        }
      }
      return null;
    }
  }

  private static ConfigurationHolder INSTANCE = null;
  private final ConcurrentHashMap<ConfigurationType, Object> CONFIG_MAP = new ConcurrentHashMap<>();

  public void init(OpenMetadataApplicationConfig config) {
    for (Field field : OpenMetadataApplicationConfig.class.getDeclaredFields()) {
      if (field.isAnnotationPresent(JsonProperty.class)) {
        String configType = field.getAnnotation(JsonProperty.class).value();
        if (configType != null && !configType.equals("")) {
          ConfigurationType configTypeForEnum = ConfigurationType.fromValue(configType);
          if (configTypeForEnum == null) continue;
          switch (configTypeForEnum) {
            case AUTHORIZERCONFIG:
              CONFIG_MAP.put(ConfigurationType.AUTHORIZERCONFIG, config.getAuthorizerConfiguration());
              break;
            case AUTHENTICATIONCONFIG:
              CONFIG_MAP.put(ConfigurationType.AUTHENTICATIONCONFIG, config.getAuthenticationConfiguration());
              break;
            case SMTPCONFIG:
              CONFIG_MAP.put(ConfigurationType.SMTPCONFIG, config.getSmtpSettings());
              break;
            default:
              LOG.info("Currently AuthorizerConfig, AuthenticatioConfig, and SMTP these can be added");
          }
        }
      }
    }
  }

  public static synchronized ConfigurationHolder getInstance() {
    if (INSTANCE == null) {
      INSTANCE = new ConfigurationHolder();
    }
    return INSTANCE;
  }

  public <T> T getConfig(ConfigurationType configType, Class<T> clz) throws RuntimeException {
    Object config = CONFIG_MAP.get(configType);
    return JsonUtils.convertValue(config, clz);
  }
}
