package org.openmetadata.service.resources.apps;

import jakarta.ws.rs.BadRequestException;
import java.util.Objects;
import javax.validation.ConstraintViolationException;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.CreateAppMarketPlaceDefinitionReq;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.apps.NativeApplication;
import org.openmetadata.service.mapper.EntityMapper;

public class AppMarketPlaceMapper
    implements EntityMapper<AppMarketPlaceDefinition, CreateAppMarketPlaceDefinitionReq> {
  private PipelineServiceClientInterface pipelineServiceClient;

  public AppMarketPlaceMapper(PipelineServiceClientInterface pipelineServiceClient) {
    this.pipelineServiceClient = pipelineServiceClient;
  }

  @Override
  public AppMarketPlaceDefinition createToEntity(
      CreateAppMarketPlaceDefinitionReq create, String user) {
    AppMarketPlaceDefinition app =
        copy(new AppMarketPlaceDefinition(), create, user)
            .withDeveloper(create.getDeveloper())
            .withDeveloperUrl(create.getDeveloperUrl())
            .withSupportEmail(create.getSupportEmail())
            .withPrivacyPolicyUrl(create.getPrivacyPolicyUrl())
            .withClassName(create.getClassName())
            .withClassName(validateAppClass(create.getClassName()))
            .withAppType(create.getAppType())
            .withAgentType(create.getAgentType())
            .withScheduleType(create.getScheduleType())
            .withRuntime(create.getRuntime())
            .withAppConfiguration(create.getAppConfiguration())
            .withPermission(create.getPermission())
            .withAppLogoUrl(create.getAppLogoUrl())
            .withAppScreenshots(create.getAppScreenshots())
            .withFeatures(create.getFeatures())
            .withSourcePythonClass(create.getSourcePythonClass())
            .withAllowConfiguration(create.getAllowConfiguration())
            .withSystem(create.getSystem())
            .withSupportsInterrupt(create.getSupportsInterrupt())
            .withEventSubscriptions(create.getEventSubscriptions());

    // Validate App
    validateApplication(app);
    return app;
  }

  private String validateAppClass(String className) {
    className =
        Objects.requireNonNull(className, "AppMarketPlaceDefinition.className cannot be null");
    if (!className.startsWith("org.openmetadata.") && !className.startsWith("io.collate.")) {
      throw new BadRequestException(
          "Only classes from org.openmetadata or io.collate packages are allowed: " + className);
    }
    try {
      Class<?> clazz = Class.forName(className);
      if (!NativeApplication.class.isAssignableFrom(clazz)) {
        throw new BadRequestException(
            "AppMarketPlaceDefinition.className must be a subclass of NativeApplication: "
                + className);
      }
      return className;
    } catch (ClassNotFoundException e) {
      throw new BadRequestException(
          "AppMarketPlaceDefinition.className class not found: " + className);
    }
  }

  private void validateApplication(AppMarketPlaceDefinition app) {
    try {
      JsonUtils.validateJsonSchema(app, AppMarketPlaceDefinition.class);
    } catch (ConstraintViolationException | NullPointerException e) {
      throw new BadRequestException(
          "Application Cannot be registered, because the AppMarketPlaceDefinition is not valid: "
              + e.getMessage());
    }
    if (app.getAppType().equals(AppType.External)) {
      PipelineServiceClientResponse response = pipelineServiceClient.validateAppRegistration(app);
      if (response.getCode() != 200) {
        throw new BadRequestException(
            String.format(
                "Application Cannot be registered, Error from Pipeline Service Client. Status Code : %s , Response : %s",
                response.getCode(), JsonUtils.pojoToJson(response)));
      }
    }
  }
}
