package org.openmetadata.service.resources.apps;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.BOT;
import static org.openmetadata.service.jdbi3.EntityRepository.validateOwners;

import com.nimbusds.jose.util.Pair;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.validation.ConstraintViolationException;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.entity.app.CreateAppSchedule;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.AppMarketPlaceRepository;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;

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
            .withAppSchedules(getAppSchedules(createAppRequest))
            .withAppLogoUrl(marketPlaceDefinition.getAppLogoUrl())
            .withAppScreenshots(marketPlaceDefinition.getAppScreenshots())
            .withFeatures(marketPlaceDefinition.getFeatures())
            .withSourcePythonClass(marketPlaceDefinition.getSourcePythonClass())
            .withAllowConfiguration(marketPlaceDefinition.getAllowConfiguration())
            .withSystem(marketPlaceDefinition.getSystem())
            .withSupportsInterrupt(marketPlaceDefinition.getSupportsInterrupt())
            .withFullyQualifiedName(marketPlaceDefinition.getFullyQualifiedName());

    // validate Bot if provided
    validateAndAddBot(app, createAppRequest.getBot());
    return app;
  }

  private List<AppSchedule> getAppSchedules(CreateApp createAppRequest) {
    return listOrEmpty(createAppRequest.getAppSchedules()).stream()
        .map(
            request ->
                Pair.of(
                    request,
                    Entity.getService(
                            null,
                            request.getService(),
                            new EntityUtil.Fields(Set.of("id")),
                            Include.NON_DELETED)
                        .getEntityReference()))
        .map(pair -> getAppSchedule(pair.getLeft(), pair.getRight()))
        .collect(Collectors.toList());
  }

  public AppSchedule getAppSchedule(CreateAppSchedule create, EntityReference service) {
    return new AppSchedule()
        .withId(UUID.randomUUID())
        .withService(service)
        .withScheduleTimeline(create.getScheduleTimeline())
        .withCronExpression(create.getCronExpression())
        .withConfig(create.getConfig());
  }

  private void validateAndAddBot(App app, String botName) {
    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    try {
      JsonUtils.validateJsonSchema(app, App.class);
    } catch (ConstraintViolationException e) {
      throw BadRequestException.of("Invalid App: " + e.getMessage());
    }
    if (!nullOrEmpty(botName)) {
      app.setBot(Entity.getEntityReferenceByName(BOT, botName, Include.NON_DELETED));
    } else {
      app.setBot(appRepository.createNewAppBot(app));
    }
  }
}
