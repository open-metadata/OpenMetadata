package org.openmetadata.service.resources.system;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.GLOSSARY_TERM_RELATION_SETTINGS;
import static org.openmetadata.schema.settings.SettingsType.LINEAGE_SETTINGS;
import static org.openmetadata.schema.settings.SettingsType.MCP_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.SEARCH_SETTINGS;

import io.swagger.v3.oas.annotations.ExternalDocumentation;
import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.json.JsonPatch;
import jakarta.json.JsonValue;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.auth.EmailRequest;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCardinality;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.system.SecurityValidationResponse;
import org.openmetadata.schema.system.ValidationResponse;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.util.EntitiesCount;
import org.openmetadata.schema.util.ServicesCount;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheMetrics;
import org.openmetadata.service.cache.CacheProvider;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.exception.SystemSettingsException;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.monitoring.LatencyPhase;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.rules.LogicOps;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.email.EmailUtil;

@Path("/v1/system")
@Tag(name = "System", description = "APIs related to System configuration and settings.")
@Hidden
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "system")
@Slf4j
@LatencyPhase
public class SystemResource {
  public static final String COLLECTION_PATH = "/v1/system";
  private final SystemRepository systemRepository;
  private final Authorizer authorizer;
  private OpenMetadataApplicationConfig applicationConfig;
  private PipelineServiceClientInterface pipelineServiceClient;
  private JwtFilter jwtFilter;
  private SearchSettings defaultSearchSettingsCache = new SearchSettings();
  private final SearchSettingsHandler searchSettingsHandler = new SearchSettingsHandler();
  private boolean isNlqEnabled = false;

  public SystemResource(Authorizer authorizer) {
    this.systemRepository = Entity.getSystemRepository();
    this.authorizer = authorizer;
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    this.applicationConfig = config;
    this.pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(
            config.getPipelineServiceClientConfiguration());

    this.jwtFilter =
        new JwtFilter(
            SecurityConfigurationManager.getCurrentAuthConfig(),
            SecurityConfigurationManager.getCurrentAuthzConfig());
    this.isNlqEnabled =
        config.getElasticSearchConfiguration().getNaturalLanguageSearch() != null
            ? config.getElasticSearchConfiguration().getNaturalLanguageSearch().getEnabled()
            : false;
  }

  public static class SettingsList extends ResultList<Settings> {
    /* Required for serde */
  }

  public SearchSettings readDefaultSearchSettings() {
    if (defaultSearchSettingsCache != null) {
      try {
        List<String> jsonDataFiles =
            EntityUtil.getJsonDataResources(".*json/data/settings/searchSettings.json$");
        if (!jsonDataFiles.isEmpty()) {
          String json =
              CommonUtil.getResourceAsStream(
                  EntityRepository.class.getClassLoader(), jsonDataFiles.get(0));
          defaultSearchSettingsCache = JsonUtils.readValue(json, SearchSettings.class);
        } else {
          throw new IllegalArgumentException("Default search settings file not found.");
        }
      } catch (IOException e) {
        LOG.error("Failed to read default search settings. Message: {}", e.getMessage(), e);
      }
    }
    return defaultSearchSettingsCache;
  }

  public SearchSettings loadDefaultSearchSettings(boolean force) {
    SearchSettings searchSettings = readDefaultSearchSettings();
    if (!force) {
      Settings existingSettings =
          systemRepository.getConfigWithKey(String.valueOf(SEARCH_SETTINGS));
      if (existingSettings != null && existingSettings.getConfigValue() != null) {
        SearchSettings existingSearchSettings = (SearchSettings) existingSettings.getConfigValue();
        if (existingSearchSettings.getGlobalSettings() != null) {
          return searchSettings;
        }
      }
    }
    Settings settings =
        new Settings().withConfigType(SettingsType.SEARCH_SETTINGS).withConfigValue(searchSettings);
    systemRepository.createOrUpdate(settings);
    LOG.info("Default searchSettings loaded successfully.");
    return searchSettings;
  }

  @GET
  @Path("/settings")
  @Operation(
      operationId = "listSettings",
      summary = "List all settings",
      description = "Get a list of all OpenMetadata settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SettingsList.class)))
      })
  public ResultList<Settings> list(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    ResultList<Settings> allConfigs = systemRepository.listAllConfigs();

    // Filter out authenticationConfiguration and authorizerConfiguration
    List<Settings> filteredSettings = new ArrayList<>();
    if (allConfigs != null && allConfigs.getData() != null) {
      for (Settings setting : allConfigs.getData()) {
        if (setting.getConfigType() != AUTHENTICATION_CONFIGURATION
            && setting.getConfigType() != AUTHORIZER_CONFIGURATION) {
          filteredSettings.add(setting);
        }
      }
    }

    return new ResultList<>(filteredSettings, null, null, filteredSettings.size());
  }

  @GET
  @Path("/settings/{name}")
  @Operation(
      operationId = "getSetting",
      summary = "Get a setting",
      description = "Get a OpenMetadata Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Settings.class)))
      })
  public Settings getSettingByName(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the setting", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    // Restrict access to authentication and authorizer configurations
    if (name.equalsIgnoreCase(AUTHENTICATION_CONFIGURATION.value())
        || name.equalsIgnoreCase(AUTHORIZER_CONFIGURATION.value())) {
      throw new SystemSettingsException(
          "Access to authentication and authorizer configurations is not allowed through this endpoint");
    }

    if (!name.equalsIgnoreCase(LINEAGE_SETTINGS.toString())) {
      authorizer.authorizeAdmin(securityContext);
    }
    return systemRepository.getConfigWithKey(name);
  }

  @GET
  @Path("/settings/entityRulesSettings/{entityType}")
  @Operation(
      operationId = "getEntityRulesSetting",
      summary = "Get a setting for an entity type",
      description = "Get the list of available entity rules settings for a given entity type",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Settings.class)))
      })
  public List<SemanticsRule> getEntityRulesSettingByType(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Entity Type", schema = @Schema(type = "string"))
          @PathParam("entityType")
          String entityType) {
    return SettingsCache.getSetting(SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class)
        .getEntitySemantics()
        .stream()
        .filter(SemanticsRule::getEnabled)
        .filter(
            rule ->
                rule.getEntityType() == null || rule.getEntityType().equalsIgnoreCase(entityType))
        .filter(
            rule ->
                nullOrEmpty(rule.getIgnoredEntities())
                    || !rule.getIgnoredEntities().contains(entityType))
        .toList();
  }

  @GET
  @Path("/search/nlq")
  @Operation(
      operationId = "",
      summary = "Check if Nlq is enabled in elastic search setting",
      description = "Check if Nlq is enabled in elastic search setting",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Boolean Nlq Service",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Settings.class)))
      })
  public Response checkSearchSettings(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    return Response.ok().entity(isNlqEnabled).build();
  }

  @GET
  @Path("/search/fitness")
  @Hidden
  @Operation(
      operationId = "getSearchClusterFitness",
      hidden = true,
      summary = "Diagnose whether the search cluster is sized for current data",
      description =
          "Internal admin-only diagnostic. Returns a structured fitness report covering cluster "
              + "status, per-index data footprint (size + average doc bytes), disk watermarks, "
              + "heap/CPU, thread-pool rejections, circuit breaker trips, shard layout, and "
              + "capacity recommendations. Not part of the public API surface.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Search cluster fitness report",
            content =
                @Content(
                    mediaType = "application/json",
                    schema =
                        @Schema(
                            implementation =
                                org.openmetadata.service.search.fitness.SearchClusterFitnessReport
                                    .class)))
      })
  public Response getSearchClusterFitness(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    org.openmetadata.service.search.fitness.SearchClusterFitnessAnalyzer analyzer =
        new org.openmetadata.service.search.fitness.SearchClusterFitnessAnalyzer(
            Entity.getSearchRepository());
    org.openmetadata.service.search.fitness.SearchClusterFitnessReport report = analyzer.analyze();
    return Response.ok().entity(report).build();
  }

  @GET
  @Path("/settings/profilerConfiguration")
  @Operation(
      operationId = "getProfilerConfigurationSetting",
      summary = "Get profiler configuration setting",
      description = "Get a profiler configuration Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Settings.class)))
      })
  public Settings getProfilerConfigurationSetting(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(
              description = "Entity type for which to get the global profiler configuration",
              schema = @Schema(type = "string"))
          @QueryParam("entityType")
          @DefaultValue("table")
          String entityType) {
    ResourceContext resourceContext = new ResourceContext(entityType);
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_PROFILER_GLOBAL_CONFIGURATION);
    authorizer.authorize(securityContext, operationContext, resourceContext);
    return systemRepository.getConfigWithKey(SettingsType.PROFILER_CONFIGURATION.value());
  }

  @GET
  @Path("/settings/customLogicOps")
  @Operation(
      operationId = "getCustomLogicOps",
      summary = "Get a list of custom JSON logic operations",
      description = "Get a list of custom JSON logic operations used in rules",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Custom Logic Operations Keys as Strings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Settings.class)))
      })
  public Response getCustomLogicOps(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext) {
    return Response.ok().entity(LogicOps.getCustomOpsKeys()).build();
  }

  @PUT
  @Path("/settings")
  @Operation(
      operationId = "createOrUpdate",
      summary = "Update setting",
      description = "Update existing settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Settings.class)))
      })
  public Response createOrUpdateSetting(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid Settings settingName) {
    // Restrict updating authentication and authorizer configurations
    if (settingName.getConfigType() == AUTHENTICATION_CONFIGURATION
        || settingName.getConfigType() == AUTHORIZER_CONFIGURATION) {
      throw new SystemSettingsException(
          "Access to authentication and authorizer configurations is not allowed through this endpoint");
    }

    authorizer.authorizeAdmin(securityContext);
    if (SettingsType.SEARCH_SETTINGS
        .value()
        .equalsIgnoreCase(settingName.getConfigType().toString())) {
      SearchSettings defaultSearchSettings = loadDefaultSearchSettings(false);
      SearchSettings incomingSearchSettings =
          JsonUtils.convertValue(settingName.getConfigValue(), SearchSettings.class);
      searchSettingsHandler.validateGlobalSettings(incomingSearchSettings.getGlobalSettings());
      SearchSettings mergedSettings =
          searchSettingsHandler.mergeSearchSettings(defaultSearchSettings, incomingSearchSettings);
      settingName.setConfigValue(mergedSettings);

      if (mergedSettings.getGlobalSettings() != null
          && mergedSettings.getGlobalSettings().getKeywordWeight() != null
          && mergedSettings.getGlobalSettings().getSemanticWeight() != null) {
        try {
          Entity.getSearchRepository()
              .updateHybridSearchPipeline(
                  mergedSettings.getGlobalSettings().getKeywordWeight(),
                  mergedSettings.getGlobalSettings().getSemanticWeight());
        } catch (Exception e) {
          LOG.error("Failed to update hybrid search pipeline", e);
          throw new SystemSettingsException(
              "Failed to update hybrid search pipeline: " + e.getMessage());
        }
      }
    }

    if (GLOSSARY_TERM_RELATION_SETTINGS
        .value()
        .equalsIgnoreCase(settingName.getConfigType().toString())) {
      GlossaryTermRelationSettings relationSettings =
          JsonUtils.convertValue(settingName.getConfigValue(), GlossaryTermRelationSettings.class);
      normalizeGlossaryTermRelationSettings(relationSettings);
      settingName.setConfigValue(relationSettings);
      validateGlossaryTermRelationSettingsUpdate(settingName);
    }
    Response response = systemRepository.createOrUpdate(settingName);
    SettingsCache.invalidateSettings(settingName.getConfigType().value());

    return response;
  }

  @PUT
  @Path("/settings/reset/{name}")
  @Operation(
      operationId = "resetSettingToDefault",
      summary = "Reset a setting to default",
      description = "Reset the specified setting to its default value.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Settings reset to default",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = Settings.class)))
      })
  public Response resetSettingToDefault(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Name of the setting", schema = @Schema(type = "string"))
          @PathParam("name")
          String name) {
    // Restrict resetting authentication and authorizer configurations
    if (name.equalsIgnoreCase(AUTHENTICATION_CONFIGURATION.value())
        || name.equalsIgnoreCase(AUTHORIZER_CONFIGURATION.value())) {
      throw new SystemSettingsException(
          "Access to authentication and authorizer configurations is not allowed through this endpoint");
    }

    authorizer.authorizeAdmin(securityContext);

    if (!SettingsType.SEARCH_SETTINGS.value().equalsIgnoreCase(name)) {
      throw new SystemSettingsException("Resetting of setting '" + name + "' is not supported.");
    }
    SearchSettings settings = loadDefaultSearchSettings(true);
    return Response.ok(settings).build();
  }

  @PUT
  @Path("/email/test")
  @Operation(
      operationId = "sendTestEmail",
      summary = "Sends a Test Email",
      description = "Sends a Test Email with Provided Settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "EmailTest",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = String.class)))
      })
  public Response sendTestEmail(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid EmailRequest emailRequest) {
    if (nullOrEmpty(emailRequest.getEmail())) {
      throw new IllegalArgumentException("Email address is required.");
    }

    authorizer.authorizeAdmin(securityContext);

    try {
      EmailUtil.testConnection();
      EmailUtil.sendTestEmail(emailRequest.getEmail(), false);
    } catch (Exception ex) {
      LOG.error("Failed in sending mail. Message: {}", ex.getMessage(), ex);
      throw new UnhandledServerException(ex.getMessage());
    }

    return Response.status(Response.Status.OK).entity("Test Email Sent Successfully.").build();
  }

  @PATCH
  @Path("/settings/{settingName}")
  @Operation(
      operationId = "patchSetting",
      summary = "Patch a setting",
      description = "Update an existing Setting using JsonPatch.",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patch(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "Key of the Setting", schema = @Schema(type = "string"))
          @PathParam("settingName")
          String settingName,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    // Restrict patching authentication and authorizer configurations
    if (settingName.equalsIgnoreCase(AUTHENTICATION_CONFIGURATION.value())
        || settingName.equalsIgnoreCase(AUTHORIZER_CONFIGURATION.value())) {
      throw new SystemSettingsException(
          "Access to authentication and authorizer configurations is not allowed through this endpoint");
    }

    authorizer.authorizeAdmin(securityContext);
    return systemRepository.patchSetting(settingName, patch);
  }

  @GET
  @Path("/entities/count")
  @Operation(
      operationId = "listEntitiesCount",
      summary = "List all entities counts",
      description = "Get a list of all entities count",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Entities Count",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = EntitiesCount.class)))
      })
  public EntitiesCount listEntitiesCount(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    return systemRepository.getAllEntitiesCount(filter);
  }

  @GET
  @Path("/services/count")
  @Operation(
      operationId = "listServicesCount",
      summary = "List all services counts",
      description = "Get a list of all entities count",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "List of Services Count",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ServicesCount.class)))
      })
  public ServicesCount listServicesCount(
      @Context UriInfo uriInfo,
      @Parameter(
              description = "Include all, deleted, or non-deleted entities.",
              schema = @Schema(implementation = Include.class))
          @QueryParam("include")
          @DefaultValue("non-deleted")
          Include include) {
    ListFilter filter = new ListFilter(include);
    return systemRepository.getAllServicesCount(filter);
  }

  @GET
  @Path("/status")
  @Operation(
      operationId = "validateDeployment",
      summary = "Validate the OpenMetadata deployment",
      description =
          "Check connectivity against your database, elasticsearch/opensearch, migrations,...",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "validation OK",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = ServicesCount.class)))
      })
  public ValidationResponse validate() {
    return systemRepository.validateSystem(applicationConfig, pipelineServiceClient, jwtFilter);
  }

  @GET
  @Path("/health")
  @Operation(
      operationId = "healthCheck",
      summary = "Health check endpoint",
      description =
          "Pure process-aliveness probe — returns 200 OK as long as the JVM can run this"
              + " handler and Jetty can serve a response. Intentionally does NOT probe the"
              + " database, search backend, cache, or any other downstream system. Coupling"
              + " the liveness probe to downstream latency creates restart loops: a slow"
              + " (but otherwise healthy) database trips the probe, kubelet kills the pod,"
              + " the new pod cold-starts and re-storms the database, and the cycle"
              + " accelerates. Killing the process never speeds up the database.\n\n"
              + "If you need DB/cache health visibility for routing decisions, use a"
              + " separate readiness probe (which doesn't trigger a pod kill) or scrape"
              + " HikariCP pool stats from the metrics endpoint.\n\n"
              + "For production, prefer the admin-port `/healthcheck` over this endpoint —"
              + " admin runs on its own thread pool insulated from API saturation.",
      responses = {@ApiResponse(responseCode = "200", description = "Service is healthy")})
  public Response healthCheck() {
    return Response.ok("OK").build();
  }

  @GET
  @Path("/security/config")
  @Operation(
      operationId = "getSecurityConfig",
      summary = "Get complete security configuration",
      description = "Get both authentication and authorization configuration",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Security Configuration",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityConfiguration.class)))
      })
  public SecurityConfiguration getSecurityConfig(@Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    SecurityConfiguration originalConfig =
        SecurityConfigurationManager.getInstance().getCurrentSecurityConfig();

    // Create a deep copy to avoid mutating the original shared objects
    String configJson = JsonUtils.pojoToJson(originalConfig);
    SecurityConfiguration config = JsonUtils.readValue(configJson, SecurityConfiguration.class);

    // Apply password masking if needed - only to the copy
    if (authorizer.shouldMaskPasswords(securityContext)) {
      // Mask OIDC configuration if present
      if (config.getAuthenticationConfiguration() != null
          && config.getAuthenticationConfiguration().getOidcConfiguration() != null) {
        config
            .getAuthenticationConfiguration()
            .getOidcConfiguration()
            .setSecret(PasswordEntityMasker.PASSWORD_MASK);
      }

      // Mask LDAP configuration if present
      if (config.getAuthenticationConfiguration() != null
          && config.getAuthenticationConfiguration().getLdapConfiguration() != null) {
        config
            .getAuthenticationConfiguration()
            .getLdapConfiguration()
            .setDnAdminPassword(PasswordEntityMasker.PASSWORD_MASK);
      }
    }
    return config;
  }

  @PUT
  @Path("/security/config")
  @Operation(
      operationId = "updateSecurityConfig",
      summary = "Update complete security configuration",
      description = "Update both authentication and authorization configuration atomically",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Updated Security Configuration",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityConfiguration.class)))
      })
  public Response updateSecurityConfig(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Valid SecurityConfiguration securityConfig) {
    authorizer.authorizeAdmin(securityContext);

    try {
      AuthenticationConfiguration authConfig = securityConfig.getAuthenticationConfiguration();

      // Auto-populate publicKeyUrls for OIDC confidential clients before saving
      systemRepository.autoPopulatePublicKeyUrlsIfNeeded(authConfig);

      // Update both configurations in a transaction
      Settings authSettings =
          new Settings().withConfigType(AUTHENTICATION_CONFIGURATION).withConfigValue(authConfig);

      Settings authzSettings =
          new Settings()
              .withConfigType(AUTHORIZER_CONFIGURATION)
              .withConfigValue(securityConfig.getAuthorizerConfiguration());

      // Save both to database
      systemRepository.createOrUpdate(authSettings);
      systemRepository.createOrUpdate(authzSettings);

      // Invalidate both caches
      SettingsCache.invalidateSettings(AUTHENTICATION_CONFIGURATION.toString());
      SettingsCache.invalidateSettings(AUTHORIZER_CONFIGURATION.toString());

      // Reload entire security system
      SecurityConfigurationManager.getInstance().reloadSecuritySystem();

      return Response.ok(securityConfig).build();
    } catch (Exception e) {
      LOG.error("Failed to update security configuration", e);
      throw new RuntimeException("Failed to update security configuration: " + e.getMessage());
    }
  }

  @PATCH
  @Path("/security/config")
  @Operation(
      operationId = "patchSecurityConfig",
      summary = "Patch security configuration",
      description = "Update security configuration using JsonPatch with validation and reload",
      externalDocs =
          @ExternalDocumentation(
              description = "JsonPatch RFC",
              url = "https://tools.ietf.org/html/rfc6902"))
  @Consumes(MediaType.APPLICATION_JSON_PATCH_JSON)
  public Response patchSecurityConfig(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @RequestBody(
              description = "JsonPatch with array of operations",
              content =
                  @Content(
                      mediaType = MediaType.APPLICATION_JSON_PATCH_JSON,
                      examples = {
                        @ExampleObject("[{op:remove, path:/a},{op:add, path: /b, value: val}]")
                      }))
          JsonPatch patch) {
    authorizer.authorizeAdmin(securityContext);

    try {
      SecurityConfiguration originalConfig =
          SecurityConfigurationManager.getInstance().getCurrentSecurityConfig();

      String configJson = JsonUtils.pojoToJson(originalConfig);
      SecurityConfiguration currentConfig =
          JsonUtils.readValue(configJson, SecurityConfiguration.class);

      JsonPatch filteredPatch = systemRepository.filterInvalidPatchOperations(patch, currentConfig);

      JsonValue patched = JsonUtils.applyPatch(currentConfig, filteredPatch);
      String jsonString = patched.toString();
      SecurityConfiguration updatedConfig =
          JsonUtils.readValue(jsonString, SecurityConfiguration.class);

      String currentUsername = SecurityUtil.getUserName(securityContext);
      SecurityValidationResponse validationResponse =
          systemRepository.validateSecurityConfiguration(
              updatedConfig, applicationConfig, currentUsername);

      boolean isValidConfig =
          validationResponse.getStatus() == SecurityValidationResponse.Status.SUCCESS;

      if (!isValidConfig) {
        // Consolidate all error messages for logging
        List<String> failedMessages = new ArrayList<>();
        if (validationResponse.getErrors() != null) {
          for (var error : validationResponse.getErrors()) {
            failedMessages.add(error.getField() + ": " + error.getError());
          }
        }

        // Log the errors
        if (!failedMessages.isEmpty()) {
          LOG.error(
              "Security configuration validation failed: {}", String.join("; ", failedMessages));
        }

        return Response.status(Response.Status.BAD_REQUEST).entity(validationResponse).build();
      }
      Settings authSettings =
          new Settings()
              .withConfigType(AUTHENTICATION_CONFIGURATION)
              .withConfigValue(updatedConfig.getAuthenticationConfiguration());

      Settings authzSettings =
          new Settings()
              .withConfigType(AUTHORIZER_CONFIGURATION)
              .withConfigValue(updatedConfig.getAuthorizerConfiguration());

      systemRepository.createOrUpdate(authSettings);
      systemRepository.createOrUpdate(authzSettings);

      SettingsCache.invalidateSettings(AUTHENTICATION_CONFIGURATION.toString());
      SettingsCache.invalidateSettings(AUTHORIZER_CONFIGURATION.toString());

      SecurityConfigurationManager.getInstance().reloadSecuritySystem();
      return Response.noContent().build();
    } catch (Exception e) {
      LOG.error("Failed to patch security configuration", e);
      throw new RuntimeException("Failed to patch security configuration: " + e.getMessage());
    }
  }

  @POST
  @Path("/security/validate")
  @Operation(
      operationId = "validateSecurityConfig",
      summary = "Validate security configuration",
      description = "Test the security configuration before applying it",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Security configuration validation results",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = SecurityValidationResponse.class)))
      })
  public SecurityValidationResponse validateSecurityConfig(
      @Context SecurityContext securityContext, @Valid SecurityConfiguration securityConfig) {
    authorizer.authorizeAdmin(securityContext);
    String currentUsername = SecurityUtil.getUserName(securityContext);
    return systemRepository.validateSecurityConfiguration(
        securityConfig, applicationConfig, currentUsername);
  }

  @GET
  @Path("/mcp/config")
  @Operation(
      operationId = "getMCPConfiguration",
      summary = "Get MCP server configuration",
      description =
          "Get the current MCP server configuration including base URL, allowed origins, and timeout settings",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "MCP configuration",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MCPConfiguration.class))),
        @ApiResponse(responseCode = "403", description = "Forbidden")
      })
  public Response getMCPConfiguration(@Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);
    Settings mcpSettings = systemRepository.getConfigWithKey(MCP_CONFIGURATION.toString());
    if (mcpSettings != null && mcpSettings.getConfigValue() != null) {
      return Response.ok(mcpSettings.getConfigValue()).build();
    }
    return Response.status(Response.Status.NOT_FOUND).entity("MCP configuration not found").build();
  }

  @PUT
  @Path("/mcp/config")
  @Operation(
      operationId = "updateMCPConfiguration",
      summary = "Update MCP server configuration",
      description =
          "Update MCP server configuration. Changes take effect after server reload. "
              + "Note: Updating MCP configuration will reload the security system to apply changes.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "MCP configuration updated successfully",
            content =
                @Content(
                    mediaType = "application/json",
                    schema = @Schema(implementation = MCPConfiguration.class))),
        @ApiResponse(responseCode = "400", description = "Invalid configuration"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
      })
  public Response updateMCPConfiguration(
      @Context SecurityContext securityContext, @Valid MCPConfiguration mcpConfig) {
    authorizer.authorizeAdmin(securityContext);

    try {
      // Validate baseUrl
      if (mcpConfig.getBaseUrl() != null && !mcpConfig.getBaseUrl().isEmpty()) {
        try {
          java.net.URI uri = new java.net.URI(mcpConfig.getBaseUrl());
          if (!uri.getScheme().matches("https?")) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity("baseUrl must use HTTP or HTTPS scheme")
                .build();
          }
        } catch (java.net.URISyntaxException e) {
          return Response.status(Response.Status.BAD_REQUEST)
              .entity("Invalid baseUrl: " + e.getMessage())
              .build();
        }
      }

      // Validate allowedOrigins
      if (mcpConfig.getAllowedOrigins() != null) {
        for (String origin : mcpConfig.getAllowedOrigins()) {
          if (origin.contains("*") && !origin.equals("*")) {
            return Response.status(Response.Status.BAD_REQUEST)
                .entity(
                    "Wildcard origins must be exactly '*', not partial wildcards like '"
                        + origin
                        + "'")
                .build();
          }
          if (!origin.equals("*")) {
            try {
              new java.net.URI(origin);
            } catch (java.net.URISyntaxException e) {
              return Response.status(Response.Status.BAD_REQUEST)
                  .entity("Invalid origin URL '" + origin + "': " + e.getMessage())
                  .build();
            }
          }
        }
      }

      Settings mcpSettings =
          new Settings().withConfigType(MCP_CONFIGURATION).withConfigValue(mcpConfig);

      systemRepository.createOrUpdate(mcpSettings);

      SettingsCache.invalidateSettings(MCP_CONFIGURATION.toString());

      SecurityConfigurationManager.getInstance().reloadSecuritySystem();

      return Response.ok(mcpConfig).build();
    } catch (Exception e) {
      LOG.error("Failed to update MCP configuration", e);
      return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
          .entity("Failed to update MCP configuration. Please check server logs for details.")
          .build();
    }
  }

  @GET
  @Path("/cache/stats")
  @Operation(
      operationId = "getCacheStats",
      summary = "Get cache statistics",
      description = "Get cache statistics including hit rates and sizes",
      responses = {
        @ApiResponse(responseCode = "200", description = "Cache statistics"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
      })
  public Response getCacheStats(@Context SecurityContext securityContext) {
    authorizer.authorizeAdmin(securityContext);

    CacheProvider cacheProvider = CacheBundle.getCacheProvider();
    Map<String, Object> stats = cacheProvider.getStats();
    // Gate on the *configured* provider, not the runtime available() flag. When the cache
    // is configured but temporarily unavailable (circuit breaker tripped, init failed,
    // Redis restarting) the app-level CacheMetrics counters are still meaningful for
    // diagnosing the outage — that's exactly when an operator wants to inspect them.
    // We only suppress the metrics block when CACHE_PROVIDER=none because the metrics
    // singleton is never initialized in that mode and CacheMetrics.getInstance() would
    // log a WARN on every poll.
    CacheConfig cacheConfig = CacheBundle.getCacheConfig();
    boolean cacheConfigured =
        cacheConfig != null && cacheConfig.provider != CacheConfig.Provider.none;
    if (cacheConfigured) {
      CacheMetrics metrics = CacheMetrics.getInstance();
      if (metrics != null) {
        stats.put("metrics", metrics.snapshot());
      }
    }
    return Response.ok(stats).build();
  }

  // Minimum literal prefix required on cache patterns before the first wildcard. Stops a
  // careless or malicious admin from issuing `*` / `om:*` (broad scans/deletes that can
  // block the Redis cluster on a large keyspace). Tuned to require at least `om:<env>:<layer>:`
  // worth of literal context — i.e. ~6 characters before any wildcard.
  private static final int CACHE_PATTERN_MIN_LITERAL_PREFIX = 6;

  // Disallow patterns that are pure wildcards or have a tiny literal prefix. ReDoS-safe:
  // single linear scan; no backtracking.
  private static String validateCachePattern(String pattern) {
    if (pattern == null || pattern.isBlank()) {
      return "pattern query param required";
    }
    int firstWildcard = -1;
    for (int i = 0; i < pattern.length(); i++) {
      char c = pattern.charAt(i);
      if (c == '*' || c == '?' || c == '[') {
        firstWildcard = i;
        break;
      }
    }
    int literalPrefixLen = firstWildcard < 0 ? pattern.length() : firstWildcard;
    if (literalPrefixLen < CACHE_PATTERN_MIN_LITERAL_PREFIX) {
      return "pattern must have at least "
          + CACHE_PATTERN_MIN_LITERAL_PREFIX
          + " literal characters before any wildcard (got "
          + literalPrefixLen
          + ")";
    }
    return null;
  }

  @GET
  @Path("/cache/keys")
  @Operation(
      operationId = "scanCacheKeys",
      summary = "SCAN keys matching a pattern (admin)",
      description =
          "Issues a Redis SCAN with the given glob-style pattern (e.g.,"
              + " 'om:prod:e:table:*') and returns the total match count. The"
              + " pattern must have at least 6 literal characters before any"
              + " wildcard (enforced by validateCachePattern) so unbounded scans"
              + " like '*' or 'om:*' are rejected. Returns -1 count if the cache"
              + " provider doesn't support SCAN (Noop).",
      responses = {
        @ApiResponse(responseCode = "200", description = "Match count"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
      })
  public Response scanCacheKeys(
      @Context SecurityContext securityContext, @QueryParam("pattern") String pattern) {
    authorizer.authorizeAdmin(securityContext);
    String invalid = validateCachePattern(pattern);
    if (invalid != null) {
      return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("error", invalid)).build();
    }
    long count = CacheBundle.getCacheProvider().scanCount(pattern);
    return Response.ok(Map.of("pattern", pattern, "count", count)).build();
  }

  @POST
  @Path("/cache/invalidate")
  @Operation(
      operationId = "invalidateCacheByPattern",
      summary = "Invalidate cache keys matching a pattern (admin)",
      description =
          "Issues a Redis SCAN+UNLINK against the supplied pattern. Use sparingly and with a"
              + " precise pattern; broad globs (e.g., 'om:prod:*') block the cluster on a"
              + " large keyspace. Returns the number of keys deleted, or 0 if the provider"
              + " doesn't support pattern deletion (Noop).",
      responses = {
        @ApiResponse(responseCode = "200", description = "Number of keys deleted"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
      })
  public Response invalidateCacheByPattern(
      @Context SecurityContext securityContext, @QueryParam("pattern") String pattern) {
    authorizer.authorizeAdmin(securityContext);
    String invalid = validateCachePattern(pattern);
    if (invalid != null) {
      return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("error", invalid)).build();
    }
    long deleted = CacheBundle.getCacheProvider().scanDelete(pattern);
    return Response.ok(Map.of("pattern", pattern, "deleted", deleted)).build();
  }

  @POST
  @Path("/cache/invalidate/entity")
  @Operation(
      operationId = "invalidateCacheForEntity",
      summary = "Invalidate every cache layer for a single entity (admin)",
      description =
          "Fans an invalidation out to every registered Invalidatable cache layer (lineage,"
              + " not-found, future layers). Use type+id, or type+fqn, or both. Effective on"
              + " all pods via the existing pub-sub channel.",
      responses = {
        @ApiResponse(responseCode = "200", description = "Invalidated"),
        @ApiResponse(responseCode = "403", description = "Forbidden")
      })
  public Response invalidateCacheForEntity(
      @Context SecurityContext securityContext,
      @QueryParam("type") String type,
      @QueryParam("id") String idStr,
      @QueryParam("fqn") String fqn) {
    authorizer.authorizeAdmin(securityContext);
    // Normalize empty/whitespace query params to null up front so a request like
    // `?type=X&id=&fqn=` doesn't slip past the required-params check on a non-null but
    // blank `id` and then fall through to "neither id nor fqn was actually supplied".
    String normalizedIdStr = (idStr == null || idStr.isBlank()) ? null : idStr;
    String normalizedFqn = (fqn == null || fqn.isBlank()) ? null : fqn;
    if (type == null || type.isBlank() || (normalizedIdStr == null && normalizedFqn == null)) {
      return Response.status(Response.Status.BAD_REQUEST)
          .entity(Map.of("error", "type and one of (id, fqn) are required"))
          .build();
    }
    UUID id = null;
    if (normalizedIdStr != null) {
      try {
        id = UUID.fromString(normalizedIdStr);
      } catch (IllegalArgumentException e) {
        return Response.status(Response.Status.BAD_REQUEST)
            .entity(Map.of("error", "id is not a valid UUID"))
            .build();
      }
    }
    // If the caller only supplied fqn, resolve to id so id-keyed cache layers (CachedLineage,
    // CACHE_WITH_ID, NotFoundCache id-side) can be invalidated too. Without this resolution
    // the endpoint silently misses those layers and the "invalidate every cache layer for this
    // entity" contract isn't met.
    //
    // Use fromCache=false: this is an admin force-invalidate path, so any stale signal from
    // L1, NotFoundCache, or the Redis L2 entity cache must not short-circuit the resolution.
    // The whole point of the endpoint is to recover from a poisoned cache state — going
    // straight to the DB guarantees we'll find the entity if it actually exists, even when
    // NotFoundCache mistakenly says it doesn't.
    //
    // Lookup failures (entity truly missing, FQN typo) are logged at DEBUG; the request still
    // proceeds with fqn-only invalidation. fqn-keyed layers benefit and an "invalidate
    // something that's gone" is harmless for the id-keyed layers.
    if (id == null && normalizedFqn != null) {
      try {
        EntityRepository<?> repository = Entity.getEntityRepository(type);
        EntityInterface resolved = repository.findByName(normalizedFqn, Include.ALL, false);
        if (resolved != null) {
          id = resolved.getId();
        }
      } catch (Exception lookupFailure) {
        LOG.debug(
            "Could not resolve id for type={} fqn={} during cache invalidation; "
                + "proceeding with fqn-only invalidation",
            type,
            normalizedFqn,
            lookupFailure);
      }
    }
    // Reach every cache layer that holds entries keyed by this entity:
    //   1. INVALIDATABLES registry (lineage cache, not-found cache, future Redis-backed layers)
    //      via CacheBundle.invalidateEntity.
    //   2. Guava L1 caches (CACHE_WITH_ID, CACHE_WITH_NAME) — the hot path on every entity
    //      GET; without explicit eviction here, an admin force-invalidate wouldn't actually
    //      take effect on the originating pod's in-memory cache. The static
    //      EntityRepository.invalidateCacheForEntity also propagates over the pub-sub channel
    //      to other pods so multi-replica deploys all evict simultaneously.
    CacheBundle.invalidateEntity(type, id, normalizedFqn);
    EntityRepository.invalidateCacheForEntity(type, id, normalizedFqn);
    return Response.ok(Map.of("invalidated", true, "type", type)).build();
  }

  private void validateGlossaryTermRelationSettingsUpdate(Settings newSettings) {
    Settings currentSettings =
        systemRepository.getConfigWithKey(GLOSSARY_TERM_RELATION_SETTINGS.value());
    if (currentSettings == null) {
      return;
    }

    GlossaryTermRelationSettings currentConfig =
        JsonUtils.convertValue(
            currentSettings.getConfigValue(), GlossaryTermRelationSettings.class);
    GlossaryTermRelationSettings newConfig =
        JsonUtils.convertValue(newSettings.getConfigValue(), GlossaryTermRelationSettings.class);

    if (currentConfig.getRelationTypes() == null || newConfig.getRelationTypes() == null) {
      return;
    }

    List<String> currentRelationTypeNames =
        currentConfig.getRelationTypes().stream().map(GlossaryTermRelationType::getName).toList();
    List<String> newRelationTypeNames =
        newConfig.getRelationTypes().stream().map(GlossaryTermRelationType::getName).toList();

    List<String> removedRelationTypes =
        currentRelationTypeNames.stream()
            .filter(name -> !newRelationTypeNames.contains(name))
            .toList();

    if (removedRelationTypes.isEmpty()) {
      return;
    }

    // System-defined relation types are part of the seeded contract and must never be deleted,
    // even when no glossary term currently references them. The "in-use" check below is not
    // enough on its own — a settings update submitted before any term uses the type would
    // otherwise silently strip it from the cached settings.
    List<String> removedSystemDefinedTypes =
        currentConfig.getRelationTypes().stream()
            .filter(rt -> !newRelationTypeNames.contains(rt.getName()))
            .filter(rt -> Boolean.TRUE.equals(rt.getIsSystemDefined()))
            .map(GlossaryTermRelationType::getName)
            .toList();

    if (!removedSystemDefinedTypes.isEmpty()) {
      throw new SystemSettingsException(
          "Cannot delete system-defined relation types: "
              + String.join(", ", removedSystemDefinedTypes));
    }

    GlossaryTermRepository glossaryTermRepository =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    Map<String, Integer> usageCounts = glossaryTermRepository.getRelationTypeUsageCounts();

    List<String> inUseRelationTypes =
        removedRelationTypes.stream()
            .filter(name -> usageCounts.getOrDefault(name, 0) > 0)
            .toList();

    if (!inUseRelationTypes.isEmpty()) {
      StringBuilder message = new StringBuilder("Cannot delete relation types that are in use: ");
      for (String relationTypeName : inUseRelationTypes) {
        int count = usageCounts.get(relationTypeName);
        message.append(
            String.format("%s (%d usage%s), ", relationTypeName, count, count == 1 ? "" : "s"));
      }
      message.setLength(message.length() - 2);
      throw new SystemSettingsException(message.toString());
    }
  }

  private void normalizeGlossaryTermRelationSettings(GlossaryTermRelationSettings settings) {
    if (settings == null || settings.getRelationTypes() == null) {
      return;
    }

    for (GlossaryTermRelationType relationType : settings.getRelationTypes()) {
      if (relationType == null) {
        continue;
      }

      RelationCardinality cardinality = relationType.getCardinality();
      if (cardinality == null) {
        relationType.setCardinality(
            deriveCardinality(relationType.getSourceMax(), relationType.getTargetMax()));
        continue;
      }

      switch (cardinality) {
        case ONE_TO_ONE -> {
          relationType.setSourceMax(1);
          relationType.setTargetMax(1);
        }
        case ONE_TO_MANY -> {
          relationType.setSourceMax(1);
          relationType.setTargetMax(null);
        }
        case MANY_TO_ONE -> {
          relationType.setSourceMax(null);
          relationType.setTargetMax(1);
        }
        case MANY_TO_MANY -> {
          relationType.setSourceMax(null);
          relationType.setTargetMax(null);
        }
        case CUSTOM -> {
          // Keep explicit values as-is.
        }
        default -> {
          // No-op for unknown values.
        }
      }
    }
  }

  private RelationCardinality deriveCardinality(Integer sourceMax, Integer targetMax) {
    if (sourceMax == null && targetMax == null) {
      return RelationCardinality.MANY_TO_MANY;
    }
    if (Integer.valueOf(1).equals(sourceMax) && Integer.valueOf(1).equals(targetMax)) {
      return RelationCardinality.ONE_TO_ONE;
    }
    if (Integer.valueOf(1).equals(sourceMax) && targetMax == null) {
      return RelationCardinality.ONE_TO_MANY;
    }
    if (sourceMax == null && Integer.valueOf(1).equals(targetMax)) {
      return RelationCardinality.MANY_TO_ONE;
    }
    return RelationCardinality.CUSTOM;
  }
}
