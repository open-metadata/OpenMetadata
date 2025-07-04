package org.openmetadata.service.resources.system;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.ConfigurationException;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.api.configuration.LogoConfiguration;
import org.openmetadata.api.configuration.ThemeConfiguration;
import org.openmetadata.api.configuration.UiThemePreference;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.configuration.profiler.MetricConfigurationDefinition;
import org.openmetadata.schema.api.configuration.profiler.ProfilerConfiguration;
import org.openmetadata.schema.api.data.*;
import org.openmetadata.schema.api.lineage.LineageSettings;
import org.openmetadata.schema.api.search.AllowedSearchFields;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.Field;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.TermBoost;
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
import org.openmetadata.schema.utils.JsonUtils;
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
import org.openmetadata.service.util.TestUtils;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.security.client.SamlSSOClientConfig;
import org.openmetadata.service.security.auth.AuthenticationConfigurationManager;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Execution(ExecutionMode.CONCURRENT)
class SystemResourceTest extends OpenMetadataApplicationTest {
  static OpenMetadataApplicationConfig config;

  @BeforeAll
  static void setup() throws IOException, ConfigurationException {
    // Get config object from test yaml file
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    ValidatorFactory validatorFactory = Validation.buildDefaultValidatorFactory();
    Validator validator = validatorFactory.getValidator();
    YamlConfigurationFactory<OpenMetadataApplicationConfig> configFactory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class, validator, objectMapper, "dw");
    config = configFactory.build(new FileConfigurationSourceProvider(), CONFIG_PATH);
  }

  @BeforeAll
  static void setup(TestInfo test) throws IOException, URISyntaxException {
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

    SearchIndexResourceTest searchIndexResourceTest = new SearchIndexResourceTest();
    CreateSearchIndex createSearchIndex = searchIndexResourceTest.createRequest(test);
    searchIndexResourceTest.createEntity(createSearchIndex, ADMIN_AUTH_HEADERS);

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
  void testSystemConfigsUpdate() throws HttpResponseException {
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

  @Order(1)
  @Test
  void testGetDefaultSearchSettings() throws HttpResponseException {
    // Retrieve the default search settings
    Settings searchSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings searchConfig =
        JsonUtils.convertValue(searchSettings.getConfigValue(), SearchSettings.class);

    // Assert default values
    assertEquals(false, searchConfig.getGlobalSettings().getEnableAccessControl());

    // Verify that global settings are loaded
    assertNotNull(searchConfig.getGlobalSettings());
    assertEquals(10000, searchConfig.getGlobalSettings().getMaxAggregateSize());
    assertEquals(10000, searchConfig.getGlobalSettings().getMaxResultHits());
    assertEquals(1000, searchConfig.getGlobalSettings().getMaxAnalyzedOffset());

    // Verify that aggregations are loaded
    assertNotNull(searchConfig.getGlobalSettings().getAggregations());
    assertFalse(searchConfig.getGlobalSettings().getAggregations().isEmpty());

    // Verify that highlight fields are loaded
    assertNotNull(searchConfig.getGlobalSettings().getHighlightFields());
    assertFalse(searchConfig.getGlobalSettings().getHighlightFields().isEmpty());

    // Verify that asset type configurations are loaded
    assertNotNull(searchConfig.getAssetTypeConfigurations());
    assertFalse(searchConfig.getAssetTypeConfigurations().isEmpty());

    // Check if 'table' asset type configuration exists
    boolean tableConfigExists =
        searchConfig.getAssetTypeConfigurations().stream()
            .anyMatch(conf -> "table".equalsIgnoreCase(conf.getAssetType()));
    assertTrue(tableConfigExists);

    // Verify default configuration is loaded
    assertNotNull(searchConfig.getDefaultConfiguration());
  }

  @Test
  void testResetSearchSettingsToDefault() throws HttpResponseException {
    Settings searchSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings searchConfig =
        JsonUtils.convertValue(searchSettings.getConfigValue(), SearchSettings.class);

    searchConfig.getGlobalSettings().setEnableAccessControl(true);
    searchConfig.getGlobalSettings().setMaxAggregateSize(5000);

    AssetTypeConfiguration tableConfig =
        searchConfig.getAssetTypeConfigurations().stream()
            .filter(conf -> "table".equalsIgnoreCase(conf.getAssetType()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Table configuration not found"));

    // Find the existing 'name' field and update its boost by adding 20.0
    FieldBoost nameField =
        tableConfig.getSearchFields().stream()
            .filter(field -> "name".equals(field.getField()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Name field configuration not found"));

    // Update the existing field boost instead of adding a new one
    nameField.setBoost(nameField.getBoost() + 20.0);

    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    updateSystemConfig(updatedSettings);

    // Rest of the test remains unchanged
    Settings modifiedSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings modifiedSearchConfig =
        JsonUtils.convertValue(modifiedSettings.getConfigValue(), SearchSettings.class);

    assertEquals(true, modifiedSearchConfig.getGlobalSettings().getEnableAccessControl());
    assertEquals(5000, modifiedSearchConfig.getGlobalSettings().getMaxAggregateSize());
    assertEquals(
        30.0, // Now expecting 30.0 (10.0 + 20.0) as we're updating the existing field
        modifiedSearchConfig.getAssetTypeConfigurations().stream()
            .filter(conf -> "table".equalsIgnoreCase(conf.getAssetType()))
            .findFirst()
            .flatMap(
                conf ->
                    conf.getSearchFields().stream()
                        .filter(field -> "name".equals(field.getField()))
                        .findFirst()
                        .map(FieldBoost::getBoost))
            .orElse(null));

    resetSystemConfig();

    Settings resetSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings resetSearchConfig =
        JsonUtils.convertValue(resetSettings.getConfigValue(), SearchSettings.class);

    // Verify that the settings are reset to default values
    assertEquals(false, resetSearchConfig.getGlobalSettings().getEnableAccessControl());
    assertEquals(10000, resetSearchConfig.getGlobalSettings().getMaxAggregateSize());
    assertEquals(
        10.0,
        resetSearchConfig.getAssetTypeConfigurations().stream()
            .filter(conf -> "table".equalsIgnoreCase(conf.getAssetType()))
            .findFirst()
            .flatMap(
                conf ->
                    conf.getSearchFields().stream()
                        .filter(field -> "name".equals(field.getField()))
                        .findFirst()
                        .map(FieldBoost::getBoost))
            .orElse(null));
  }

  @Test
  void testGlobalSettingsModification() throws HttpResponseException {
    // Step 1: Retrieve current settings
    Settings searchSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings searchConfig =
        JsonUtils.convertValue(searchSettings.getConfigValue(), SearchSettings.class);
    SystemResource systemResource = new SystemResource(null);
    SearchSettings defaultSearchSettings = systemResource.readDefaultSearchSettings();

    // Step 2: Modify allowed fields in globalSettings
    searchConfig.getGlobalSettings().setMaxAggregateSize(5000);
    searchConfig.getGlobalSettings().setMaxResultHits(8000);
    searchConfig.getGlobalSettings().setMaxAnalyzedOffset(2000);

    // Modify restricted fields
    searchConfig
        .getGlobalSettings()
        .setAggregations(new ArrayList<>()); // Attempt to clear aggregations
    searchConfig.getGlobalSettings().setHighlightFields(List.of("modifiedField"));

    // Step 4: Save the updated settings
    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    updateSystemConfig(updatedSettings);

    // Step 5: Retrieve the settings after update
    Settings retrievedSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings updatedSearchConfig =
        JsonUtils.convertValue(retrievedSettings.getConfigValue(), SearchSettings.class);

    // Step 6: Verify that allowed fields have been updated
    assertEquals(5000, updatedSearchConfig.getGlobalSettings().getMaxAggregateSize());
    assertEquals(8000, updatedSearchConfig.getGlobalSettings().getMaxResultHits());
    assertEquals(2000, updatedSearchConfig.getGlobalSettings().getMaxAnalyzedOffset());

    // Step 7: Verify that restricted fields have not changed
    assertEquals(
        defaultSearchSettings.getGlobalSettings().getAggregations(),
        updatedSearchConfig.getGlobalSettings().getAggregations());
    assertEquals(
        defaultSearchSettings.getGlobalSettings().getHighlightFields(),
        updatedSearchConfig.getGlobalSettings().getHighlightFields());
  }

  @Test
  void testCannotDeleteAssetType() throws HttpResponseException {
    // Retrieve current settings
    Settings searchSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings searchConfig =
        JsonUtils.convertValue(searchSettings.getConfigValue(), SearchSettings.class);

    // Remove an asset type, e.g., 'table'
    searchConfig
        .getAssetTypeConfigurations()
        .removeIf(conf -> "table".equalsIgnoreCase(conf.getAssetType()));

    // Save the updated settings
    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    updateSystemConfig(updatedSettings);

    // Retrieve the settings after update
    Settings retrievedSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings updatedSearchConfig =
        JsonUtils.convertValue(retrievedSettings.getConfigValue(), SearchSettings.class);

    // Verify that 'table' asset type still exists
    boolean tableConfigExists =
        updatedSearchConfig.getAssetTypeConfigurations().stream()
            .anyMatch(conf -> "table".equalsIgnoreCase(conf.getAssetType()));
    assertTrue(tableConfigExists);
  }

  @Test
  void testCanAddNewAssetType() throws HttpResponseException {
    // Retrieve current settings
    Settings searchSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings searchConfig =
        JsonUtils.convertValue(searchSettings.getConfigValue(), SearchSettings.class);

    // Create a new asset type configuration
    AssetTypeConfiguration newAssetType =
        new AssetTypeConfiguration()
            .withAssetType("newAsset")
            .withSearchFields(new ArrayList<>())
            .withHighlightFields(Arrays.asList("name", "description"))
            .withAggregations(new ArrayList<>())
            .withTermBoosts(new ArrayList<>())
            .withScoreMode(AssetTypeConfiguration.ScoreMode.MULTIPLY)
            .withBoostMode(AssetTypeConfiguration.BoostMode.MULTIPLY);

    // Add the new asset type
    searchConfig.getAssetTypeConfigurations().add(newAssetType);

    // Save the updated settings
    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    updateSystemConfig(updatedSettings);

    // Retrieve the settings after update
    Settings retrievedSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings updatedSearchConfig =
        JsonUtils.convertValue(retrievedSettings.getConfigValue(), SearchSettings.class);

    // Verify that the new asset type is added
    boolean newAssetTypeExists =
        updatedSearchConfig.getAssetTypeConfigurations().stream()
            .anyMatch(conf -> "newAsset".equalsIgnoreCase(conf.getAssetType()));
    assertTrue(newAssetTypeExists);
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
    Settings updatedSettings = getSystemConfigAsUser();
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
    assertEquals(10, workflowSettings.getExecutorConfiguration().getCorePoolSize());
    assertEquals(1000, workflowSettings.getExecutorConfiguration().getQueueSize());
    assertEquals(20, workflowSettings.getExecutorConfiguration().getMaxPoolSize());
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
  void globalProfilerConfig() throws HttpResponseException {
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

  @Test
  void testSearchSettingsValidation() throws HttpResponseException {
    // Retrieve current settings
    Settings searchSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings searchConfig =
        JsonUtils.convertValue(searchSettings.getConfigValue(), SearchSettings.class);

    // Test maxAggregateSize validation
    searchConfig.getGlobalSettings().setMaxAggregateSize(50); // Below minimum
    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    try {
      updateSystemConfig(updatedSettings);
      fail("Expected HttpResponseException for invalid maxAggregateSize");
    } catch (HttpResponseException e) {
      assertTrue(e.getMessage().contains("maxAggregateSize must be between 100 and 10000"));
    }

    searchConfig.getGlobalSettings().setMaxAggregateSize(15000); // Above maximum
    updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    try {
      updateSystemConfig(updatedSettings);
      fail("Expected HttpResponseException for invalid maxAggregateSize");
    } catch (HttpResponseException e) {
      assertTrue(e.getMessage().contains("maxAggregateSize must be between 100 and 10000"));
    }

    // Test maxResultHits validation
    searchConfig.getGlobalSettings().setMaxAggregateSize(1000); // Reset to valid value
    searchConfig.getGlobalSettings().setMaxResultHits(50); // Below minimum
    updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    try {
      updateSystemConfig(updatedSettings);
      fail("Expected HttpResponseException for invalid maxResultHits");
    } catch (HttpResponseException e) {
      assertTrue(e.getMessage().contains("maxResultHits must be between 100 and 10000"));
    }

    // Test maxAnalyzedOffset validation
    searchConfig.getGlobalSettings().setMaxResultHits(1000); // Reset to valid value
    searchConfig.getGlobalSettings().setMaxAnalyzedOffset(500); // Below minimum
    updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    try {
      updateSystemConfig(updatedSettings);
      fail("Expected HttpResponseException for invalid maxAnalyzedOffset");
    } catch (HttpResponseException e) {
      assertTrue(e.getMessage().contains("maxAnalyzedOffset must be between 1000 and 1000000"));
    }

    // Test valid values
    searchConfig.getGlobalSettings().setMaxAggregateSize(5000);
    searchConfig.getGlobalSettings().setMaxResultHits(5000);
    searchConfig.getGlobalSettings().setMaxAnalyzedOffset(5000);
    updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    updateSystemConfig(updatedSettings);

    // Verify settings were updated
    Settings retrievedSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings updatedSearchConfig =
        JsonUtils.convertValue(retrievedSettings.getConfigValue(), SearchSettings.class);
    assertEquals(5000, updatedSearchConfig.getGlobalSettings().getMaxAggregateSize());
    assertEquals(5000, updatedSearchConfig.getGlobalSettings().getMaxResultHits());
    assertEquals(5000, updatedSearchConfig.getGlobalSettings().getMaxAnalyzedOffset());
  }

  @Test
  void testCacheInvalidation() throws HttpResponseException {
    // First, get the initial settings
    Settings searchSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings originalSearchConfig =
        JsonUtils.convertValue(searchSettings.getConfigValue(), SearchSettings.class);

    // Modify the settings
    originalSearchConfig.getGlobalSettings().setMaxAggregateSize(5000);
    Settings updatedSettings =
        new Settings()
            .withConfigType(SettingsType.SEARCH_SETTINGS)
            .withConfigValue(originalSearchConfig);

    // Update the settings
    updateSystemConfig(updatedSettings);

    // Get the settings directly from cache using SettingsCache
    SearchSettings cachedSettings =
        SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);

    // Verify that the cached value has been updated
    assertEquals(
        5000,
        cachedSettings.getGlobalSettings().getMaxAggregateSize(),
        "Cache should be invalidated and updated value should be fetched");
  }

  @Test
  void testTermBoostsAndFieldValueBoostsOverride() throws HttpResponseException {
    // Retrieve current settings
    Settings searchSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings searchConfig =
        JsonUtils.convertValue(searchSettings.getConfigValue(), SearchSettings.class);

    // Create new term boosts and field value boosts
    List<TermBoost> termBoosts = new ArrayList<>();
    termBoosts.add(
        new TermBoost().withField("custom_term").withValue("term_value").withBoost(15.0));

    List<FieldValueBoost> fieldValueBoosts = new ArrayList<>();
    fieldValueBoosts.add(new FieldValueBoost().withField("custom_field").withFactor(25.0));

    // Set the new boosts in the settings
    searchConfig.getGlobalSettings().setTermBoosts(termBoosts);
    searchConfig.getGlobalSettings().setFieldValueBoosts(fieldValueBoosts);

    // Update the settings
    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    updateSystemConfig(updatedSettings);

    // Retrieve the updated settings
    Settings retrievedSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings updatedSearchConfig =
        JsonUtils.convertValue(retrievedSettings.getConfigValue(), SearchSettings.class);

    // Verify that term boosts and field value boosts have been updated
    assertNotNull(updatedSearchConfig.getGlobalSettings().getTermBoosts());
    assertFalse(updatedSearchConfig.getGlobalSettings().getTermBoosts().isEmpty());
    assertEquals(1, updatedSearchConfig.getGlobalSettings().getTermBoosts().size());
    assertEquals(
        "custom_term", updatedSearchConfig.getGlobalSettings().getTermBoosts().get(0).getField());
    assertEquals(
        "term_value", updatedSearchConfig.getGlobalSettings().getTermBoosts().get(0).getValue());
    assertEquals(15.0, updatedSearchConfig.getGlobalSettings().getTermBoosts().get(0).getBoost());

    assertNotNull(updatedSearchConfig.getGlobalSettings().getFieldValueBoosts());
    assertFalse(updatedSearchConfig.getGlobalSettings().getFieldValueBoosts().isEmpty());
    assertEquals(1, updatedSearchConfig.getGlobalSettings().getFieldValueBoosts().size());
    assertEquals(
        "custom_field",
        updatedSearchConfig.getGlobalSettings().getFieldValueBoosts().get(0).getField());
    assertEquals(
        25.0, updatedSearchConfig.getGlobalSettings().getFieldValueBoosts().get(0).getFactor());
  }

  @Test
  void testDuplicateSearchFieldConfiguration() throws HttpResponseException {
    Settings searchSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings searchConfig =
        JsonUtils.convertValue(searchSettings.getConfigValue(), SearchSettings.class);

    AssetTypeConfiguration tableConfig =
        searchConfig.getAssetTypeConfigurations().stream()
            .filter(conf -> "table".equalsIgnoreCase(conf.getAssetType()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Table configuration not found"));

    tableConfig.getSearchFields().add(new FieldBoost().withField("name").withBoost(20.0));

    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);

    WebTarget target = getResource("system/settings");
    try {
      TestUtils.put(target, updatedSettings, Response.Status.OK, ADMIN_AUTH_HEADERS);
      fail("Expected HttpResponseException for duplicate field configuration");
    } catch (HttpResponseException e) {
      assertEquals(400, e.getStatusCode());
      assertTrue(
          e.getMessage()
              .contains(
                  "Duplicate field configuration found for field: name in asset type: table"));
    }
  }

  @Test
  void testAllowedFieldsCannotBeOverwritten() throws HttpResponseException {
    // Step 1: Retrieve the current search settings
    Settings searchSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings searchConfig =
        JsonUtils.convertValue(searchSettings.getConfigValue(), SearchSettings.class);

    // Store the original allowedFields configuration
    List<?> originalAllowedFields = searchConfig.getAllowedFields();
    assertNotNull(originalAllowedFields, "Original allowedFields should not be null");
    assertFalse(originalAllowedFields.isEmpty(), "Original allowedFields should not be empty");

    // Get the original size of the allowedFields for later comparison
    int originalSize = originalAllowedFields.size();

    // Step 2: Create a properly structured modified allowedFields list using AllowedSearchFields
    // class
    // First, create field entries for our test entity
    List<Field> fieldsList = new ArrayList<>();
    fieldsList.add(new Field().withName("test.field").withDescription("Test field description"));

    // Create our test AllowedSearchFields entity
    AllowedSearchFields testEntity =
        new AllowedSearchFields().withEntityType("test").withFields(fieldsList);

    // Create a list with just one AllowedSearchFields entry
    List<AllowedSearchFields> modifiedAllowedFields = new ArrayList<>();
    modifiedAllowedFields.add(testEntity);

    // Replace the original allowedFields with our modified version
    searchConfig.setAllowedFields(modifiedAllowedFields);

    // Step 3: Update the settings with the modified configuration
    Settings updatedSettings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchConfig);
    updateSystemConfig(updatedSettings);

    // Step 4: Retrieve the settings after update
    Settings retrievedSettings = getSystemConfig(SettingsType.SEARCH_SETTINGS);
    SearchSettings updatedSearchConfig =
        JsonUtils.convertValue(retrievedSettings.getConfigValue(), SearchSettings.class);

    // Step 5: Verify that allowedFields were not changed by the update
    List<AllowedSearchFields> retrievedAllowedFields = updatedSearchConfig.getAllowedFields();
    assertNotNull(retrievedAllowedFields, "Retrieved allowedFields should not be null");
    assertFalse(retrievedAllowedFields.isEmpty(), "Retrieved allowedFields should not be empty");

    // Verify the size remained the same
    assertEquals(
        originalSize, retrievedAllowedFields.size(), "The size of allowedFields should not change");

    // Verify that entity types in allowedFields remained the same (none is "test")
    Set<String> retrievedEntityTypes =
        retrievedAllowedFields.stream()
            .map(AllowedSearchFields::getEntityType)
            .collect(Collectors.toSet());

    // Verify that our test entity was not added
    assertFalse(
        retrievedEntityTypes.contains("test"),
        "The test entity type should not be added to allowedFields");
  }

  @Test
  void testAuthenticationConfiguration() throws HttpResponseException {
    // Get initial auth config
    AuthenticationConfiguration initialConfig = getAuthConfig();
    assertNotNull(initialConfig, "Initial auth config should not be null");

    // Create new OIDC config
    AuthenticationConfiguration newConfig = new AuthenticationConfiguration()
        .withProvider("google")
        .withOidcConfiguration(
            new OidcClientConfig()
                .withClientId("test-client-id")
                .withSecret("test-secret")
                .withTokenEndpoint("https://test.com/token"));

    // Update auth config
    Response response = updateAuthConfig(newConfig);
    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());

    // Verify config is updated
    AuthenticationConfiguration updatedConfig = getAuthConfig();
    assertEquals(newConfig.getProvider(), updatedConfig.getProvider());
    assertEquals(newConfig.getOidcConfiguration().getClientId(), 
                updatedConfig.getOidcConfiguration().getClientId());
    
    // Verify sensitive fields are encrypted
    assertNotEquals(newConfig.getOidcConfiguration().getSecret(),
                   updatedConfig.getOidcConfiguration().getSecret(),
                   "Secret should be encrypted");

    // Test SAML config
    AuthenticationConfiguration samlConfig = new AuthenticationConfiguration()
        .withProvider("saml")
        .withSamlConfiguration(
            new SamlSSOClientConfig()
                .withIdpCert("test-cert")
                .withSpPrivateKey("test-private-key")
                .withKeyStorePassword("test-password"));

    response = updateAuthConfig(samlConfig);
    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());

    // Verify SAML config
    AuthenticationConfiguration updatedSamlConfig = getAuthConfig();
    assertEquals(samlConfig.getProvider(), updatedSamlConfig.getProvider());
    assertNotEquals(samlConfig.getSamlConfiguration().getSpPrivateKey(),
                   updatedSamlConfig.getSamlConfiguration().getSpPrivateKey(),
                   "Private key should be encrypted");
    assertNotEquals(samlConfig.getSamlConfiguration().getKeyStorePassword(),
                   updatedSamlConfig.getSamlConfiguration().getKeyStorePassword(),
                   "Keystore password should be encrypted");

    // Restore initial config
    updateAuthConfig(initialConfig);
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

  private static Settings getSystemConfigAsUser() throws HttpResponseException {
    WebTarget target =
        getResource(String.format("system/settings/%s", SettingsType.LINEAGE_SETTINGS.value()));
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

  private void resetSystemConfig() throws HttpResponseException {
    WebTarget target = getResource("system/settings/reset/" + SettingsType.SEARCH_SETTINGS.value());
    TestUtils.put(target, Response.Status.OK, ADMIN_AUTH_HEADERS);
  }

  private AuthenticationConfiguration getAuthConfig() throws HttpResponseException {
    WebTarget target = getResource("system/auth/config");
    return TestUtils.get(target, AuthenticationConfiguration.class, ADMIN_AUTH_HEADERS);
  }

  private Response updateAuthConfig(AuthenticationConfiguration config) throws HttpResponseException {
    WebTarget target = getResource("system/auth/config");
    return TestUtils.put(target, config, Response.class, ADMIN_AUTH_HEADERS);
  }
}
