package org.openmetadata.service.util.email;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.resources.settings.SettingsCache;

class EmailUtilBaseUrlTest {

  private SystemRepository previous;
  private MockedStatic<SettingsCache> settingsCache;
  private MockedConstruction<DefaultTemplateProvider> templateProvider;
  private final SystemRepository systemRepository = mock(SystemRepository.class);

  @BeforeEach
  void setUp() {
    // EmailUtil's static initializer reads the SMTP settings and builds the template provider
    // when the class first loads.
    templateProvider = mockConstruction(DefaultTemplateProvider.class);
    settingsCache = mockStatic(SettingsCache.class);
    settingsCache
        .when(() -> SettingsCache.getSetting(SettingsType.EMAIL_CONFIGURATION, SmtpSettings.class))
        .thenReturn(new SmtpSettings().withEnableSmtpServer(false));
    previous = Entity.getSystemRepository();
    Entity.setSystemRepository(systemRepository);
    when(systemRepository.getConfigWithKey(
            SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION.value()))
        .thenReturn(
            new Settings()
                .withConfigType(SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION)
                .withConfigValue(
                    new OpenMetadataBaseUrlConfiguration()
                        .withOpenMetadataUrl("https://om.example.com/")));
  }

  @AfterEach
  void tearDown() {
    Entity.setSystemRepository(previous);
    settingsCache.close();
    templateProvider.close();
  }

  @Test
  void readsTheBaseUrlFromTheRegisteredSystemRepository() {
    assertEquals("https://om.example.com", EmailUtil.getOMBaseURL());
  }

  @Test
  void doesNotReplaceTheRegisteredSystemRepository() {
    EmailUtil.getOMBaseURL();

    assertSame(systemRepository, Entity.getSystemRepository());
  }
}
