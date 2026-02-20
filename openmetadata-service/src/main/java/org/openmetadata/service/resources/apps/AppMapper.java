package org.openmetadata.service.resources.apps;

import static org.openmetadata.service.Entity.BOT;
import static org.openmetadata.service.jdbi3.EntityRepository.validateOwners;

import java.util.List;
import java.util.UUID;
import javax.validation.ConstraintViolationException;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.AppMarketPlaceRepository;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.EntityUtil;

public class AppMapper implements EntityMapper<App, CreateApp> {
  @Override
  public App createToEntity(CreateApp createAppRequest, String updatedBy) {
    AppMarketPlaceRepository appMarketPlaceRepository =
        (AppMarketPlaceRepository) Entity.getEntityRepository(Entity.APP_MARKET_PLACE_DEF);
    AppMarketPlaceDefinition marketPlaceDefinition =
        appMarketPlaceRepository.getByName(
            null,
            createAppRequest.getName(),
            new EntityUtil.Fields(appMarketPlaceRepository.getAllowedFields()));
    Boolean supportsIngestionRunner =
        !marketPlaceDefinition.getAppType().equals(AppType.Internal)
            && marketPlaceDefinition.getSupportsIngestionRunner();
    List<EntityReference> owners = validateOwners(createAppRequest.getOwners());
    App app =
        new App()
            .withId(UUID.randomUUID())
            .withName(marketPlaceDefinition.getName())
            .withDisplayName(createAppRequest.getDisplayName())
            .withDescription(createAppRequest.getDescription())
            .withOwners(owners)
            .withUpdatedBy(updatedBy)
            .withUpdatedAt(System.currentTimeMillis())
            .withDeveloper(marketPlaceDefinition.getDeveloper())
            .withDeveloperUrl(marketPlaceDefinition.getDeveloperUrl())
            .withPrivacyPolicyUrl(marketPlaceDefinition.getPrivacyPolicyUrl())
            .withSupportEmail(marketPlaceDefinition.getSupportEmail())
            .withClassName(marketPlaceDefinition.getClassName())
            .withAppType(marketPlaceDefinition.getAppType())
            .withAgentType(marketPlaceDefinition.getAgentType())
            .withScheduleType(marketPlaceDefinition.getScheduleType())
            .withAppConfiguration(createAppRequest.getAppConfiguration())
            .withRuntime(marketPlaceDefinition.getRuntime())
            .withPermission(marketPlaceDefinition.getPermission())
            .withAppSchedule(createAppRequest.getAppSchedule())
            .withAppLogoUrl(marketPlaceDefinition.getAppLogoUrl())
            .withAppScreenshots(marketPlaceDefinition.getAppScreenshots())
            .withFeatures(marketPlaceDefinition.getFeatures())
            .withSourcePythonClass(marketPlaceDefinition.getSourcePythonClass())
            .withAllowConfiguration(marketPlaceDefinition.getAllowConfiguration())
            .withAllowConcurrentExecution(marketPlaceDefinition.getAllowConcurrentExecution())
            .withSystem(marketPlaceDefinition.getSystem())
            .withSupportsInterrupt(marketPlaceDefinition.getSupportsInterrupt())
            .withFullyQualifiedName(marketPlaceDefinition.getFullyQualifiedName())
            .withSupportsIngestionRunner(supportsIngestionRunner)
            .withIngestionRunner(
                supportsIngestionRunner.equals(true)
                    ? createAppRequest.getIngestionRunner()
                    : null);

    // validate Bot if provided
    validateAndAddBot(
        app,
        createAppRequest.getBot(),
        Boolean.TRUE.equals(createAppRequest.getAllowBotImpersonation()));
    return app;
  }

  private void validateAndAddBot(App app, String botName, boolean allowBotImpersonation) {
    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    try {
      JsonUtils.validateJsonSchema(app, App.class);
    } catch (ConstraintViolationException e) {
      throw BadRequestException.of("Invalid App: " + e.getMessage());
    }
    if (!CommonUtil.nullOrEmpty(botName)) {
      // When referencing an existing bot, allowBotImpersonation cannot be applied since
      // impersonation is configured on the bot user, not the app. Reject this combination
      // to avoid silent misconfiguration where the flag is ignored.
      if (allowBotImpersonation) {
        throw BadRequestException.of(
            "allowBotImpersonation cannot be used with a custom bot reference. "
                + "Configure impersonation directly on the bot user instead.");
      }
      app.setBot(Entity.getEntityReferenceByName(BOT, botName, Include.NON_DELETED));
    } else {
      app.setBot(appRepository.createNewAppBot(app, allowBotImpersonation));
    }
  }
}
