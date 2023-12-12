package org.openmetadata.service.resources.system;

import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.ConfigurationException;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.validation.Validators;
import java.io.IOException;
import java.net.URISyntaxException;
import javax.validation.Validator;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.api.configuration.LogoConfiguration;
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
import org.openmetadata.schema.security.client.GoogleSSOClientConfig;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
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
    YamlConfigurationFactory<OpenMetadataApplicationConfig> factory = new YamlConfigurationFactory<>(
      OpenMetadataApplicationConfig.class,
      validator,
      objectMapper,
      "dw"
    );
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
    CreateMessagingService createMessagingService = messagingServiceResourceTest.createRequest(test);
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
    Assertions.assertEquals(beforeCount.getDashboardCount() + 1, afterCount.getDashboardCount());
    Assertions.assertEquals(beforeCount.getPipelineCount() + 1, afterCount.getPipelineCount());
    Assertions.assertEquals(beforeCount.getServicesCount() + 1, afterCount.getServicesCount());
    Assertions.assertEquals(beforeCount.getUserCount() + 1, afterCount.getUserCount());
    Assertions.assertEquals(beforeCount.getTableCount() + 1, afterCount.getTableCount());
    Assertions.assertEquals(beforeCount.getTeamCount() + 1, afterCount.getTeamCount());
    Assertions.assertEquals(beforeCount.getTopicCount() + 1, afterCount.getTopicCount());
    Assertions.assertEquals(beforeCount.getTestSuiteCount() + 1, afterCount.getTestSuiteCount());
    Assertions.assertEquals(beforeCount.getStorageContainerCount() + 1, afterCount.getStorageContainerCount());
    Assertions.assertEquals(beforeCount.getGlossaryCount() + 1, afterCount.getGlossaryCount());
    Assertions.assertEquals(beforeCount.getGlossaryTermCount() + 1, afterCount.getGlossaryTermCount());
  }

  @Test
  @Order(1)
  void testSystemConfigs() throws HttpResponseException {
    // Test Email Config
    Settings emailSettings = getSystemConfig(SettingsType.EMAIL_CONFIGURATION);
    SmtpSettings smtp = JsonUtils.convertValue(emailSettings.getConfigValue(), SmtpSettings.class);
    // Password for Email is always sent in hidden
    SmtpSettings expected = config.getSmtpSettings();
    expected.setPassword("***********");
    Assertions.assertEquals(expected, smtp);

    // Test Custom Log Config
    Settings logoConfigWrapped = getSystemConfig(SettingsType.CUSTOM_LOGO_CONFIGURATION);
    LogoConfiguration loginConfiguration = JsonUtils.convertValue(
      logoConfigWrapped.getConfigValue(),
      LogoConfiguration.class
    );

    // Defaults
    Assertions.assertEquals("", loginConfiguration.getCustomLogoUrlPath());
    Assertions.assertEquals("", loginConfiguration.getCustomMonogramUrlPath());
  }

  @Test
  void testSystemConfigsUpdate(TestInfo test) throws HttpResponseException {
    // Test Email Config
    SmtpSettings smtpSettings = config.getSmtpSettings();
    // Update a few Email fields
    smtpSettings.setUsername(test.getDisplayName());
    smtpSettings.setEmailingEntity(test.getDisplayName());

    updateSystemConfig(new Settings().withConfigType(SettingsType.EMAIL_CONFIGURATION).withConfigValue(smtpSettings));
    SmtpSettings updateEmailSettings = JsonUtils.convertValue(
      getSystemConfig(SettingsType.EMAIL_CONFIGURATION).getConfigValue(),
      SmtpSettings.class
    );
    Assertions.assertEquals(updateEmailSettings.getUsername(), test.getDisplayName());
    Assertions.assertEquals(updateEmailSettings.getEmailingEntity(), test.getDisplayName());

    // Test Custom Logo Update
    LogoConfiguration updateConfigReq = new LogoConfiguration()
      .withCustomLogoUrlPath("http://test.com")
      .withCustomMonogramUrlPath("http://test.com");
    // Update Custom Logo Settings
    updateSystemConfig(
      new Settings().withConfigType(SettingsType.CUSTOM_LOGO_CONFIGURATION).withConfigValue(updateConfigReq)
    );
    LogoConfiguration updatedConfig = JsonUtils.convertValue(
      getSystemConfig(SettingsType.CUSTOM_LOGO_CONFIGURATION).getConfigValue(),
      LogoConfiguration.class
    );
    Assertions.assertEquals(updateConfigReq, updatedConfig);
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
    CreateMessagingService createMessagingService = messagingServiceResourceTest.createRequest(test);
    messagingServiceResourceTest.createEntity(createMessagingService, ADMIN_AUTH_HEADERS);

    // Create Dashboard Service
    DashboardServiceResourceTest dashboardServiceResourceTest = new DashboardServiceResourceTest();
    CreateDashboardService createDashboardService = dashboardServiceResourceTest.createRequest(test);
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
    Assertions.assertEquals(beforeCount.getMessagingServiceCount() + 1, afterCount.getMessagingServiceCount());
    Assertions.assertEquals(beforeCount.getDashboardServiceCount() + 1, afterCount.getDashboardServiceCount());
    Assertions.assertEquals(beforeCount.getPipelineServiceCount() + 1, afterCount.getPipelineServiceCount());
    Assertions.assertEquals(beforeCount.getMlModelServiceCount() + 1, afterCount.getMlModelServiceCount());
    Assertions.assertEquals(beforeCount.getStorageServiceCount() + 1, afterCount.getStorageServiceCount());
  }

  @Test
  void botUserCountCheck(TestInfo test) throws HttpResponseException {
    int beforeUserCount = getEntitiesCount().getUserCount();

    // Create a bot user.
    UserResourceTest userResourceTest = new UserResourceTest();
    CreateUser createUser = userResourceTest
      .createRequest(test)
      .withIsBot(true)
      .withAuthenticationMechanism(
        new AuthenticationMechanism()
          .withAuthType(AuthenticationMechanism.AuthType.SSO)
          .withConfig(
            new SSOAuthMechanism()
              .withSsoServiceType(SSOAuthMechanism.SsoServiceType.GOOGLE)
              .withAuthConfig(new GoogleSSOClientConfig().withSecretKey("/fake/path/secret.json"))
          )
      );
    userResourceTest.createEntity(createUser, ADMIN_AUTH_HEADERS);

    int afterUserCount = getEntitiesCount().getUserCount();

    // The bot user count should not be considered.
    Assertions.assertEquals(beforeUserCount, afterUserCount);
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

  private static void updateSystemConfig(Settings updatedSetting) throws HttpResponseException {
    WebTarget target = getResource("system/settings");
    TestUtils.put(target, updatedSetting, Response.Status.OK, ADMIN_AUTH_HEADERS);
  }
}
