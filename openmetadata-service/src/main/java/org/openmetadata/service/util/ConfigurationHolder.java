package org.openmetadata.service.util;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.lang.reflect.Field;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;

@Slf4j
public class ConfigurationHolder {
  public enum ConfigurationType {
    AUTHORIZER_CONFIG("authorizerConfiguration"),
    AUTHENTICATION_CONFIG("authenticationConfiguration"),
    SMTP_CONFIG("email"),
    ELASTICSEARCH_CONFIG("elasticsearch"),
    LOGIN_CONFIG("login");

    private final String value;

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
    try {
      for (Field field : OpenMetadataApplicationConfig.class.getDeclaredFields()) {
        if (field.isAnnotationPresent(JsonProperty.class)) {
          String configType = field.getAnnotation(JsonProperty.class).value();
          if (configType != null && !configType.equals("")) {
            ConfigurationType configTypeForEnum = ConfigurationType.fromValue(configType);
            if (configTypeForEnum == null) continue;
            switch (configTypeForEnum) {
              case AUTHORIZER_CONFIG:
                CONFIG_MAP.put(ConfigurationType.AUTHORIZER_CONFIG, config.getAuthorizerConfiguration());
                break;
              case AUTHENTICATION_CONFIG:
                CONFIG_MAP.put(ConfigurationType.AUTHENTICATION_CONFIG, config.getAuthenticationConfiguration());
                break;
              case SMTP_CONFIG:
                CONFIG_MAP.put(ConfigurationType.SMTP_CONFIG, config.getSmtpSettings());
                break;
              case ELASTICSEARCH_CONFIG:
                CONFIG_MAP.put(ConfigurationType.ELASTICSEARCH_CONFIG, config.getElasticSearchConfiguration());
                break;
              case LOGIN_CONFIG:
                CONFIG_MAP.put(ConfigurationType.LOGIN_CONFIG, config.getLoginSettings());
                break;
              default:
                LOG.error("Invalid Setting Type Given.");
            }
          }
        }
      }
    } catch (Exception ex) {
      LOG.error("Failed in initialising Configuration Holder : Reason : {}", ex.getMessage());
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
