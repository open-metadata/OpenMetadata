package org.openmetadata.service.resources.system;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.ConfigurationException;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.validation.Validators;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import javax.validation.Validator;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.api.configuration.LogoConfiguration;
import org.openmetadata.api.configuration.ThemeConfiguration;
import org.openmetadata.api.configuration.UiThemePreference;
import org.openmetadata.schema.api.configuration.profiler.MetricConfigurationDefinition;
import org.openmetadata.schema.api.configuration.profiler.ProfilerConfiguration;
import org.openmetadata.schema.api.data.*;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.profiler.MetricType;
import org.openmetadata.schema.security.client.GoogleSSOClientConfig;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.system.ValidationResponse;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.util.EntitiesCount;
import org.openmetadata.schema.util.ServicesCount;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.dashboards.DashboardResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.dqtests.TestSuiteResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryTermResourceTest;
import org.openmetadata.service.resources.pipelines.PipelineResourceTest;
import org.openmetadata.service.resources.searchindex.SearchIndexResourceTest;
import org.openmetadata.service.resources.services.DashboardServiceResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.resources.services.MessagingServiceResourceTest;
import org.openmetadata.service.resources.services.MlModelServiceResourceTest;
import org.openmetadata.service.resources.services.PipelineServiceResourceTest;
import org.openmetadata.service.resources.services.StorageServiceResourceTest;
import org.openmetadata.service.resources.storages.ContainerResourceTest;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.resources.topics.TopicResourceTest;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SystemResourceTest extends OpenMetadataApplicationTest {
  static OpenMetadataApplicationConfig config;

  @BeforeAll
  static void setup() throws IOException, ConfigurationException {
    // Get config object from test yaml file
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    Validator validator = Validators.newValidator();
    YamlConfigurationFactory<OpenMetadataApplicationConfig> factory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class, validator, objectMapper, "dw");
    config = factory.build(new FileConfigurationSourceProvider(), CONFIG_PATH);
  }

  @BeforeAll
  public static void setup(TestInfo test) throws IOException, URISyntaxException {
    EntityResourceTest<Table, CreateTable> entityResourceTest = new TableResourceTest();
    entityResourceTest.setup(test);
  }

  @Test
  void entitiesCount(TestInfo test) throws HttpResponseException {
    // Get count before adding entities
    EntitiesCount beforeCount = getEntitiesCount();

    // Create Table
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable = tableResourceTest.createRequest(test);
    tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Create Dashboard
    DashboardResourceTest dashboardResourceTest = new DashboardResourceTest();
    CreateDashboard createDashboard = dashboardResourceTest.createRequest(test);
    dashboardResourceTest.createEntity(createDashboard, ADMIN_AUTH_HEADERS);

    // Create Topic
    TopicResourceTest topicResourceTest = new TopicResourceTest();
    CreateTopic createTopic = topicResourceTest.createRequest(test);
    topicResourceTest.createEntity(createTopic, ADMIN_AUTH_HEADERS);

    // Create Pipeline
    PipelineResourceTest pipelineResourceTest = new PipelineResourceTest();
    CreatePipeline createPipeline = pipelineResourceTest.createRequest(test);
    pipelineResourceTest.createEntity(createPipeline, ADMIN_AUTH_HEADERS);

    // Create Service
    MessagingServiceResourceTest messagingServiceResourceTest = new MessagingServiceResourceTest();
    CreateMessagingService createMessagingService =
        messagingServiceResourceTest.createRequest(test);
    messagingServiceResourceTest.createEntity(createMessagingService, ADMIN_AUTH_HEADERS);

    // Create User
    UserResourceTest userResourceTest = new UserResourceTest();
    CreateUser createUser = userResourceTest.createRequest(test);
    userResourceTest.createEntity(createUser, ADMIN_AUTH_HEADERS);

    // Create Team
    TeamResourceTest teamResourceTest = new TeamResourceTest();
    CreateTeam createTeam = teamResourceTest.createRequest(test);
    teamResourceTest.createEntity(createTeam, ADMIN_AUTH_HEADERS);

    // Create Test Suite
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();
    CreateTestSuite createTestSuite = testSuiteResourceTest.createRequest(test);
    testSuiteResourceTest.createEntity(createTestSuite, ADMIN_AUTH_HEADERS);

    // Create Storage Container
    ContainerResourceTest containerResourceTest = new ContainerResourceTest();
    CreateContainer createContainer = containerResourceTest.createRequest(test);
    containerResourceTest.createEntity(createContainer, ADMIN_AUTH_HEADERS);

    SearchIndexResourceTest SearchIndexResourceTest = new SearchIndexResourceTest();
    CreateSearchIndex createSearchIndex = SearchIndexResourceTest.createRequest(test);
    SearchIndexResourceTest.createEntity(createSearchIndex, ADMIN_AUTH_HEADERS);

    GlossaryResourceTest glossaryResourceTest = new GlossaryResourceTest();
    CreateGlossary createGlossary = glossaryResourceTest.createRequest(test);
    glossaryResourceTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);

    GlossaryTermResourceTest glossaryTermResourceTest = new GlossaryTermResourceTest();
    CreateGlossaryTerm createGlossaryTerm = glossaryTermResourceTest.createRequest(test);
    glossaryTermResourceTest.createEntity(createGlossaryTerm, ADMIN_AUTH_HEADERS);

    // Ensure counts of entities is increased by 1
    EntitiesCount afterCount = getEntitiesCount();
    assertEquals(beforeCount.getDashboardCount() + 1, afterCount.getDashboardCount());
    assertEquals(beforeCount.getPipelineCount() + 1, afterCount.getPipelineCount());
    assertEquals(beforeCount.getServicesCount() + 1, afterCount.getServicesCount());
    assertEquals(beforeCount.getUserCount() + 1, afterCount.getUserCount());
    assertEquals(beforeCount.getTableCount() + 1, afterCount.getTableCount());
    assertEquals(beforeCount.getTeamCount() + 1, afterCount.getTeamCount());
    assertEquals(beforeCount.getTopicCount() + 1, afterCount.getTopicCount());
    assertEquals(beforeCount.getTestSuiteCount() + 1, afterCount.getTestSuiteCount());
    assertEquals(beforeCount.getStorageContainerCount() + 1, afterCount.getStorageContainerCount());
    assertEquals(beforeCount.getGlossaryCount() + 1, afterCount.getGlossaryCount());
    assertEquals(beforeCount.getGlossaryTermCount() + 1, afterCount.getGlossaryTermCount());
  }

  @Test
  @Order(2)
  void testSystemConfigs() throws HttpResponseException {
    // Test Email Config
    Settings emailSettings = getSystemConfig(SettingsType.EMAIL_CONFIGURATION);
    SmtpSettings smtp = JsonUtils.convertValue(emailSettings.getConfigValue(), SmtpSettings.class);
    // Password for Email is always sent in hidden
    SmtpSettings expected = config.getSmtpSettings();
    expected.setPassword("***********");
    assertEquals(expected, smtp);

    // Test Custom Ui Theme Preference Config
    Settings uiThemeConfigWrapped = getSystemConfig(SettingsType.CUSTOM_UI_THEME_PREFERENCE);
    UiThemePreference uiThemePreference =
        JsonUtils.convertValue(uiThemeConfigWrapped.getConfigValue(), UiThemePreference.class);

    // Defaults
    assertEquals("", uiThemePreference.getCustomTheme().getPrimaryColor());
    assertEquals("", uiThemePreference.getCustomTheme().getSuccessColor());
    assertEquals("", uiThemePreference.getCustomTheme().getErrorColor());
    assertEquals("", uiThemePreference.getCustomTheme().getWarningColor());
    assertEquals("", uiThemePreference.getCustomTheme().getInfoColor());
    assertEquals("", uiThemePreference.getCustomLogoConfig().getCustomLogoUrlPath());
    assertEquals("", uiThemePreference.getCustomLogoConfig().getCustomMonogramUrlPath());
  }

  @Test
  @Order(1)
  void testDefaultEmailSystemConfig() {
    // Test Email Config
    Settings stored =
        Entity.getCollectionDAO()
            .systemDAO()
            .getConfigWithKey(SettingsType.EMAIL_CONFIGURATION.value());
    SmtpSettings storedAndEncrypted =
        JsonUtils.convertValue(stored.getConfigValue(), SmtpSettings.class);
    assertTrue(Fernet.isTokenized(storedAndEncrypted.getPassword()));
    assertEquals(
        config.getSmtpSettings().getPassword(),
        Fernet.getInstance().decryptIfApplies(storedAndEncrypted.getPassword()));
  }

  @Test
  void testSystemConfigsUpdate(TestInfo test) throws HttpResponseException {
    // Test Email Config
    SmtpSettings smtpSettings = config.getSmtpSettings();
    // Update a few Email fields
    smtpSettings.setUsername(test.getDisplayName());
    smtpSettings.setEmailingEntity(test.getDisplayName());

    updateSystemConfig(
        new Settings()
            .withConfigType(SettingsType.EMAIL_CONFIGURATION)
            .withConfigValue(smtpSettings));
    SmtpSettings updateEmailSettings =
        JsonUtils.convertValue(
            getSystemConfig(SettingsType.EMAIL_CONFIGURATION).getConfigValue(), SmtpSettings.class);
    assertEquals(updateEmailSettings.getUsername(), test.getDisplayName());
    assertEquals(updateEmailSettings.getEmailingEntity(), test.getDisplayName());

    // Test Custom Logo Update and theme preference
    UiThemePreference updateConfigReq =
        new UiThemePreference()
            .withCustomLogoConfig(
                new LogoConfiguration()
                    .withCustomLogoUrlPath("http://test.com")
                    .withCustomMonogramUrlPath("http://test.com"))
            .withCustomTheme(
                new ThemeConfiguration()
                    .withPrimaryColor("")
                    .withSuccessColor("")
                    .withErrorColor("")
                    .withWarningColor("")
                    .withInfoColor(""));
    // Update Custom Logo Settings
    updateSystemConfig(
        new Settings()
            .withConfigType(SettingsType.CUSTOM_UI_THEME_PREFERENCE)
            .withConfigValue(updateConfigReq));
    UiThemePreference updatedConfig =
        JsonUtils.convertValue(
            getSystemConfig(SettingsType.CUSTOM_UI_THEME_PREFERENCE).getConfigValue(),
            UiThemePreference.class);
    assertEquals(updateConfigReq, updatedConfig);
  }

  @Test
  void servicesCount(TestInfo test) throws HttpResponseException {
    // Get count before adding services
    ServicesCount beforeCount = getServicesCount();

    // Create Database Service
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    CreateDatabaseService createDatabaseService = databaseServiceResourceTest.createRequest(test);
    databaseServiceResourceTest.createEntity(createDatabaseService, ADMIN_AUTH_HEADERS);

    // Create Messaging Service
    MessagingServiceResourceTest messagingServiceResourceTest = new MessagingServiceResourceTest();
    CreateMessagingService createMessagingService =
        messagingServiceResourceTest.createRequest(test);
    messagingServiceResourceTest.createEntity(createMessagingService, ADMIN_AUTH_HEADERS);

    // Create Dashboard Service
    DashboardServiceResourceTest dashboardServiceResourceTest = new DashboardServiceResourceTest();
    CreateDashboardService createDashboardService =
        dashboardServiceResourceTest.createRequest(test);
    dashboardServiceResourceTest.createEntity(createDashboardService, ADMIN_AUTH_HEADERS);

    // Create Pipeline Service
    PipelineServiceResourceTest pipelineServiceResourceTest = new PipelineServiceResourceTest();
    CreatePipelineService createPipelineService = pipelineServiceResourceTest.createRequest(test);
    pipelineServiceResourceTest.createEntity(createPipelineService, ADMIN_AUTH_HEADERS);

    // Create MlModel Service
    MlModelServiceResourceTest mlModelServiceResourceTest = new MlModelServiceResourceTest();
    CreateMlModelService createMlModelService = mlModelServiceResourceTest.createRequest(test);
    mlModelServiceResourceTest.createEntity(createMlModelService, ADMIN_AUTH_HEADERS);

    // Create Storage Service
    StorageServiceResourceTest storageServiceResourceTest = new StorageServiceResourceTest();
    CreateStorageService createStorageService = storageServiceResourceTest.createRequest(test);
    storageServiceResourceTest.createEntity(createStorageService, ADMIN_AUTH_HEADERS);

    // Get count after creating services and ensure it increased by 1
    ServicesCount afterCount = getServicesCount();
    assertEquals(beforeCount.getMessagingServiceCount() + 1, afterCount.getMessagingServiceCount());
    assertEquals(beforeCount.getDashboardServiceCount() + 1, afterCount.getDashboardServiceCount());
    assertEquals(beforeCount.getPipelineServiceCount() + 1, afterCount.getPipelineServiceCount());
    assertEquals(beforeCount.getMlModelServiceCount() + 1, afterCount.getMlModelServiceCount());
    assertEquals(beforeCount.getStorageServiceCount() + 1, afterCount.getStorageServiceCount());
  }

  @Test
  void botUserCountCheck(TestInfo test) throws HttpResponseException {
    int beforeUserCount = getEntitiesCount().getUserCount();

    // Create a bot user.
    UserResourceTest userResourceTest = new UserResourceTest();
    CreateUser createUser =
        userResourceTest
            .createRequest(test)
            .withIsBot(true)
            .withAuthenticationMechanism(
                new AuthenticationMechanism()
                    .withAuthType(AuthenticationMechanism.AuthType.SSO)
                    .withConfig(
                        new SSOAuthMechanism()
                            .withSsoServiceType(SSOAuthMechanism.SsoServiceType.GOOGLE)
                            .withAuthConfig(
                                new GoogleSSOClientConfig()
                                    .withSecretKey("/fake/path/secret.json"))));
    userResourceTest.createEntity(createUser, ADMIN_AUTH_HEADERS);

    int afterUserCount = getEntitiesCount().getUserCount();

    // The bot user count should not be considered.
    assertEquals(beforeUserCount, afterUserCount);
  }

  @Test
  void validate_test() throws HttpResponseException {
    ValidationResponse response = getValidation();

    // Check migrations are OK
    assertEquals(Boolean.TRUE, response.getMigrations().getPassed());
  }

  @Test
  void globalProfilerConfig(TestInfo test) throws HttpResponseException {
    // Create a profiler config
    ProfilerConfiguration profilerConfiguration = new ProfilerConfiguration();
    MetricConfigurationDefinition intMetricConfigDefinition =
        new MetricConfigurationDefinition()
            .withDataType(ColumnDataType.INT)
            .withMetrics(
                List.of(MetricType.VALUES_COUNT, MetricType.FIRST_QUARTILE, MetricType.MEAN));
    MetricConfigurationDefinition dateTimeMetricConfigDefinition =
        new MetricConfigurationDefinition()
            .withDataType(ColumnDataType.DATETIME)
            .withDisabled(true);
    profilerConfiguration.setMetricConfiguration(
        List.of(intMetricConfigDefinition, dateTimeMetricConfigDefinition));
    Settings profilerSettings =
        new Settings()
            .withConfigType(SettingsType.PROFILER_CONFIGURATION)
            .withConfigValue(profilerConfiguration);
    createSystemConfig(profilerSettings);
    ProfilerConfiguration createdProfilerSettings =
        JsonUtils.convertValue(getProfilerConfig().getConfigValue(), ProfilerConfiguration.class);
    assertEquals(profilerConfiguration, createdProfilerSettings);

    // Update the profiler config
    profilerConfiguration.setMetricConfiguration(List.of(intMetricConfigDefinition));
    profilerSettings =
        new Settings()
            .withConfigType(SettingsType.PROFILER_CONFIGURATION)
            .withConfigValue(profilerConfiguration);
    updateSystemConfig(profilerSettings);
    ProfilerConfiguration updatedProfilerSettings =
        JsonUtils.convertValue(getProfilerConfig().getConfigValue(), ProfilerConfiguration.class);
    assertEquals(profilerConfiguration, updatedProfilerSettings);

    // Delete the profiler config
    profilerConfiguration.setMetricConfiguration(new ArrayList<>());
    updateSystemConfig(
        new Settings()
            .withConfigType(SettingsType.PROFILER_CONFIGURATION)
            .withConfigValue(profilerConfiguration));
    updatedProfilerSettings =
        JsonUtils.convertValue(getProfilerConfig().getConfigValue(), ProfilerConfiguration.class);
    assertEquals(profilerConfiguration, updatedProfilerSettings);
  }

  private static ValidationResponse getValidation() throws HttpResponseException {
    WebTarget target = getResource("system/status");
    return TestUtils.get(target, ValidationResponse.class, ADMIN_AUTH_HEADERS);
  }

  private static EntitiesCount getEntitiesCount() throws HttpResponseException {
    WebTarget target = getResource("system/entities/count");
    return TestUtils.get(target, EntitiesCount.class, ADMIN_AUTH_HEADERS);
  }

  private static ServicesCount getServicesCount() throws HttpResponseException {
    WebTarget target = getResource("system/services/count");
    return TestUtils.get(target, ServicesCount.class, ADMIN_AUTH_HEADERS);
  }

  private static Settings getSystemConfig(SettingsType settingsType) throws HttpResponseException {
    WebTarget target = getResource(String.format("system/settings/%s", settingsType.value()));
    return TestUtils.get(target, Settings.class, ADMIN_AUTH_HEADERS);
  }

  private static Settings getProfilerConfig() throws HttpResponseException {
    WebTarget target = getResource("system/settings/profilerConfiguration");
    return TestUtils.get(target, Settings.class, ADMIN_AUTH_HEADERS);
  }

  private static void updateSystemConfig(Settings updatedSetting) throws HttpResponseException {
    WebTarget target = getResource("system/settings");
    TestUtils.put(target, updatedSetting, Response.Status.OK, ADMIN_AUTH_HEADERS);
  }

  private static void createSystemConfig(Settings updatedSetting) throws HttpResponseException {
    WebTarget target = getResource("system/settings");
    TestUtils.put(target, updatedSetting, Response.Status.CREATED, ADMIN_AUTH_HEADERS);
  }
}
