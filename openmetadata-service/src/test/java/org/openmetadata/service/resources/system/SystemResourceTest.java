package org.openmetadata.service.resources.system;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;

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
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.configuration.profiler.MetricConfigurationDefinition;
import org.openmetadata.schema.api.configuration.profiler.ProfilerConfiguration;
import org.openmetadata.schema.api.data.*;
import org.openmetadata.schema.api.lineage.LineageSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.configuration.AssetCertificationSettings;
import org.openmetadata.schema.configuration.WorkflowSettings;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.profiler.MetricType;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.system.ValidationResponse;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.util.EntitiesCount;
import org.openmetadata.schema.util.ServicesCount;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationTest;
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
import org.openmetadata.service.resources.settings.SettingsCache;
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
  void testSystemConfigsUpdate(TestInfo test) throws HttpResponseException {
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
                    .withAuthType(AuthenticationMechanism.AuthType.JWT)
                    .withConfig(
                        new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited)));

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
  void testDefaultSettingsInitialization() throws HttpResponseException {
    SettingsCache.initialize(config);
    Settings uiThemeSettings = getSystemConfig(SettingsType.CUSTOM_UI_THEME_PREFERENCE);
    UiThemePreference uiThemePreference =
        JsonUtils.convertValue(uiThemeSettings.getConfigValue(), UiThemePreference.class);
    assertEquals("", uiThemePreference.getCustomTheme().getPrimaryColor());
    assertEquals("", uiThemePreference.getCustomLogoConfig().getCustomLogoUrlPath());
  }

  @Order(3)
  @Test
  void testUiThemePreferenceSettings() throws HttpResponseException {
    Settings uiThemeSettings = getSystemConfig(SettingsType.CUSTOM_UI_THEME_PREFERENCE);
    UiThemePreference uiThemePreference =
        JsonUtils.convertValue(uiThemeSettings.getConfigValue(), UiThemePreference.class);
    assertEquals("", uiThemePreference.getCustomTheme().getPrimaryColor());
    assertEquals("", uiThemePreference.getCustomLogoConfig().getCustomLogoUrlPath());

    uiThemePreference.getCustomTheme().setPrimaryColor("#FFFFFF");
    uiThemePreference.getCustomLogoConfig().setCustomLogoUrlPath("http://example.com/logo.png");

    Settings updatedUiThemeSettings =
        new Settings()
            .withConfigType(SettingsType.CUSTOM_UI_THEME_PREFERENCE)
            .withConfigValue(uiThemePreference);

    updateSystemConfig(updatedUiThemeSettings);

    Settings updatedSettings = getSystemConfig(SettingsType.CUSTOM_UI_THEME_PREFERENCE);
    UiThemePreference updatedUiThemePreference =
        JsonUtils.convertValue(updatedSettings.getConfigValue(), UiThemePreference.class);

    assertEquals("#FFFFFF", updatedUiThemePreference.getCustomTheme().getPrimaryColor());
    assertEquals(
        "http://example.com/logo.png",
        updatedUiThemePreference.getCustomLogoConfig().getCustomLogoUrlPath());
    // reset to default
    uiThemePreference.getCustomTheme().setPrimaryColor("");
    uiThemePreference.getCustomLogoConfig().setCustomLogoUrlPath("");
    updatedUiThemeSettings =
        new Settings()
            .withConfigType(SettingsType.CUSTOM_UI_THEME_PREFERENCE)
            .withConfigValue(uiThemePreference);
    updateSystemConfig(updatedUiThemeSettings);
  }

  @Test
  void testLoginConfigurationSettings() throws HttpResponseException {
    // Retrieve the default login configuration settings
    Settings loginSettings = getSystemConfig(SettingsType.LOGIN_CONFIGURATION);
    LoginConfiguration loginConfig =
        JsonUtils.convertValue(loginSettings.getConfigValue(), LoginConfiguration.class);

    // Assert default values
    assertEquals(3, loginConfig.getMaxLoginFailAttempts());
    assertEquals(30, loginConfig.getAccessBlockTime());
    assertEquals(3600, loginConfig.getJwtTokenExpiryTime());

    // Update login configuration
    loginConfig.setMaxLoginFailAttempts(5);
    loginConfig.setAccessBlockTime(300);
    loginConfig.setJwtTokenExpiryTime(7200);

    Settings updatedLoginSettings =
        new Settings()
            .withConfigType(SettingsType.LOGIN_CONFIGURATION)
            .withConfigValue(loginConfig);

    updateSystemConfig(updatedLoginSettings);

    // Retrieve the updated settings
    Settings updatedSettings = getSystemConfig(SettingsType.LOGIN_CONFIGURATION);
    LoginConfiguration updatedLoginConfig =
        JsonUtils.convertValue(updatedSettings.getConfigValue(), LoginConfiguration.class);

    // Assert updated values
    assertEquals(5, updatedLoginConfig.getMaxLoginFailAttempts());
    assertEquals(300, updatedLoginConfig.getAccessBlockTime());
    assertEquals(7200, updatedLoginConfig.getJwtTokenExpiryTime());
  }

  @Test
  void testSearchSettings() throws HttpResponseException {
    // Retrieve the default search settings
    Settings searchSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings searchConfig =
        JsonUtils.convertValue(searchSettings.getConfigValue(), SearchSettings.class);

    // Assert default values
    assertEquals(false, searchConfig.getEnableAccessControl());

    // Update search settings
    searchConfig.setEnableAccessControl(true);

    Settings updatedSearchSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    updateSystemConfig(updatedSearchSettings);

    // Retrieve the updated settings
    Settings updatedSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings updatedSearchConfig =
        JsonUtils.convertValue(updatedSettings.getConfigValue(), SearchSettings.class);

    // Assert updated values
    assertEquals(true, updatedSearchConfig.getEnableAccessControl());
  }

  @Test
  void testAssetCertificationSettings() throws HttpResponseException {
    // Retrieve the default asset certification settings
    Settings certificationSettings = getSystemConfig(SettingsType.ASSET_CERTIFICATION_SETTINGS);
    AssetCertificationSettings certificationConfig =
        JsonUtils.convertValue(
            certificationSettings.getConfigValue(), AssetCertificationSettings.class);

    // Assert default values
    assertEquals("Certification", certificationConfig.getAllowedClassification());
    assertEquals("P30D", certificationConfig.getValidityPeriod());

    // Update asset certification settings
    certificationConfig.setAllowedClassification("NewCertification");
    certificationConfig.setValidityPeriod("P60D");

    Settings updatedCertificationSettings =
        new Settings()
            .withConfigType(SettingsType.ASSET_CERTIFICATION_SETTINGS)
            .withConfigValue(certificationConfig);

    updateSystemConfig(updatedCertificationSettings);

    // Retrieve the updated settings
    Settings updatedSettings = getSystemConfig(SettingsType.ASSET_CERTIFICATION_SETTINGS);
    AssetCertificationSettings updatedCertificationConfig =
        JsonUtils.convertValue(updatedSettings.getConfigValue(), AssetCertificationSettings.class);

    // Assert updated values
    assertEquals("NewCertification", updatedCertificationConfig.getAllowedClassification());
    assertEquals("P60D", updatedCertificationConfig.getValidityPeriod());
  }

  @Test
  void testLineageSettings() throws HttpResponseException {
    // Retrieve the default lineage settings
    Settings lineageSettings = getSystemConfig(SettingsType.LINEAGE_SETTINGS);
    LineageSettings lineageConfig =
        JsonUtils.convertValue(lineageSettings.getConfigValue(), LineageSettings.class);

    // Assert default values
    assertEquals(2, lineageConfig.getUpstreamDepth());
    assertEquals(2, lineageConfig.getDownstreamDepth());

    // Update lineage settings
    lineageConfig.setUpstreamDepth(3);
    lineageConfig.setDownstreamDepth(4);

    Settings updatedLineageSettings =
        new Settings().withConfigType(SettingsType.LINEAGE_SETTINGS).withConfigValue(lineageConfig);

    updateSystemConfig(updatedLineageSettings);

    // Retrieve the updated settings
    Settings updatedSettings = getSystemConfigAsUser(SettingsType.LINEAGE_SETTINGS);
    LineageSettings updatedLineageConfig =
        JsonUtils.convertValue(updatedSettings.getConfigValue(), LineageSettings.class);

    // Assert updated values
    assertEquals(3, updatedLineageConfig.getUpstreamDepth());
    assertEquals(4, updatedLineageConfig.getDownstreamDepth());
  }

  @Test
  void testWorkflowSettings() throws HttpResponseException {
    // Retrieve the default workflow settings
    Settings setting = getSystemConfig(SettingsType.WORKFLOW_SETTINGS);
    WorkflowSettings workflowSettings =
        JsonUtils.convertValue(setting.getConfigValue(), WorkflowSettings.class);

    // Assert default values
    assertEquals(50, workflowSettings.getExecutorConfiguration().getCorePoolSize());
    assertEquals(1000, workflowSettings.getExecutorConfiguration().getQueueSize());
    assertEquals(100, workflowSettings.getExecutorConfiguration().getMaxPoolSize());
    assertEquals(20, workflowSettings.getExecutorConfiguration().getTasksDuePerAcquisition());
    assertEquals(7, workflowSettings.getHistoryCleanUpConfiguration().getCleanAfterNumberOfDays());

    // Update workflow settings
    workflowSettings.getExecutorConfiguration().setCorePoolSize(100);
    workflowSettings.getExecutorConfiguration().setQueueSize(2000);
    workflowSettings.getExecutorConfiguration().setMaxPoolSize(200);
    workflowSettings.getExecutorConfiguration().setTasksDuePerAcquisition(40);
    workflowSettings.getHistoryCleanUpConfiguration().setCleanAfterNumberOfDays(10);

    Settings updatedSetting =
        new Settings()
            .withConfigType(SettingsType.WORKFLOW_SETTINGS)
            .withConfigValue(workflowSettings);

    updateSystemConfig(updatedSetting);

    // Retrieve the updated settings
    Settings updatedSettings = getSystemConfig(SettingsType.WORKFLOW_SETTINGS);
    WorkflowSettings updateWorkflowSettings =
        JsonUtils.convertValue(updatedSettings.getConfigValue(), WorkflowSettings.class);

    // Assert updated values
    assertEquals(100, updateWorkflowSettings.getExecutorConfiguration().getCorePoolSize());
    assertEquals(2000, updateWorkflowSettings.getExecutorConfiguration().getQueueSize());
    assertEquals(200, updateWorkflowSettings.getExecutorConfiguration().getMaxPoolSize());
    assertEquals(40, updateWorkflowSettings.getExecutorConfiguration().getTasksDuePerAcquisition());
    assertEquals(
        10, updateWorkflowSettings.getHistoryCleanUpConfiguration().getCleanAfterNumberOfDays());
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

  private static Settings getSystemConfigAsUser(SettingsType settingsType)
      throws HttpResponseException {
    WebTarget target = getResource(String.format("system/settings/%s", settingsType.value()));
    return TestUtils.get(target, Settings.class, TEST_AUTH_HEADERS);
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
