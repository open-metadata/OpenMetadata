package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_CREATED;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.apps.bundles.insights.DataInsightsApp.getDataStreamName;

import com.fasterxml.jackson.core.type.TypeReference;
import com.unboundid.ldap.sdk.LDAPConnection;
import com.unboundid.ldap.sdk.LDAPConnectionOptions;
import com.unboundid.ldap.sdk.SearchResult;
import com.unboundid.ldap.sdk.SearchScope;
import com.unboundid.util.ssl.SSLUtil;
import jakarta.json.JsonPatch;
import jakarta.json.JsonValue;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.api.configuration.UiThemePreference;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.auth.LdapConfiguration;
import org.openmetadata.schema.configuration.AssetCertificationSettings;
import org.openmetadata.schema.configuration.ExecutorConfiguration;
import org.openmetadata.schema.configuration.HistoryCleanUpConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.configuration.WorkflowSettings;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.scim.ScimConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.schema.service.configuration.slackApp.SlackAppConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.system.FieldError;
import org.openmetadata.schema.system.SecurityValidationResponse;
import org.openmetadata.schema.system.StepValidation;
import org.openmetadata.schema.system.ValidationResponse;
import org.openmetadata.schema.util.EntitiesCount;
import org.openmetadata.schema.util.ServicesCount;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
import org.openmetadata.service.logstorage.LogStorageFactory;
import org.openmetadata.service.logstorage.LogStorageInterface;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.auth.LoginAttemptCache;
import org.openmetadata.service.security.auth.validator.Auth0Validator;
import org.openmetadata.service.security.auth.validator.AzureAuthValidator;
import org.openmetadata.service.security.auth.validator.CognitoAuthValidator;
import org.openmetadata.service.security.auth.validator.CustomOidcValidator;
import org.openmetadata.service.security.auth.validator.GoogleAuthValidator;
import org.openmetadata.service.security.auth.validator.OidcDiscoveryValidator;
import org.openmetadata.service.security.auth.validator.OktaAuthValidator;
import org.openmetadata.service.security.auth.validator.SamlValidator;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.LdapUtil;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ValidationErrorBuilder;
import org.openmetadata.service.util.ValidationErrorBuilder.FieldPaths;

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

      // Apply LDAP default values to prevent JSON PATCH errors when updating fields that were
      // previously null
      if (fetchedSettings.getConfigType() == SettingsType.AUTHENTICATION_CONFIGURATION) {
        AuthenticationConfiguration authConfig =
            (AuthenticationConfiguration) fetchedSettings.getConfigValue();
        if (authConfig != null && authConfig.getLdapConfiguration() != null) {
          ensureLdapConfigDefaultValues(authConfig.getLdapConfiguration());
          fetchedSettings.setConfigValue(authConfig);
        }
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
    // Convert JsonValue back to a regular Java object
    // JsonValue is from Jakarta JSON API, we need to convert it to a Jackson-compatible object
    String jsonString = updated.toString();
    Object updatedConfigValue = JsonUtils.readValue(jsonString, Object.class);
    original.setConfigValue(updatedConfigValue);
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
        ScimConfiguration scimConfig =
            JsonUtils.convertValue(setting.getConfigValue(), ScimConfiguration.class);
        JsonUtils.validateJsonSchema(setting.getConfigValue(), ScimConfiguration.class);
        setting.setConfigValue(scimConfig);
      } else if (setting.getConfigType() == SettingsType.AUTHENTICATION_CONFIGURATION) {
        AuthenticationConfiguration authConfig =
            JsonUtils.convertValue(setting.getConfigValue(), AuthenticationConfiguration.class);
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

    // Only add log storage validation if S3 storage is configured
    StepValidation logStorageValidation = getLogStorageValidation(applicationConfig);
    if (logStorageValidation != null) {
      validation.setLogStorage(logStorageValidation);
    }

    if (Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      validation.setAdditionalProperty(
          "Semantic Search", getEmbeddingsValidation(applicationConfig));
    }

    addExtraValidations(applicationConfig, validation);

    return validation;
  }

  public void addExtraValidations(
      OpenMetadataApplicationConfig applicationConfig, ValidationResponse validation) {}

  private StepValidation getEmbeddingsValidation(OpenMetadataApplicationConfig applicationConfig) {
    StepValidation embeddingsValidation = new StepValidation();
    String description = "Embeddings are used to allow Semantic Search";
    SearchRepository searchRepository = Entity.getSearchRepository();

    String configMessage = getEmbeddingConfigurationMessage(applicationConfig);

    if (searchRepository.getVectorIndexService() == null) {
      return embeddingsValidation
          .withDescription(description)
          .withMessage("Embeddings are not configured properly. " + configMessage)
          .withPassed(false);
    }

    try {
      searchRepository.ensureVectorIndexDimension();
    } catch (Exception e) {
      LOG.error("Vector dimension mismatch detected", e);
      return embeddingsValidation
          .withDescription(description)
          .withMessage("Vector dimension mismatch: " + e.getMessage())
          .withPassed(false);
    }

    try {
      return validateEmbeddingGeneration(
          searchRepository.getEmbeddingClient(), embeddingsValidation, description, configMessage);
    } catch (Exception e) {
      LOG.error("Error during embedding generation validation", e);
      return embeddingsValidation
          .withDescription(description)
          .withMessage("Embedding generation failed: " + e.getMessage() + ". " + configMessage)
          .withPassed(false);
    }
  }

  private StepValidation validateEmbeddingGeneration(
      EmbeddingClient embeddingClient,
      StepValidation embeddingsValidation,
      String description,
      String configMessage) {
    String testText = "OpenMetadata embedding validation test";
    float[] embedding = embeddingClient.embed(testText);

    if (embedding == null) {
      return embeddingsValidation
          .withDescription(description)
          .withMessage("Embedding generation returned null. " + configMessage)
          .withPassed(false);
    }

    int expectedDimension = embeddingClient.getDimension();
    if (embedding.length != expectedDimension) {
      return embeddingsValidation
          .withDescription(description)
          .withMessage(
              String.format(
                  "Embedding dimension mismatch: expected %d, got %d. %s",
                  expectedDimension, embedding.length, configMessage))
          .withPassed(false);
    }

    boolean allZeros = true;
    for (float value : embedding) {
      if (value != 0.0f) {
        allZeros = false;
        break;
      }
    }
    if (allZeros) {
      return embeddingsValidation
          .withDescription(description)
          .withMessage("Embedding generation returned all zeros. " + configMessage)
          .withPassed(false);
    }

    return embeddingsValidation
        .withDescription(description)
        .withMessage(String.format("Embeddings are working correctly. %s", configMessage))
        .withPassed(true);
  }

  private String getEmbeddingConfigurationMessage(OpenMetadataApplicationConfig applicationConfig) {
    try {
      NaturalLanguageSearchConfiguration nlpConfig =
          applicationConfig.getElasticSearchConfiguration().getNaturalLanguageSearch();
      String provider = nlpConfig.getEmbeddingProvider();
      if (nullOrEmpty(provider)) {
        return "Required configuration: embeddingProvider";
      }

      return switch (provider.toLowerCase()) {
        case "djl" -> String.format(
            "DJL configuration: embeddingModel: %s", nlpConfig.getDjl().getEmbeddingModel());
        case "bedrock" -> String.format(
            "Bedrock configuration: region: %s, embeddingModelId: %s, embeddingDimension %s",
            nlpConfig.getBedrock().getAwsConfig() != null
                ? nlpConfig.getBedrock().getAwsConfig().getRegion()
                : "not configured",
            nlpConfig.getBedrock().getEmbeddingModelId(),
            nlpConfig.getBedrock().getEmbeddingDimension());
        case "openai" -> {
          String openaiEndpoint =
              nullOrEmpty(nlpConfig.getOpenai().getEndpoint())
                  ? "api.openai.com"
                  : nlpConfig.getOpenai().getEndpoint();
          String deploymentInfo =
              nullOrEmpty(nlpConfig.getOpenai().getDeploymentName())
                  ? ""
                  : String.format(
                      ", deploymentName: %s", nlpConfig.getOpenai().getDeploymentName());
          yield String.format(
              "OpenAI configuration: endpoint: %s, embeddingModelId: %s, embeddingDimension: %s%s",
              openaiEndpoint,
              nlpConfig.getOpenai().getEmbeddingModelId(),
              nlpConfig.getOpenai().getEmbeddingDimension(),
              deploymentInfo);
        }
        default -> String.format(
            "Unknown provider '%s'. Supported providers: djl, bedrock, openai", provider);
      };
    } catch (Exception e) {
      LOG.error("Error getting embedding configuration", e);
      return "Unable to determine embedding configuration";
    }
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

  public JsonPatch filterInvalidPatchOperations(
      JsonPatch patch, SecurityConfiguration currentConfig) {
    try {
      String provider =
          currentConfig.getAuthenticationConfiguration() != null
                  && currentConfig.getAuthenticationConfiguration().getProvider() != null
              ? currentConfig.getAuthenticationConfiguration().getProvider().value()
              : null;

      LOG.info("Current provider for patch filtering: {}", provider);

      jakarta.json.JsonArrayBuilder filteredPatchBuilder = jakarta.json.Json.createArrayBuilder();
      jakarta.json.JsonArray patchArray = patch.toJsonArray();
      LOG.info("Original patch has {} operations", patchArray.size());

      int filteredCount = 0;

      for (int i = 0; i < patchArray.size(); i++) {
        jakarta.json.JsonObject operation = patchArray.getJsonObject(i);

        String path = operation.getString("path", "");
        String op = operation.getString("op", "");

        boolean shouldFilter = false;

        if ("saml".equalsIgnoreCase(provider)) {
          // clientType is not applicable for SAML
          if (path.contains("clientType")) {
            LOG.info(
                "Filtering out clientType patch operation for SAML provider: op={}, path={}",
                op,
                path);
            shouldFilter = true;
          } else if (path.contains("oidcConfiguration")) {
            LOG.info(
                "Filtering out OIDC configuration patch operation for SAML provider: op={}, path={}",
                op,
                path);
            shouldFilter = true;
          }
        } else if (!"saml".equalsIgnoreCase(provider) && path.contains("samlConfiguration")) {
          LOG.info(
              "Filtering out SAML configuration patch operation for non-SAML provider: op={}, path={}",
              op,
              path);
          shouldFilter = true;
        } else if (!isOidcProvider(provider) && path.contains("oidcConfiguration")) {
          LOG.info(
              "Filtering out OIDC configuration patch operation for non-OIDC provider: op={}, path={}",
              op,
              path);
          shouldFilter = true;
        }

        if (!shouldFilter) {
          filteredPatchBuilder.add(operation);
          filteredCount++;
        }
      }

      LOG.info(
          "Patch filtering complete: {} operations -> {} operations",
          patchArray.size(),
          filteredCount);

      jakarta.json.JsonArray filteredArray = filteredPatchBuilder.build();
      return jakarta.json.Json.createPatch(filteredArray);

    } catch (Exception e) {
      LOG.error("Error filtering patch operations, returning original patch", e);
      // Return original patch if filtering fails
      return patch;
    }
  }

  private boolean isOidcProvider(String provider) {
    return provider != null
        && (provider.toLowerCase().contains("oidc")
            || "google".equalsIgnoreCase(provider)
            || "azure".equalsIgnoreCase(provider)
            || "okta".equalsIgnoreCase(provider)
            || "auth0".equalsIgnoreCase(provider)
            || "aws-cognito".equalsIgnoreCase(provider)
            || "custom-oidc".equalsIgnoreCase(provider));
  }

  public SecurityValidationResponse validateSecurityConfiguration(
      SecurityConfiguration securityConfig,
      OpenMetadataApplicationConfig applicationConfig,
      String currentUsername) {
    List<FieldError> errors = new ArrayList<>();

    try {
      if (securityConfig.getAuthenticationConfiguration() != null) {
        AuthenticationConfiguration authConfig = securityConfig.getAuthenticationConfiguration();

        // First validate all required fields from AuthenticationConfiguration schema
        FieldError baseError = validateAuthenticationConfigurationBaseFields(authConfig);
        if (baseError != null) {
          errors.add(baseError);
        }

        if (authConfig.getProvider() != null) {
          FieldError providerError = null;
          switch (authConfig.getProvider()) {
            case CUSTOM_OIDC:
            case OKTA:
            case AZURE:
            case GOOGLE:
            case AWS_COGNITO:
            case AUTH_0:
              // Always validate OIDC providers - validators handle public/confidential clients
              providerError =
                  validateOidcConfiguration(
                      authConfig, securityConfig.getAuthorizerConfiguration());
              break;
            case LDAP:
              if (authConfig.getLdapConfiguration() != null) {
                providerError = validateLdapConfiguration(authConfig.getLdapConfiguration());
              }
              break;
            case SAML:
              if (authConfig.getSamlConfiguration() != null) {
                providerError =
                    validateSamlConfiguration(authConfig.getSamlConfiguration(), applicationConfig);
              }
              break;
            default:
              providerError =
                  ValidationErrorBuilder.createFieldError(
                      FieldPaths.AUTH_PROVIDER, "Unknown provider: " + authConfig.getProvider());
          }
          if (providerError != null) {
            errors.add(providerError);
          }
        }
      }

      // Validate Authorizer configuration
      if (securityConfig.getAuthorizerConfiguration() != null) {
        FieldError authzError =
            validateAuthorizerConfiguration(
                securityConfig.getAuthorizerConfiguration(), currentUsername);
        if (authzError != null) {
          errors.add(authzError);
        }
      }

      SecurityValidationResponse response = new SecurityValidationResponse();
      if (errors.isEmpty()) {
        response.setStatus(SecurityValidationResponse.Status.SUCCESS);
      } else {
        response.setStatus(SecurityValidationResponse.Status.FAILED);
        response.setErrors(errors);
      }
      return response;
    } catch (Exception e) {
      LOG.error("Security configuration validation failed", e);
      errors.add(
          ValidationErrorBuilder.createFieldError(
              "general", "Validation failed: " + e.getMessage()));
      return new SecurityValidationResponse()
          .withStatus(SecurityValidationResponse.Status.FAILED)
          .withErrors(errors);
    }
  }

  private FieldError validateAuthenticationConfigurationBaseFields(
      AuthenticationConfiguration authConfig) {
    try {
      if (authConfig.getProvider() == null) {
        return ValidationErrorBuilder.createFieldError(
            FieldPaths.AUTH_PROVIDER, "Provider is required");
      }

      if (nullOrEmpty(authConfig.getProviderName())) {
        return ValidationErrorBuilder.createFieldError(
            "authenticationConfiguration.providerName", "Provider name is required");
      }

      if (authConfig.getJwtPrincipalClaims() == null
          || authConfig.getJwtPrincipalClaims().isEmpty()) {
        return ValidationErrorBuilder.createFieldError(
            FieldPaths.AUTH_JWT_PRINCIPAL_CLAIMS, "JWT principal claims are required");
      }

      boolean isLdapOrSaml =
          authConfig.getProvider() == AuthProvider.LDAP
              || authConfig.getProvider() == AuthProvider.SAML;

      if (!isLdapOrSaml) {
        // For confidential clients, publicKeyUrls is auto-populated from discovery document
        // Only require it for public clients
        boolean isConfidentialClient = authConfig.getClientType() == ClientType.CONFIDENTIAL;
        if (!isConfidentialClient
            && (authConfig.getPublicKeyUrls() == null || authConfig.getPublicKeyUrls().isEmpty())) {
          return ValidationErrorBuilder.createFieldError(
              FieldPaths.AUTH_PUBLIC_KEY_URLS, "Public key URLs are required");
        }

        if (nullOrEmpty(authConfig.getAuthority())) {
          return ValidationErrorBuilder.createFieldError(
              FieldPaths.AUTH_AUTHORITY, "Authority is required");
        }

        if (nullOrEmpty(authConfig.getCallbackUrl())) {
          return ValidationErrorBuilder.createFieldError(
              FieldPaths.AUTH_CALLBACK_URL, "Callback URL is required");
        }

        if (nullOrEmpty(authConfig.getClientId())) {
          return ValidationErrorBuilder.createFieldError(
              FieldPaths.AUTH_CLIENT_ID, "Client ID is required");
        }
      }

      if (authConfig.getJwtPrincipalClaimsMapping() != null
          && !authConfig.getJwtPrincipalClaimsMapping().isEmpty()) {
        try {
          Map<String, String> claimsMapping =
              listOrEmpty(authConfig.getJwtPrincipalClaimsMapping()).stream()
                  .map(s -> s.split(":"))
                  .collect(Collectors.toMap(s -> s[0], s -> s[1]));
          SecurityUtil.validatePrincipalClaimsMapping(claimsMapping);
        } catch (Exception e) {
          return ValidationErrorBuilder.createFieldError(
              FieldPaths.AUTH_JWT_PRINCIPAL_CLAIMS_MAPPING, e.getMessage());
        }
      }

      return null; // No errors - validation passed
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError("", e.getMessage());
    }
  }

  private FieldError validateOidcConfiguration(
      AuthenticationConfiguration authConfig, AuthorizerConfiguration authzConfig) {
    try {
      String clientType = String.valueOf(authConfig.getClientType()).toLowerCase();
      if ("confidential".equals(clientType)) {
        if (authConfig.getOidcConfiguration() == null) {
          return ValidationErrorBuilder.createFieldError(
              FieldPaths.OIDC_CLIENT_ID, "OIDC configuration is required");
        }
        OidcClientConfig oidcConfig = authConfig.getOidcConfiguration();

        if (nullOrEmpty(oidcConfig.getId())) {
          return ValidationErrorBuilder.createFieldError(
              FieldPaths.OIDC_CLIENT_ID, "Client ID is required");
        }
        if (nullOrEmpty(oidcConfig.getSecret())) {
          return ValidationErrorBuilder.createFieldError(
              FieldPaths.OIDC_CLIENT_SECRET, "Client secret is required");
        }
        if (nullOrEmpty(oidcConfig.getDiscoveryUri()) && nullOrEmpty(oidcConfig.getServerUrl())) {
          return ValidationErrorBuilder.createFieldError(
              FieldPaths.OIDC_DISCOVERY_URI, "Discovery URI or Server URL is required");
        }
      } else if ("public".equals(clientType)) {
        LOG.debug("Public client detected - oidcConfiguration is optional");
      }

      // Provider-specific enhanced validation
      String provider = String.valueOf(authConfig.getProvider());
      FieldError providerValidation = null;

      switch (provider.toLowerCase()) {
        case "azure":
          AzureAuthValidator azureValidator = new AzureAuthValidator();
          FieldError azureResult =
              azureValidator.validateAzureConfiguration(
                  authConfig, authConfig.getOidcConfiguration());
          if (azureResult != null) {
            providerValidation = azureResult;
          }
          break;

        case "google":
          GoogleAuthValidator googleValidator = new GoogleAuthValidator();
          FieldError googleResult =
              googleValidator.validateGoogleConfiguration(
                  authConfig, authConfig.getOidcConfiguration());
          if (googleResult != null) {
            providerValidation = googleResult;
          }
          break;

        case "okta":
          OktaAuthValidator oktaValidator = new OktaAuthValidator();
          FieldError oktaResult =
              oktaValidator.validateOktaConfiguration(
                  authConfig, authConfig.getOidcConfiguration());
          if (oktaResult != null) {
            // Okta validator now returns FieldError directly - no need for field path mapping
            providerValidation = oktaResult;
          }
          break;

        case "auth0":
          Auth0Validator auth0Validator = new Auth0Validator();
          FieldError auth0Result =
              auth0Validator.validateAuth0Configuration(
                  authConfig, authConfig.getOidcConfiguration());
          if (auth0Result != null) {
            providerValidation = auth0Result;
          }
          break;

        case "aws-cognito":
          CognitoAuthValidator cognitoValidator = new CognitoAuthValidator();
          FieldError cognitoResult =
              cognitoValidator.validateCognitoConfiguration(
                  authConfig, authConfig.getOidcConfiguration());
          if (cognitoResult != null) {
            providerValidation = cognitoResult;
          }
          break;

        case "custom-oidc":
          CustomOidcValidator customOidcValidator = new CustomOidcValidator();
          FieldError customResult =
              customOidcValidator.validateCustomOidcConfiguration(
                  authConfig, authConfig.getOidcConfiguration());
          if (customResult != null) {
            providerValidation = customResult;
          }
          break;

        default:
          LOG.warn("Unknown provider type for enhanced validation: {}", provider);
      }

      if (providerValidation != null) {
        return providerValidation;
      }

      // Use existing validation method to test actual connectivity only for confidential clients
      // or when oidcConfiguration is present (some custom OIDC setups)
      if ("confidential".equals(clientType) || authConfig.getOidcConfiguration() != null) {
        try {
          AuthenticationCodeFlowHandler.validateConfig(authConfig, authzConfig);
        } catch (Exception e) {
          // Return error if validation fails
          return ValidationErrorBuilder.createFieldError(
              "authenticationConfiguration.oidcConfiguration",
              "OIDC flow validation failed: " + e.getMessage());
        }
      } else {
        LOG.debug(
            "Skipping AuthenticationCodeFlowHandler validation for public client without oidcConfiguration");
      }

      return null; // No errors - validation passed
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError("", e.getMessage());
    }
  }

  /**
   * Auto-populates publicKeyUrls from OIDC discovery document for confidential clients
   * This is called during save operation to ensure publicKeyUrls is populated before persisting
   */
  public void autoPopulatePublicKeyUrlsIfNeeded(AuthenticationConfiguration authConfig) {
    if (authConfig == null) {
      return;
    }

    // Only auto-populate for OIDC providers with confidential client type
    boolean isOidcProvider =
        authConfig.getProvider() == AuthProvider.CUSTOM_OIDC
            || authConfig.getProvider() == AuthProvider.GOOGLE
            || authConfig.getProvider() == AuthProvider.AZURE
            || authConfig.getProvider() == AuthProvider.OKTA
            || authConfig.getProvider() == AuthProvider.AUTH_0
            || authConfig.getProvider() == AuthProvider.AWS_COGNITO;

    boolean isConfidentialClient = authConfig.getClientType() == ClientType.CONFIDENTIAL;

    if (!isOidcProvider || !isConfidentialClient) {
      LOG.debug("Skipping publicKeyUrls auto-population - not OIDC confidential client");
      return;
    }

    // Skip if already populated
    if (authConfig.getPublicKeyUrls() != null && !authConfig.getPublicKeyUrls().isEmpty()) {
      LOG.debug("publicKeyUrls already populated, skipping auto-population");
      return;
    }

    OidcClientConfig oidcConfig = authConfig.getOidcConfiguration();
    if (oidcConfig == null || nullOrEmpty(oidcConfig.getDiscoveryUri())) {
      LOG.warn("Cannot auto-populate publicKeyUrls - missing oidcConfiguration or discoveryUri");
      return;
    }

    try {
      OidcDiscoveryValidator discoveryValidator = new OidcDiscoveryValidator();
      discoveryValidator.autoPopulatePublicKeyUrls(oidcConfig.getDiscoveryUri(), authConfig);
      LOG.info(
          "Auto-populated publicKeyUrls from discovery document for provider: {}",
          authConfig.getProvider());
    } catch (Exception e) {
      LOG.error("Failed to auto-populate publicKeyUrls: {}", e.getMessage(), e);
    }
  }

  private FieldError validateLdapConfiguration(LdapConfiguration ldapConfig) {
    try {
      // Validate required fields from JSON schema
      if (nullOrEmpty(ldapConfig.getHost())) {
        return ValidationErrorBuilder.createFieldError(FieldPaths.LDAP_HOST, "Host is required");
      }
      if (ldapConfig.getPort() == null
          || ldapConfig.getPort() <= 0
          || ldapConfig.getPort() > 65535) {
        return ValidationErrorBuilder.createFieldError(
            FieldPaths.LDAP_PORT, "Valid port (1-65535) is required");
      }
      if (nullOrEmpty(ldapConfig.getDnAdminPrincipal())) {
        return ValidationErrorBuilder.createFieldError(
            FieldPaths.LDAP_DN_ADMIN_PRINCIPAL, "Admin DN is required");
      }
      if (nullOrEmpty(ldapConfig.getDnAdminPassword())) {
        return ValidationErrorBuilder.createFieldError(
            FieldPaths.LDAP_DN_ADMIN_PASSWORD, "Admin password is required");
      }
      if (nullOrEmpty(ldapConfig.getUserBaseDN())) {
        return ValidationErrorBuilder.createFieldError(
            FieldPaths.LDAP_USER_BASE_DN, "User base DN is required");
      }
      if (nullOrEmpty(ldapConfig.getMailAttributeName())) {
        return ValidationErrorBuilder.createFieldError(
            FieldPaths.LDAP_MAIL_ATTRIBUTE, "Mail attribute name is required");
      }

      // Validate authRolesMapping JSON if provided - but only if we have group configuration
      // Note: We validate this before LDAP connection to fail fast on JSON issues
      Map<String, List<String>> roleMapping = null;
      if (!nullOrEmpty(ldapConfig.getAuthRolesMapping())) {
        try {
          roleMapping =
              JsonUtils.readValue(ldapConfig.getAuthRolesMapping(), new TypeReference<>() {});

          // Validate that mapped roles exist in OpenMetadata
          RoleRepository roleRepo = (RoleRepository) Entity.getEntityRepository(Entity.ROLE);
          List<String> invalidRoles = new ArrayList<>();

          for (Map.Entry<String, List<String>> entry : roleMapping.entrySet()) {
            for (String roleName : entry.getValue()) {
              // Skip admin role name check as it's a special marker
              if (!roleName.equals(ldapConfig.getRoleAdminName())) {
                try {
                  roleRepo.getByName(null, roleName, roleRepo.getFields("id,name"));
                } catch (EntityNotFoundException e) {
                  invalidRoles.add(roleName);
                }
              }
            }
          }

          if (!invalidRoles.isEmpty()) {
            return ValidationErrorBuilder.createFieldError(
                FieldPaths.LDAP_AUTH_ROLES_MAPPING,
                "The following roles do not exist in OpenMetadata: "
                    + String.join(", ", invalidRoles)
                    + ". Please create these roles first or use existing role names.");
          }
        } catch (Exception e) {
          return ValidationErrorBuilder.createFieldError(
              FieldPaths.LDAP_AUTH_ROLES_MAPPING,
              "Invalid JSON format in role mapping: " + e.getMessage());
        }
      }

      // Test LDAP connection
      LDAPConnection connection = null;
      try {
        LDAPConnectionOptions connectionOptions = new LDAPConnectionOptions();
        connectionOptions.setConnectTimeoutMillis(5000);
        connectionOptions.setResponseTimeoutMillis(5000);

        if (Boolean.TRUE.equals(ldapConfig.getSslEnabled())) {
          LdapUtil ldapUtil = new LdapUtil();
          SSLUtil sslUtil =
              new SSLUtil(ldapUtil.getLdapSSLConnection(ldapConfig, connectionOptions));
          connection =
              new LDAPConnection(
                  sslUtil.createSSLSocketFactory(),
                  connectionOptions,
                  ldapConfig.getHost(),
                  ldapConfig.getPort(),
                  ldapConfig.getDnAdminPrincipal(),
                  ldapConfig.getDnAdminPassword());
        } else {
          connection =
              new LDAPConnection(
                  connectionOptions,
                  ldapConfig.getHost(),
                  ldapConfig.getPort(),
                  ldapConfig.getDnAdminPrincipal(),
                  ldapConfig.getDnAdminPassword());
        }

        // Test user base DN exists
        SearchResult searchResult =
            connection.search(ldapConfig.getUserBaseDN(), SearchScope.BASE, "(objectClass=*)");
        if (searchResult.getEntryCount() == 0) {
          return ValidationErrorBuilder.createFieldError(
              FieldPaths.LDAP_USER_BASE_DN, "User base DN does not exist");
        }

        // Validate mail attribute by searching for a test user
        if (!nullOrEmpty(ldapConfig.getMailAttributeName())) {
          try {
            SearchResult userSearchResult =
                connection.search(
                    ldapConfig.getUserBaseDN(),
                    SearchScope.SUB,
                    "(objectClass=*)",
                    ldapConfig.getMailAttributeName());

            if (userSearchResult.getEntryCount() > 0) {
              // Check if at least one user has the mail attribute
              boolean mailAttributeFound = false;
              for (int i = 0; i < Math.min(userSearchResult.getEntryCount(), 10); i++) {
                if (userSearchResult
                        .getSearchEntries()
                        .get(i)
                        .hasAttribute(ldapConfig.getMailAttributeName())
                    && !nullOrEmpty(
                        userSearchResult
                            .getSearchEntries()
                            .get(i)
                            .getAttributeValue(ldapConfig.getMailAttributeName()))) {
                  mailAttributeFound = true;
                  break;
                }
              }

              if (!mailAttributeFound) {
                return ValidationErrorBuilder.createFieldError(
                    FieldPaths.LDAP_MAIL_ATTRIBUTE,
                    "Mail attribute '"
                        + ldapConfig.getMailAttributeName()
                        + "' not found on any users in user base DN. "
                        + "Please verify the attribute name is correct. "
                        + "Common values: 'mail', 'email', 'userPrincipalName'");
              }
            }
          } catch (Exception e) {
            LOG.warn("Failed to validate mail attribute: " + e.getMessage());
          }
        }

        // Validate group-related configuration if group base DN is provided
        if (!nullOrEmpty(ldapConfig.getGroupBaseDN())) {
          // 1. Validate group base DN exists
          try {
            SearchResult groupBaseDnResult =
                connection.search(ldapConfig.getGroupBaseDN(), SearchScope.BASE, "(objectClass=*)");
            if (groupBaseDnResult.getEntryCount() == 0) {
              return ValidationErrorBuilder.createFieldError(
                  FieldPaths.LDAP_GROUP_BASE_DN, "Group base DN does not exist in LDAP directory");
            }
          } catch (Exception e) {
            return ValidationErrorBuilder.createFieldError(
                FieldPaths.LDAP_GROUP_BASE_DN,
                "Failed to validate group base DN: " + e.getMessage());
          }

          // 2. Validate group attribute name and value together
          if (!nullOrEmpty(ldapConfig.getGroupAttributeName())
              && !nullOrEmpty(ldapConfig.getGroupAttributeValue())) {
            try {
              String groupFilter =
                  "("
                      + ldapConfig.getGroupAttributeName()
                      + "="
                      + ldapConfig.getGroupAttributeValue()
                      + ")";
              SearchResult groupFilterResult =
                  connection.search(ldapConfig.getGroupBaseDN(), SearchScope.SUB, groupFilter, "*");

              if (groupFilterResult.getEntryCount() == 0) {
                return ValidationErrorBuilder.createFieldError(
                    FieldPaths.LDAP_GROUP_ATTRIBUTE_NAME,
                    "No groups found with "
                        + ldapConfig.getGroupAttributeName()
                        + "="
                        + ldapConfig.getGroupAttributeValue()
                        + ". "
                        + "Common values: groupAttributeName='objectClass' with "
                        + "groupAttributeValue='groupOfNames' or 'groupOfUniqueNames'");
              }

              // 3. Validate group member attribute exists on group objects
              if (!nullOrEmpty(ldapConfig.getGroupMemberAttributeName())) {
                boolean memberAttributeFound = false;
                for (int i = 0;
                    i < Math.min(groupFilterResult.getEntryCount(), 5);
                    i++) { // Check first 5 groups
                  if (groupFilterResult
                      .getSearchEntries()
                      .get(i)
                      .hasAttribute(ldapConfig.getGroupMemberAttributeName())) {
                    memberAttributeFound = true;
                    break;
                  }
                }

                if (!memberAttributeFound) {
                  return ValidationErrorBuilder.createFieldError(
                      FieldPaths.LDAP_GROUP_MEMBER_ATTRIBUTE_NAME,
                      "Group member attribute '"
                          + ldapConfig.getGroupMemberAttributeName()
                          + "' not found on any groups. "
                          + "Common values: 'member' (for groupOfNames), 'uniqueMember' (for "
                          + "groupOfUniqueNames), 'memberUid' (for posixGroup)");
                }
              } else {
                return ValidationErrorBuilder.createFieldError(
                    FieldPaths.LDAP_GROUP_MEMBER_ATTRIBUTE_NAME,
                    "Group member attribute name is required when group base DN is configured. "
                        + "This attribute identifies users in group objects. "
                        + "Common values: 'member', 'uniqueMember', 'memberUid'");
              }

            } catch (Exception e) {
              return ValidationErrorBuilder.createFieldError(
                  FieldPaths.LDAP_GROUP_ATTRIBUTE_NAME,
                  "Failed to validate group filter: " + e.getMessage());
            }
          } else {
            // Group attribute name/value are required if group base DN is provided
            if (nullOrEmpty(ldapConfig.getGroupAttributeName())) {
              return ValidationErrorBuilder.createFieldError(
                  FieldPaths.LDAP_GROUP_ATTRIBUTE_NAME,
                  "Group attribute name is required when group base DN is configured. "
                      + "This identifies group objects in LDAP. "
                      + "Common value: 'objectClass'");
            }
            if (nullOrEmpty(ldapConfig.getGroupAttributeValue())) {
              return ValidationErrorBuilder.createFieldError(
                  FieldPaths.LDAP_GROUP_ATTRIBUTE_VALUE,
                  "Group attribute value is required when group base DN is configured. "
                      + "This specifies the type of group objects. "
                      + "Common values: 'groupOfNames', 'groupOfUniqueNames', 'posixGroup'");
            }
          }
        }

        // Validate that LDAP group DNs in role mapping actually exist in LDAP
        if (roleMapping != null
            && !roleMapping.isEmpty()
            && !nullOrEmpty(ldapConfig.getGroupBaseDN())) {
          List<String> invalidGroupDns = new ArrayList<>();

          for (String groupDn : roleMapping.keySet()) {
            try {
              // Try to retrieve the group by its DN
              SearchResult groupCheck =
                  connection.search(groupDn, SearchScope.BASE, "(objectClass=*)");
              if (groupCheck.getEntryCount() == 0) {
                invalidGroupDns.add(groupDn);
              }
            } catch (Exception e) {
              // Group DN doesn't exist or is invalid
              invalidGroupDns.add(groupDn + " (error: " + e.getMessage() + ")");
            }
          }

          if (!invalidGroupDns.isEmpty()) {
            return ValidationErrorBuilder.createFieldError(
                FieldPaths.LDAP_AUTH_ROLES_MAPPING,
                "The following LDAP group DNs do not exist in your LDAP directory: "
                    + String.join(", ", invalidGroupDns)
                    + ". Please verify the group DNs are correct. "
                    + "You can find correct group DNs in phpLDAPadmin by browsing to your groups.");
          }
        }

        return null; // No errors - validation passed
      } finally {
        if (connection != null && connection.isConnected()) {
          connection.close();
        }
      }
    } catch (Exception e) {
      return mapLdapExceptionToFieldError(e);
    }
  }

  /**
   * Ensures LDAP configuration fields have default values to prevent JSON PATCH errors. When
   * fields are null in the database and the UI tries to update them with "replace" operation, JSON
   * PATCH fails because "replace" requires the field to exist. By providing empty string defaults,
   * we make "replace" operations work correctly while keeping validation and authentication logic
   * safe (since nullOrEmpty() treats both null and "" as empty).
   */
  public void ensureLdapConfigDefaultValues(LdapConfiguration ldapConfig) {
    if (ldapConfig == null) {
      return;
    }

    // Ensure group-related fields have defaults to prevent JSON PATCH errors
    if (ldapConfig.getGroupAttributeName() == null) {
      ldapConfig.setGroupAttributeName("");
    }
    if (ldapConfig.getGroupAttributeValue() == null) {
      ldapConfig.setGroupAttributeValue("");
    }
    if (ldapConfig.getGroupMemberAttributeName() == null) {
      ldapConfig.setGroupMemberAttributeName("");
    }
    if (ldapConfig.getGroupBaseDN() == null) {
      ldapConfig.setGroupBaseDN("");
    }

    // Ensure other optional fields have defaults
    if (ldapConfig.getRoleAdminName() == null) {
      ldapConfig.setRoleAdminName("");
    }
    if (ldapConfig.getAllAttributeName() == null) {
      ldapConfig.setAllAttributeName("");
    }
    if (ldapConfig.getAuthRolesMapping() == null) {
      ldapConfig.setAuthRolesMapping("");
    }
  }

  private FieldError mapLdapExceptionToFieldError(Exception e) {
    String message = e.getMessage().toLowerCase();

    // UserBaseDN errors - "no such object" typically means the DN doesn't exist
    if (message.contains("no such object") || message.contains("32")) {
      return ValidationErrorBuilder.createFieldError(FieldPaths.LDAP_USER_BASE_DN, e.getMessage());
    }

    // Host-related errors
    if (message.contains("unknownhostexception") || message.contains("resolve address")) {
      return ValidationErrorBuilder.createFieldError(FieldPaths.LDAP_HOST, e.getMessage());
    }

    // Port-related errors
    if (message.contains("connection refused")
        || message.contains("connect error")
        || (message.contains("port") && message.contains("connect"))) {
      return ValidationErrorBuilder.createFieldError(FieldPaths.LDAP_PORT, e.getMessage());
    }

    // SSL-related errors
    if (message.contains("sslhandshakeexception")
        || message.contains("ssl")
        || message.contains("handshake")
        || message.contains("certificate")) {
      return ValidationErrorBuilder.createFieldError(FieldPaths.LDAP_SSL_ENABLED, e.getMessage());
    }

    // Authentication/credentials errors
    // Note: It's difficult to distinguish between wrong DN and wrong password from LDAP error alone
    // Both typically return "invalid credentials" (LDAP error code 49)
    // We map to dnAdminPassword since that's more commonly the issue
    if (message.contains("invalid credentials")
        || message.contains("authentication")
        || message.contains("bind failed")
        || message.contains("49")) {
      return ValidationErrorBuilder.createFieldError(
          FieldPaths.LDAP_DN_ADMIN_PASSWORD, e.getMessage());
    }

    // Invalid DN format errors
    if (message.contains("invalid dn") || message.contains("malformed")) {
      return ValidationErrorBuilder.createFieldError(
          FieldPaths.LDAP_DN_ADMIN_PRINCIPAL, e.getMessage());
    }

    // Generic LDAP configuration error for unmatched cases
    return ValidationErrorBuilder.createFieldError("", e.getMessage());
  }

  private FieldError validateSamlConfiguration(
      SamlSSOClientConfig samlConfig, OpenMetadataApplicationConfig applicationConfig) {
    try {
      // Use enhanced SAML validator - this performs comprehensive validation
      // without affecting production settings
      SamlValidator samlValidator = new SamlValidator();
      FieldError result = samlValidator.validateSamlConfiguration(null, samlConfig);
      if (result != null) {
        return result;
      }
      return null; // No errors - validation passed
    } catch (Exception e) {
      String fieldPath = determineFieldPathFromError("saml", e.getMessage());
      return ValidationErrorBuilder.createFieldError(
          fieldPath, "SAML validation failed: " + e.getMessage());
    }
  }

  private FieldError validateAuthorizerConfiguration(
      AuthorizerConfiguration authzConfig, String currentUsername) {
    try {
      // Validate required fields
      if (nullOrEmpty(authzConfig.getClassName())) {
        return ValidationErrorBuilder.createFieldError(
            "authorizerConfiguration.className", "Class name is required");
      }

      // Validate admin principals
      if (authzConfig.getAdminPrincipals() == null || authzConfig.getAdminPrincipals().isEmpty()) {
        return ValidationErrorBuilder.createFieldError(
            FieldPaths.AUTHZ_ADMIN_PRINCIPALS, "At least one admin principal is required");
      }

      // Validate principal domain (required field)
      if (nullOrEmpty(authzConfig.getPrincipalDomain())) {
        return ValidationErrorBuilder.createFieldError(
            FieldPaths.AUTHZ_PRINCIPAL_DOMAIN, "Principal domain is required");
      }

      // Try to instantiate the authorizer class
      try {
        Class<?> authorizerClass = Class.forName(authzConfig.getClassName());
        if (!Authorizer.class.isAssignableFrom(authorizerClass)) {
          return ValidationErrorBuilder.createFieldError(
              "authorizerConfiguration.className", "Class does not implement Authorizer interface");
        }
      } catch (ClassNotFoundException e) {
        return ValidationErrorBuilder.createFieldError(
            "authorizerConfiguration.className", "Class not found");
      }

      return null; // No errors - validation passed
    } catch (Exception e) {
      return ValidationErrorBuilder.createFieldError("", e.getMessage());
    }
  }

  /**
   * Determine the specific field path based on the error message content.
   * This helps map generic error messages to specific form fields.
   */
  private String determineFieldPathFromError(String provider, String errorMessage) {
    String lowerCaseMessage = errorMessage.toLowerCase();

    // Special handling for specific error patterns first
    // Check for explicit "Invalid client ID" messages
    if (lowerCaseMessage.contains("invalid client id")
        || (lowerCaseMessage.contains("client id")
            && lowerCaseMessage.contains("not recognized"))) {
      return FieldPaths.OIDC_CLIENT_ID;
    }

    // "Invalid client credentials" - generic OAuth error that could be ID or secret
    if (lowerCaseMessage.contains("invalid client credentials")) {
      // For most providers, this typically indicates wrong secret when we can't be more specific
      // The error message usually mentions both ID and secret, making it ambiguous
      // We default to client secret as it's more commonly the issue
      return FieldPaths.OIDC_CLIENT_SECRET;
    }

    // Azure-specific: "Client is not authorized" typically means wrong client ID
    if (lowerCaseMessage.contains("client is not authorized")
        && "azure".equalsIgnoreCase(provider)) {
      return FieldPaths.OIDC_CLIENT_ID;
    }

    // Generic client ID mentions (check after more specific patterns)
    if (lowerCaseMessage.contains("client id")
        || lowerCaseMessage.contains("client_id")
        || lowerCaseMessage.contains("clientid")) {
      return FieldPaths.OIDC_CLIENT_ID;
    }

    if (lowerCaseMessage.contains("client secret")
        || lowerCaseMessage.contains("client_secret")
        || lowerCaseMessage.contains("clientsecret")
        || lowerCaseMessage.contains("invalid client secret")
        || (lowerCaseMessage.contains("secret") && lowerCaseMessage.contains("incorrect"))) {
      return FieldPaths.OIDC_CLIENT_SECRET;
    }

    // Check for Azure discovery URI issues
    if ("azure".equalsIgnoreCase(provider)
        && lowerCaseMessage.contains("invalid azure discovery uri")) {
      // Check if the error message shows that both expected and actual URIs have the same tenant
      // This would indicate the discovery URI format is wrong, not the tenant

      // Extract tenant patterns from the error message if possible
      // Look for the tenant GUID pattern in both expected and actual URIs
      Pattern tenantPattern =
          Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
      Matcher matcher = tenantPattern.matcher(errorMessage);

      List<String> tenantIds = new ArrayList<>();
      while (matcher.find()) {
        tenantIds.add(matcher.group());
      }

      // If we found multiple tenant IDs and they're all the same, it's a discovery URI format issue
      if (tenantIds.size() >= 2 && tenantIds.stream().distinct().count() == 1) {
        // Same tenant in expected and actual - problem is with discovery URI format
        return FieldPaths.OIDC_DISCOVERY_URI;
      }

      // Different tenants or couldn't determine - likely a tenant issue
      return "authenticationConfiguration.oidcConfiguration.tenant";
    }

    // Check for public key URL errors first (before discovery URI check)
    // since public key URL errors may contain the word "discovery" in the URL path
    if (lowerCaseMessage.contains("public key url")
        || lowerCaseMessage.contains("jwks endpoint")
        || lowerCaseMessage.contains("public key urls")) {
      return FieldPaths.AUTH_PUBLIC_KEY_URLS;
    }

    if (lowerCaseMessage.contains("discovery")
        || lowerCaseMessage.contains("discovery uri")
        || lowerCaseMessage.contains("discovery_uri")) {
      return FieldPaths.OIDC_DISCOVERY_URI;
    }
    if (lowerCaseMessage.contains("tenant") || lowerCaseMessage.contains("tenant id")) {
      return "authenticationConfiguration.oidcConfiguration.tenant";
    }
    if (lowerCaseMessage.contains("scope")) {
      return FieldPaths.OIDC_SCOPE;
    }
    if (lowerCaseMessage.contains("prompt")) {
      return FieldPaths.OIDC_PROMPT;
    }
    if (lowerCaseMessage.contains("callback") || lowerCaseMessage.contains("redirect")) {
      return FieldPaths.OIDC_CALLBACK_URL;
    }
    if (lowerCaseMessage.contains("authority")) {
      return FieldPaths.AUTH_AUTHORITY;
    }
    if (lowerCaseMessage.contains("audience")) {
      return "authenticationConfiguration.oidcConfiguration.audience";
    }

    // Provider-specific field mappings
    switch (provider.toLowerCase()) {
      case "google":
        if (lowerCaseMessage.contains("domain") || lowerCaseMessage.contains("hd parameter")) {
          return "authenticationConfiguration.oidcConfiguration.domain";
        }
        break;
      case "azure":
        if (lowerCaseMessage.contains("tenant")) {
          return "authenticationConfiguration.oidcConfiguration.tenant";
        }
        break;
      case "okta":
        if (lowerCaseMessage.contains("issuer") || lowerCaseMessage.contains("org url")) {
          return "authenticationConfiguration.oidcConfiguration.issuer";
        }
        break;
      case "auth0":
        if (lowerCaseMessage.contains("domain")) {
          return "authenticationConfiguration.oidcConfiguration.domain";
        }
        break;
      case "aws-cognito":
        if (lowerCaseMessage.contains("user pool")
            || lowerCaseMessage.contains("userpool")
            || lowerCaseMessage.contains("region")
            || lowerCaseMessage.contains("invalid aws region")
            || lowerCaseMessage.contains("invalid cognito url")
            || lowerCaseMessage.contains("discovery")) {
          // All these errors relate to the discovery URI since user pool ID and region are
          // extracted from it
          return FieldPaths.OIDC_DISCOVERY_URI;
        }
        break;
      case "saml":
        // SAML IDP fields
        if (lowerCaseMessage.contains("entity id") || lowerCaseMessage.contains("entityid")) {
          return FieldPaths.SAML_IDP_ENTITY_ID;
        }
        if (lowerCaseMessage.contains("sso login url")
            || lowerCaseMessage.contains("sso url")
            || lowerCaseMessage.contains("login url")) {
          return FieldPaths.SAML_IDP_SSO_URL;
        }
        if (lowerCaseMessage.contains("certificate")
            || lowerCaseMessage.contains("x509")
            || lowerCaseMessage.contains("cert")) {
          return FieldPaths.SAML_IDP_CERT;
        }
        if (lowerCaseMessage.contains("name id") || lowerCaseMessage.contains("nameid")) {
          return FieldPaths.SAML_IDP_NAME_ID;
        }
        // SAML SP fields
        if (lowerCaseMessage.contains("sp entity")
            || lowerCaseMessage.contains("service provider entity")) {
          return FieldPaths.SAML_SP_ENTITY_ID;
        }
        if (lowerCaseMessage.contains("acs") || lowerCaseMessage.contains("assertion consumer")) {
          return FieldPaths.SAML_SP_ACS_URL;
        }
        if (lowerCaseMessage.contains("sp certificate")
            || lowerCaseMessage.contains("service provider certificate")) {
          return FieldPaths.SAML_SP_CERT;
        }
        if (lowerCaseMessage.contains("private key") || lowerCaseMessage.contains("sp key")) {
          return FieldPaths.SAML_SP_KEY;
        }
        if (lowerCaseMessage.contains("callback")) {
          return FieldPaths.SAML_SP_CALLBACK;
        }
        // Default to general SAML configuration for unmapped SAML errors
        return "authenticationConfiguration.samlConfiguration";
    }

    // Default to general configuration based on provider
    if ("saml".equalsIgnoreCase(provider)) {
      return "authenticationConfiguration.samlConfiguration";
    } else if (isOidcProvider(provider)) {
      return "authenticationConfiguration.oidcConfiguration";
    } else {
      return "authenticationConfiguration";
    }
  }

  private StepValidation getLogStorageValidation(OpenMetadataApplicationConfig applicationConfig) {
    try {
      if (applicationConfig.getPipelineServiceClientConfiguration() == null
          || applicationConfig.getPipelineServiceClientConfiguration().getLogStorageConfiguration()
              == null) {
        return null;
      }

      LogStorageConfiguration logStorageConfig =
          applicationConfig.getPipelineServiceClientConfiguration().getLogStorageConfiguration();

      if (logStorageConfig.getType() != LogStorageConfiguration.Type.S_3) {
        return null; // Not S3 storage, skip validation
      }

      LogStorageInterface logStorage =
          LogStorageFactory.create(
              logStorageConfig,
              null, // We don't need pipeline service client for S3 storage
              null // Metrics not available in migration context
              );

      String testPipelineFQN = "system.validation.test";
      UUID testRunId = UUID.fromString("00000000-0000-0000-0000-000000000000");
      logStorage.logsExist(testPipelineFQN, testRunId);

      return new StepValidation()
          .withDescription("S3 Log Storage")
          .withPassed(Boolean.TRUE)
          .withMessage(
              String.format(
                  "Connected to S3 bucket: %s in region %s",
                  logStorageConfig.getBucketName(),
                  logStorageConfig.getAwsConfig().getAwsRegion()));
    } catch (Exception e) {
      return new StepValidation()
          .withDescription("S3 Log Storage")
          .withPassed(Boolean.FALSE)
          .withMessage(e.getMessage());
    }
  }
}
