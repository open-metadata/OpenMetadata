package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.apps.bundles.insights.DataInsightsApp.getDataStreamName;

import jakarta.json.JsonPatch;
import jakarta.json.JsonValue;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.api.configuration.UiThemePreference;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.configuration.AssetCertificationSettings;
import org.openmetadata.schema.configuration.ExecutorConfiguration;
import org.openmetadata.schema.configuration.HistoryCleanUpConfiguration;
import org.openmetadata.schema.configuration.WorkflowSettings;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.scim.ScimConfiguration;
import org.openmetadata.schema.service.configuration.slackApp.SlackAppConfiguration;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.system.StepValidation;
import org.openmetadata.schema.system.ValidationResponse;
import org.openmetadata.schema.util.EntitiesCount;
import org.openmetadata.schema.util.ServicesCount;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.LoginAttemptCache;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Slf4j
@Repository
public class SystemRepository {
  private static final String FAILED_TO_UPDATE_SETTINGS = "Failed to Update Settings";
  public static final String INTERNAL_SERVER_ERROR_WITH_REASON = "Internal Server Error. Reason :";
  private final SystemDAO dao;
  private final MigrationValidationClient migrationValidationClient;

  private enum ValidationStepDescription {
    DATABASE("Validate that we can properly run a query against the configured database."),
    SEARCH("Validate that the search client is available."),
    PIPELINE_SERVICE_CLIENT("Validate that the pipeline service client is available."),
    JWT_TOKEN("Validate that the ingestion-bot JWT token can be properly decoded."),
    MIGRATION("Validate that all the necessary migrations have been properly executed.");

    public final String key;

    ValidationStepDescription(String param) {
      this.key = param;
    }
  }

  private static final String INDEX_NAME = "table_search_index";

  public SystemRepository() {
    this.dao = Entity.getCollectionDAO().systemDAO();
    Entity.setSystemRepository(this);
    migrationValidationClient = MigrationValidationClient.getInstance();
  }

  public EntitiesCount getAllEntitiesCount(ListFilter filter) {
    return dao.getAggregatedEntitiesCount(filter.getCondition());
  }

  public ServicesCount getAllServicesCount(ListFilter filter) {
    return dao.getAggregatedServicesCount(filter.getCondition());
  }

  public ResultList<Settings> listAllConfigs() {
    List<Settings> settingsList = null;
    try {
      settingsList = dao.getAllConfig();
    } catch (Exception ex) {
      LOG.error("Error while trying fetch all Settings " + ex.getMessage());
    }
    int count = 0;
    if (settingsList != null) {
      count = settingsList.size();
    }
    return new ResultList<>(settingsList, null, null, count);
  }

  public Settings getConfigWithKey(String key) {
    try {
      Settings fetchedSettings = dao.getConfigWithKey(key);
      if (fetchedSettings == null) {
        return null;
      }

      if (fetchedSettings.getConfigType() == SettingsType.EMAIL_CONFIGURATION) {
        SmtpSettings emailConfig = (SmtpSettings) fetchedSettings.getConfigValue();
        if (!nullOrEmpty(emailConfig.getPassword())) {
          emailConfig.setPassword(PasswordEntityMasker.PASSWORD_MASK);
        }
        fetchedSettings.setConfigValue(emailConfig);
      }

      return fetchedSettings;
    } catch (Exception ex) {
      LOG.error("Error while trying fetch Settings ", ex);
    }
    return null;
  }

  public AssetCertificationSettings getAssetCertificationSettings() {
    Optional<Settings> oAssetCertificationSettings =
        Optional.ofNullable(getConfigWithKey(SettingsType.ASSET_CERTIFICATION_SETTINGS.value()));

    return oAssetCertificationSettings
        .map(settings -> (AssetCertificationSettings) settings.getConfigValue())
        .orElse(null);
  }

  public AssetCertificationSettings getAssetCertificationSettingOrDefault() {
    AssetCertificationSettings assetCertificationSettings = getAssetCertificationSettings();
    if (assetCertificationSettings == null) {
      assetCertificationSettings =
          new AssetCertificationSettings()
              .withAllowedClassification("Certification")
              .withValidityPeriod("P30D");
    }
    return assetCertificationSettings;
  }

  public WorkflowSettings getWorkflowSettings() {
    Optional<Settings> oWorkflowSettings =
        Optional.ofNullable(getConfigWithKey(SettingsType.WORKFLOW_SETTINGS.value()));

    return oWorkflowSettings
        .map(settings -> (WorkflowSettings) settings.getConfigValue())
        .orElse(null);
  }

  public WorkflowSettings getWorkflowSettingsOrDefault() {
    WorkflowSettings workflowSettings = getWorkflowSettings();
    if (workflowSettings == null) {
      workflowSettings =
          new WorkflowSettings()
              .withExecutorConfiguration(new ExecutorConfiguration())
              .withHistoryCleanUpConfiguration(new HistoryCleanUpConfiguration());
    }
    return workflowSettings;
  }

  public Settings getEmailConfigInternal() {
    try {
      Settings setting = dao.getConfigWithKey(SettingsType.EMAIL_CONFIGURATION.value());
      SmtpSettings emailConfig =
          SystemRepository.decryptEmailSetting((SmtpSettings) setting.getConfigValue());
      setting.setConfigValue(emailConfig);
      return setting;
    } catch (Exception ex) {
      LOG.error("Error while trying fetch EMAIL Settings " + ex.getMessage());
    }
    return null;
  }

  public Settings getOMBaseUrlConfigInternal() {
    try {
      Settings setting =
          dao.getConfigWithKey(SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION.value());
      OpenMetadataBaseUrlConfiguration urlConfiguration =
          (OpenMetadataBaseUrlConfiguration) setting.getConfigValue();
      setting.setConfigValue(urlConfiguration);
      return setting;
    } catch (Exception ex) {
      LOG.error(
          "Error while trying to fetch OpenMetadataBaseUrlConfiguration Settings {}",
          ex.getMessage());
    }
    return null;
  }

  public Settings getSlackApplicationConfigInternal() {
    try {
      Settings setting = dao.getConfigWithKey(SettingsType.SLACK_APP_CONFIGURATION.value());
      SlackAppConfiguration slackAppConfiguration =
          SystemRepository.decryptSlackAppSetting((String) setting.getConfigValue());
      setting.setConfigValue(slackAppConfiguration);
      return setting;
    } catch (Exception ex) {
      LOG.error("Error while trying fetch Slack Settings " + ex.getMessage());
    }
    return null;
  }

  @Transaction
  public Response createOrUpdate(Settings setting) {
    Settings oldValue = getConfigWithKey(setting.getConfigType().toString());

    if (oldValue != null && oldValue.getConfigType().equals(SettingsType.EMAIL_CONFIGURATION)) {
      SmtpSettings configValue =
          JsonUtils.convertValue(oldValue.getConfigValue(), SmtpSettings.class);
      if (configValue != null) {
        SmtpSettings.Templates templates = configValue.getTemplates();
        SmtpSettings newConfigValue =
            JsonUtils.convertValue(setting.getConfigValue(), SmtpSettings.class);
        if (newConfigValue != null) {
          newConfigValue.setTemplates(templates);
          setting.setConfigValue(newConfigValue);
        }
      }
    }

    try {
      updateSetting(setting);
    } catch (Exception ex) {
      LOG.error(FAILED_TO_UPDATE_SETTINGS + ex.getMessage());
      return Response.status(500, INTERNAL_SERVER_ERROR_WITH_REASON + ex.getMessage()).build();
    }
    if (oldValue == null) {
      return (new RestUtil.PutResponse<>(Response.Status.CREATED, setting, ENTITY_CREATED))
          .toResponse();
    } else {
      return (new RestUtil.PutResponse<>(Response.Status.OK, setting, ENTITY_UPDATED)).toResponse();
    }
  }

  public Response createNewSetting(Settings setting) {
    try {
      updateSetting(setting);
    } catch (Exception ex) {
      LOG.error(FAILED_TO_UPDATE_SETTINGS + ex.getMessage());
      return Response.status(500, INTERNAL_SERVER_ERROR_WITH_REASON + ex.getMessage()).build();
    }
    return (new RestUtil.PutResponse<>(Response.Status.CREATED, setting, ENTITY_CREATED))
        .toResponse();
  }

  @SuppressWarnings("unused")
  public Response deleteSettings(SettingsType type) {
    Settings oldValue = getConfigWithKey(type.toString());
    dao.delete(type.value());
    return (new RestUtil.DeleteResponse<>(oldValue, ENTITY_DELETED)).toResponse();
  }

  public Response patchSetting(String settingName, JsonPatch patch) {
    Settings original = getConfigWithKey(settingName);
    // Apply JSON patch to the original entity to get the updated entity
    JsonValue updated = JsonUtils.applyPatch(original.getConfigValue(), patch);
    original.setConfigValue(updated);
    try {
      updateSetting(original);
    } catch (Exception ex) {
      LOG.error(FAILED_TO_UPDATE_SETTINGS + ex.getMessage());
      return Response.status(500, INTERNAL_SERVER_ERROR_WITH_REASON + ex.getMessage()).build();
    }
    return (new RestUtil.PutResponse<>(Response.Status.OK, original, ENTITY_UPDATED)).toResponse();
  }

  private void postUpdate(SettingsType settingsType) {
    if (settingsType == SettingsType.WORKFLOW_SETTINGS) {
      WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
      workflowHandler.initializeNewProcessEngine(workflowHandler.getProcessEngineConfiguration());
    }

    if (settingsType == SettingsType.LOGIN_CONFIGURATION) {
      LoginAttemptCache.updateLoginConfiguration();
    }
  }

  public void updateSetting(Settings setting) {
    try {
      if (setting.getConfigType() == SettingsType.EMAIL_CONFIGURATION) {
        SmtpSettings emailConfig =
            JsonUtils.convertValue(setting.getConfigValue(), SmtpSettings.class);
        if (!nullOrEmpty(emailConfig.getPassword())) {
          setting.setConfigValue(encryptEmailSetting(emailConfig));
        }
      } else if (setting.getConfigType() == SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION) {
        OpenMetadataBaseUrlConfiguration omBaseUrl =
            JsonUtils.convertValue(
                setting.getConfigValue(), OpenMetadataBaseUrlConfiguration.class);
        setting.setConfigValue(omBaseUrl);
      } else if (setting.getConfigType() == SettingsType.SLACK_APP_CONFIGURATION) {
        SlackAppConfiguration appConfiguration =
            JsonUtils.convertValue(setting.getConfigValue(), SlackAppConfiguration.class);
        setting.setConfigValue(encryptSlackAppSetting(appConfiguration));
      } else if (setting.getConfigType() == SettingsType.SLACK_BOT) {
        String appConfiguration = JsonUtils.convertValue(setting.getConfigValue(), String.class);
        setting.setConfigValue(encryptSlackDefaultBotSetting(appConfiguration));
      } else if (setting.getConfigType() == SettingsType.SLACK_INSTALLER) {
        String appConfiguration = JsonUtils.convertValue(setting.getConfigValue(), String.class);
        setting.setConfigValue(encryptSlackDefaultInstallerSetting(appConfiguration));
      } else if (setting.getConfigType() == SettingsType.SLACK_STATE) {
        String slackState = JsonUtils.convertValue(setting.getConfigValue(), String.class);
        setting.setConfigValue(encryptSlackStateSetting(slackState));
      } else if (setting.getConfigType() == SettingsType.CUSTOM_UI_THEME_PREFERENCE) {
        JsonUtils.validateJsonSchema(setting.getConfigValue(), UiThemePreference.class);
      } else if (setting.getConfigType() == SettingsType.SEARCH_SETTINGS) {
        JsonUtils.validateJsonSchema(setting.getConfigValue(), SearchSettings.class);
      } else if (setting.getConfigType() == SettingsType.SCIM_CONFIGURATION) {
        JsonUtils.validateJsonSchema(setting.getConfigValue(), ScimConfiguration.class);
      } else if (setting.getConfigType() == SettingsType.AUTHENTICATION_CONFIGURATION) {
        AuthenticationConfiguration authConfig =
            JsonUtils.convertValue(setting.getConfigValue(), AuthenticationConfiguration.class);
        //       JsonUtils.validateJsonSchema(authConfig, AuthenticationConfiguration.class);
        //        validateAuthenticationConfiguration(authConfig);
        setting.setConfigValue(authConfig);
      } else if (setting.getConfigType() == SettingsType.AUTHORIZER_CONFIGURATION) {
        AuthorizerConfiguration authorizerConfig =
            JsonUtils.convertValue(setting.getConfigValue(), AuthorizerConfiguration.class);
        JsonUtils.validateJsonSchema(authorizerConfig, AuthorizerConfiguration.class);
        setting.setConfigValue(authorizerConfig);
      }
      dao.insertSettings(
          setting.getConfigType().toString(), JsonUtils.pojoToJson(setting.getConfigValue()));
      // Invalidate Cache
      SettingsCache.invalidateSettings(setting.getConfigType().value());
      postUpdate(setting.getConfigType());
    } catch (Exception ex) {
      LOG.error("Failing in Updating Setting.", ex);
      throw new CustomExceptionMessage(
          Response.Status.INTERNAL_SERVER_ERROR,
          "FAILED_TO_UPDATE_SLACK_OR_EMAIL",
          ex.getMessage());
    }
  }

  public Settings getSlackbotConfigInternal() {
    try {
      Settings setting = dao.getConfigWithKey(SettingsType.SLACK_BOT.value());
      String slackBotConfiguration =
          SystemRepository.decryptSlackDefaultBotSetting((String) setting.getConfigValue());
      setting.setConfigValue(slackBotConfiguration);
      return setting;
    } catch (Exception ex) {
      LOG.error("Error while trying fetch Slack bot Settings " + ex.getMessage());
    }
    return null;
  }

  public Settings getSlackInstallerConfigInternal() {
    try {
      Settings setting = dao.getConfigWithKey(SettingsType.SLACK_INSTALLER.value());
      String slackInstallerConfiguration =
          SystemRepository.decryptSlackDefaultInstallerSetting((String) setting.getConfigValue());
      setting.setConfigValue(slackInstallerConfiguration);
      return setting;
    } catch (Exception ex) {
      LOG.error("Error while trying to fetch slack installer setting " + ex.getMessage());
    }
    return null;
  }

  public Settings getSlackStateConfigInternal() {
    try {
      Settings setting = dao.getConfigWithKey(SettingsType.SLACK_STATE.value());
      String slackStateConfiguration =
          SystemRepository.decryptSlackStateSetting((String) setting.getConfigValue());
      setting.setConfigValue(slackStateConfiguration);
      return setting;
    } catch (Exception ex) {
      LOG.error("Error while trying to fetch slack state setting " + ex.getMessage());
    }
    return null;
  }

  @SneakyThrows
  public static String encryptSlackDefaultBotSetting(String decryptedSetting) {
    String json = JsonUtils.pojoToJson(decryptedSetting);
    if (Fernet.getInstance().isKeyDefined()) {
      return Fernet.getInstance().encryptIfApplies(json);
    }
    return json;
  }

  @SneakyThrows
  public static String decryptSlackDefaultBotSetting(String encryptedSetting) {
    if (Fernet.getInstance().isKeyDefined()) {
      encryptedSetting = Fernet.getInstance().decryptIfApplies(encryptedSetting);
    }
    return JsonUtils.readValue(encryptedSetting, String.class);
  }

  @SneakyThrows
  public static String encryptSlackDefaultInstallerSetting(String decryptedSetting) {
    String json = JsonUtils.pojoToJson(decryptedSetting);
    if (Fernet.getInstance().isKeyDefined()) {
      return Fernet.getInstance().encryptIfApplies(json);
    }
    return json;
  }

  @SneakyThrows
  public static String decryptSlackDefaultInstallerSetting(String encryptedSetting) {
    if (Fernet.getInstance().isKeyDefined()) {
      encryptedSetting = Fernet.getInstance().decryptIfApplies(encryptedSetting);
    }
    return JsonUtils.readValue(encryptedSetting, String.class);
  }

  @SneakyThrows
  public static String encryptSlackStateSetting(String decryptedSetting) {
    String json = JsonUtils.pojoToJson(decryptedSetting);
    if (Fernet.getInstance().isKeyDefined()) {
      return Fernet.getInstance().encryptIfApplies(json);
    }
    return json;
  }

  @SneakyThrows
  public static String decryptSlackStateSetting(String encryptedSetting) {
    if (Fernet.getInstance().isKeyDefined()) {
      encryptedSetting = Fernet.getInstance().decryptIfApplies(encryptedSetting);
    }
    return JsonUtils.readValue(encryptedSetting, String.class);
  }

  public static SmtpSettings encryptEmailSetting(SmtpSettings decryptedSetting) {
    if (Fernet.getInstance().isKeyDefined()) {
      String encryptedPwd = Fernet.getInstance().encryptIfApplies(decryptedSetting.getPassword());
      return decryptedSetting.withPassword(encryptedPwd);
    }
    return decryptedSetting;
  }

  public static SmtpSettings decryptEmailSetting(SmtpSettings encryptedSetting) {
    if (Fernet.getInstance().isKeyDefined() && Fernet.isTokenized(encryptedSetting.getPassword())) {
      String decryptedPassword = Fernet.getInstance().decrypt(encryptedSetting.getPassword());
      return encryptedSetting.withPassword(decryptedPassword);
    }
    return encryptedSetting;
  }

  @SneakyThrows
  public static String encryptSlackAppSetting(SlackAppConfiguration decryptedSetting) {
    String json = JsonUtils.pojoToJson(decryptedSetting);
    if (Fernet.getInstance().isKeyDefined()) {
      return Fernet.getInstance().encryptIfApplies(json);
    }
    return json;
  }

  @SneakyThrows
  public static SlackAppConfiguration decryptSlackAppSetting(String encryptedSetting) {
    if (Fernet.getInstance().isKeyDefined()) {
      encryptedSetting = Fernet.getInstance().decryptIfApplies(encryptedSetting);
    }
    return JsonUtils.readValue(encryptedSetting, SlackAppConfiguration.class);
  }

  public ValidationResponse validateSystem(
      OpenMetadataApplicationConfig applicationConfig,
      PipelineServiceClientInterface pipelineServiceClient,
      JwtFilter jwtFilter) {
    ValidationResponse validation = new ValidationResponse();

    validation.setDatabase(getDatabaseValidation(applicationConfig));
    validation.setSearchInstance(getSearchValidation(applicationConfig));
    validation.setPipelineServiceClient(
        getPipelineServiceClientValidation(applicationConfig, pipelineServiceClient));
    validation.setJwks(getJWKsValidation(applicationConfig, jwtFilter));
    validation.setMigrations(getMigrationValidation(migrationValidationClient));

    return validation;
  }

  private StepValidation getDatabaseValidation(OpenMetadataApplicationConfig applicationConfig) {
    try {
      dao.testConnection();
      return new StepValidation()
          .withDescription(ValidationStepDescription.DATABASE.key)
          .withPassed(Boolean.TRUE)
          .withMessage(
              String.format("Connected to %s", applicationConfig.getDataSourceFactory().getUrl()));
    } catch (Exception exc) {
      return new StepValidation()
          .withDescription(ValidationStepDescription.DATABASE.key)
          .withPassed(Boolean.FALSE)
          .withMessage(exc.getMessage());
    }
  }

  private StepValidation getSearchValidation(OpenMetadataApplicationConfig applicationConfig) {
    SearchRepository searchRepository = Entity.getSearchRepository();
    if (Boolean.TRUE.equals(searchRepository.getSearchClient().isClientAvailable())
        && searchRepository
            .getSearchClient()
            .indexExists(Entity.getSearchRepository().getIndexOrAliasName(INDEX_NAME))) {
      if (validateDataInsights()) {
        return new StepValidation()
            .withDescription(ValidationStepDescription.SEARCH.key)
            .withPassed(Boolean.TRUE)
            .withMessage(
                String.format(
                    "Connected to %s",
                    applicationConfig.getElasticSearchConfiguration().getHost()));
      } else {
        return new StepValidation()
            .withDescription(ValidationStepDescription.SEARCH.key)
            .withPassed(Boolean.FALSE)
            .withMessage(
                "Data Insights Application is Installed but it is not reachable or available");
      }
    } else {
      return new StepValidation()
          .withDescription(ValidationStepDescription.SEARCH.key)
          .withPassed(Boolean.FALSE)
          .withMessage("Search instance is not reachable or available");
    }
  }

  private boolean validateDataInsights() {
    boolean isValid = false;

    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    try {
      App dataInsightsApp =
          appRepository.getByName(null, "DataInsightsApplication", EntityUtil.Fields.EMPTY_FIELDS);

      SearchRepository searchRepository = Entity.getSearchRepository();
      String dataStreamName = getDataStreamName(searchRepository.getClusterAlias(), Entity.TABLE);

      if (Boolean.TRUE.equals(searchRepository.getSearchClient().isClientAvailable())
          && searchRepository.getSearchClient().indexExists(dataStreamName)) {
        isValid = true;
      }
    } catch (EntityNotFoundException e) {
      isValid = true;
      LOG.info("Data Insights Application is not installed. Skip Validation.");
    }
    return isValid;
  }

  private StepValidation getPipelineServiceClientValidation(
      OpenMetadataApplicationConfig applicationConfig,
      PipelineServiceClientInterface pipelineServiceClient) {
    if (pipelineServiceClient != null) {
      PipelineServiceClientResponse pipelineResponse = pipelineServiceClient.getServiceStatus();
      if (pipelineResponse.getCode() == 200) {
        return new StepValidation()
            .withDescription(ValidationStepDescription.PIPELINE_SERVICE_CLIENT.key)
            .withPassed(Boolean.TRUE)
            .withMessage(
                String.format(
                    "%s is available at %s",
                    pipelineServiceClient.getPlatform(),
                    applicationConfig.getPipelineServiceClientConfiguration().getApiEndpoint()));
      } else {
        return new StepValidation()
            .withDescription(ValidationStepDescription.PIPELINE_SERVICE_CLIENT.key)
            .withPassed(Boolean.FALSE)
            .withMessage(pipelineResponse.getReason());
      }
    }
    return new StepValidation()
        .withDescription(ValidationStepDescription.PIPELINE_SERVICE_CLIENT.key)
        .withPassed(Boolean.FALSE)
        .withMessage("Pipeline client disabled, please check configuration");
  }

  private StepValidation getJWKsValidation(
      OpenMetadataApplicationConfig applicationConfig, JwtFilter jwtFilter) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(applicationConfig).build();
    OpenMetadataJWTClientConfig realJWTConfig =
        secretsManager.decryptJWTConfig(openMetadataServerConnection.getSecurityConfig());
    try {
      jwtFilter.validateJwtAndGetClaims(realJWTConfig.getJwtToken());
      return new StepValidation()
          .withDescription(ValidationStepDescription.JWT_TOKEN.key)
          .withPassed(Boolean.TRUE)
          .withMessage("Ingestion Bot token has been validated");
    } catch (Exception e) {
      return new StepValidation()
          .withDescription(ValidationStepDescription.JWT_TOKEN.key)
          .withPassed(Boolean.FALSE)
          .withMessage(e.getMessage());
    }
  }

  private StepValidation getMigrationValidation(
      MigrationValidationClient migrationValidationClient) {
    List<String> currentVersions = migrationValidationClient.getCurrentVersions();
    // Compare regardless of ordering
    if (new HashSet<>(currentVersions)
        .equals(new HashSet<>(migrationValidationClient.getExpectedMigrationList()))) {
      return new StepValidation()
          .withDescription(ValidationStepDescription.MIGRATION.key)
          .withPassed(Boolean.TRUE)
          .withMessage(String.format("Executed migrations: %s", currentVersions));
    }
    List<String> missingVersions =
        new ArrayList<>(migrationValidationClient.getExpectedMigrationList());
    missingVersions.removeAll(currentVersions);

    List<String> unexpectedVersions = new ArrayList<>(currentVersions);
    unexpectedVersions.removeAll(migrationValidationClient.getExpectedMigrationList());

    return new StepValidation()
        .withDescription(ValidationStepDescription.MIGRATION.key)
        .withPassed(Boolean.FALSE)
        .withMessage(
            String.format(
                "Missing migrations that were not executed %s. Unexpected executed migrations %s",
                missingVersions, unexpectedVersions));
  }

  private void validateAuthenticationConfiguration(AuthenticationConfiguration authConfig) {
    if (authConfig == null) {
      throw new IllegalArgumentException("Authentication configuration cannot be null");
    }

    try {
      // Validate provider-specific configuration only if that provider is selected
      if (authConfig.getProvider() != null) {
        switch (authConfig.getProvider()) {
          case LDAP -> {
            if (authConfig.getLdapConfiguration() != null) {
              LOG.info("Validating LDAP configuration since provider is LDAP");
              JsonUtils.validateJsonSchema(
                  authConfig.getLdapConfiguration(),
                  org.openmetadata.schema.auth.LdapConfiguration.class);
            } else {
              LOG.warn("LDAP provider selected but no LDAP configuration provided");
            }
          }
          case SAML -> {
            if (authConfig.getSamlConfiguration() != null) {
              LOG.info("Validating SAML configuration since provider is SAML");
              JsonUtils.validateJsonSchema(
                  authConfig.getSamlConfiguration(),
                  org.openmetadata.catalog.security.client.SamlSSOClientConfig.class);
            } else {
              LOG.warn("SAML provider selected but no SAML configuration provided");
            }
          }
          case CUSTOM_OIDC -> {
            if (authConfig.getOidcConfiguration() != null) {
              LOG.info("Validating OIDC configuration since provider is OIDC");
              JsonUtils.validateJsonSchema(
                  authConfig.getOidcConfiguration(),
                  org.openmetadata.schema.security.client.OidcClientConfig.class);
            } else {
              LOG.warn("OIDC provider selected but no OIDC configuration provided");
            }
          }
          default -> {
            LOG.info(
                "Provider {} requires no specific configuration validation",
                authConfig.getProvider());
          }
        }
      }

      // Validate base authentication configuration fields
      validateBaseAuthConfiguration(authConfig);

      LOG.info(
          "Successfully validated authentication configuration for provider: {}",
          authConfig.getProvider());

    } catch (Exception e) {
      LOG.error(
          "Failed to validate authentication configuration for provider: {}",
          authConfig.getProvider(),
          e);
      throw e;
    }
  }

  private void validateBaseAuthConfiguration(AuthenticationConfiguration authConfig) {
    // Always validate provider and providerName
    if (authConfig.getProvider() == null) {
      throw new IllegalArgumentException("Authentication provider is required");
    }
    if (authConfig.getProviderName() == null || authConfig.getProviderName().trim().isEmpty()) {
      throw new IllegalArgumentException("Provider name is required");
    }

    // Validate fields based on provider type
    switch (authConfig.getProvider()) {
      case SAML -> validateSamlRequiredFields(authConfig);
      case CUSTOM_OIDC -> validateOidcRequiredFields(authConfig);
      case BASIC -> validateBasicRequiredFields(authConfig);
      case LDAP -> validateLdapRequiredFields(authConfig);
      default -> {
        // For other providers (GOOGLE, OKTA, AUTH_0, etc.), validate minimal fields
        LOG.info("Using minimal validation for provider: {}", authConfig.getProvider());
        if (authConfig.getJwtPrincipalClaims() == null
            || authConfig.getJwtPrincipalClaims().isEmpty()) {
          throw new IllegalArgumentException("JWT principal claims are required");
        }
      }
    }
  }

  private void validateSamlRequiredFields(AuthenticationConfiguration authConfig) {
    LOG.info("Validating SAML-specific required fields");
    // SAML only needs JWT principal claims from base config
    // All other fields come from samlConfiguration
    if (authConfig.getJwtPrincipalClaims() == null
        || authConfig.getJwtPrincipalClaims().isEmpty()) {
      throw new IllegalArgumentException("JWT principal claims are required for SAML");
    }
  }

  private void validateOidcRequiredFields(AuthenticationConfiguration authConfig) {
    LOG.info("Validating OIDC-specific required fields");
    // OIDC needs all the traditional OAuth fields
    if (authConfig.getPublicKeyUrls() == null || authConfig.getPublicKeyUrls().isEmpty()) {
      throw new IllegalArgumentException("Public key URLs are required for OIDC");
    }
    if (authConfig.getAuthority() == null || authConfig.getAuthority().trim().isEmpty()) {
      throw new IllegalArgumentException("Authority is required for OIDC");
    }
    if (authConfig.getCallbackUrl() == null || authConfig.getCallbackUrl().trim().isEmpty()) {
      throw new IllegalArgumentException("Callback URL is required for OIDC");
    }
    if (authConfig.getClientId() == null || authConfig.getClientId().trim().isEmpty()) {
      throw new IllegalArgumentException("Client ID is required for OIDC");
    }
    if (authConfig.getJwtPrincipalClaims() == null
        || authConfig.getJwtPrincipalClaims().isEmpty()) {
      throw new IllegalArgumentException("JWT principal claims are required for OIDC");
    }
  }

  private void validateBasicRequiredFields(AuthenticationConfiguration authConfig) {
    LOG.info("Validating Basic authentication required fields");
    // Basic auth needs minimal fields
    if (authConfig.getJwtPrincipalClaims() == null
        || authConfig.getJwtPrincipalClaims().isEmpty()) {
      throw new IllegalArgumentException(
          "JWT principal claims are required for Basic authentication");
    }
  }

  private void validateLdapRequiredFields(AuthenticationConfiguration authConfig) {
    LOG.info("Validating LDAP authentication required fields");
    // LDAP needs minimal fields since it has its own ldapConfiguration
    if (authConfig.getJwtPrincipalClaims() == null
        || authConfig.getJwtPrincipalClaims().isEmpty()) {
      throw new IllegalArgumentException(
          "JWT principal claims are required for LDAP authentication");
    }
  }
}
