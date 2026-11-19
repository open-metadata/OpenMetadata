package org.openmetadata.service.apps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

class ApplicationHandlerTest {
  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void configurationConversionKeepsRuntimeConnectionsSeparate(boolean encrypt) {
    ApplicationHandler handler = handler();
    App app = app();

    App result = convert(handler, app, encrypt);

    assertSame(app, result);
    assertEquals(Map.of("value", encrypt ? "encoded" : "decoded"), result.getAppConfiguration());
    assertNull(app.getOpenMetadataServerConnection());
    assertNull(app.getPrivateConfiguration());
    assertEquals(true, app.getEnabled());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void failedConversionLeavesTheInputUnchanged(boolean encrypt) {
    ApplicationHandler handler = handler();
    App app = app().withAppConfiguration(new HashMap<>(Map.of("fail", true)));
    String before = JsonUtils.pojoToJson(app);

    assertThrows(IllegalArgumentException.class, () -> convert(handler, app, encrypt));

    assertEquals(before, JsonUtils.pojoToJson(app));
  }

  private App app() {
    return new App()
        .withName("ConfigurationTest")
        .withEnabled(false)
        .withClassName(ConfigurationApplication.class.getName())
        .withAppConfiguration(new HashMap<>(Map.of("value", "input")));
  }

  private App convert(ApplicationHandler handler, App app, boolean encrypt) {
    return encrypt
        ? handler.appWithEncryptedAppConfiguration(app, null, null)
        : handler.appWithDecryptedAppConfiguration(app, null, null);
  }

  private ApplicationHandler handler() {
    ApplicationHandler handler = mock(ApplicationHandler.class, CALLS_REAL_METHODS);
    doAnswer(
            invocation -> {
              App app = invocation.getArgument(0);
              app.setOpenMetadataServerConnection(
                  new OpenMetadataConnection()
                      .withSecurityConfig(
                          new OpenMetadataJWTClientConfig().withJwtToken("runtime")));
              app.setPrivateConfiguration(Map.of("parameter", "runtime"));
              app.setEnabled(true);
              return null;
            })
        .when(handler)
        .setAppRuntimeProperties(any());
    return handler;
  }

  public static class ConfigurationApplication extends AbstractNativeApplication {
    private App initialized;

    public ConfigurationApplication(CollectionDAO dao, SearchRepository search) {
      super(dao, search);
    }

    @Override
    public void init(App app) {
      initialized = app;
    }

    @Override
    protected Map<String, Object> encryptConfiguration(Map<String, Object> config) {
      return convert(config, "encoded");
    }

    @Override
    protected Map<String, Object> decryptConfiguration(Map<String, Object> config) {
      return convert(config, "decoded");
    }

    private Map<String, Object> convert(Map<String, Object> config, String value) {
      assertEquals(
          "runtime", JsonUtils.getMap(initialized.getPrivateConfiguration()).get("parameter"));
      config.put("value", value);
      if (Boolean.TRUE.equals(config.get("fail"))) {
        throw new IllegalArgumentException("Invalid configuration");
      }
      return config;
    }
  }
}
