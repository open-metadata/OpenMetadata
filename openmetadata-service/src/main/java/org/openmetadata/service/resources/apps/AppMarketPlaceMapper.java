package org.openmetadata.service.resources.apps;

import java.util.Objects;
import javax.validation.ConstraintViolationException;
import javax.ws.rs.BadRequestException;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.CreateAppMarketPlaceDefinitionReq;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.JsonUtils;

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

  private void validateApplication(AppMarketPlaceDefinition app) {
    try {
      JsonUtils.validateJsonSchema(app, AppMarketPlaceDefinition.class);
      Class.forName(
          Objects.requireNonNull(
              app.getClassName(), "AppMarketPlaceDefinition.className cannot be null"));
    } catch (ClassNotFoundException e) {
      throw new BadRequestException(
          "Application Cannot be registered, because the Class cannot be found on the Classpath: "
              + app.getEventSubscriptions());
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
                "Application Cannot be registered, Error from Pipeline Service Client. Status Code : %s , Reponse : %s",
                response.getCode(), JsonUtils.pojoToJson(response)));
      }
    }
  }
}
