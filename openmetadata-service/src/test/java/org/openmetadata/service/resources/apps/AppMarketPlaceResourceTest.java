package org.openmetadata.service.resources.apps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.openmetadata.schema.entity.app.AppConfiguration;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.CreateAppMarketPlaceDefinitionReq;
import org.openmetadata.schema.entity.app.NativeAppPermission;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.app.ScheduledExecutionContext;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class AppMarketPlaceResourceTest
  extends EntityResourceTest<AppMarketPlaceDefinition, CreateAppMarketPlaceDefinitionReq> {

  public AppMarketPlaceResourceTest() {
    super(
      Entity.APP_MARKET_PLACE_DEF,
      AppMarketPlaceDefinition.class,
      AppMarketPlaceResource.AppMarketPlaceDefinitionList.class,
      "apps/marketplace",
      AppMarketPlaceResource.FIELDS
    );
    supportsFieldsQueryParam = false;
    supportedNameCharacters = "_-.";
  }

  @Override
  public CreateAppMarketPlaceDefinitionReq createRequest(String name) {
    try {
      return new CreateAppMarketPlaceDefinitionReq()
        .withName(name)
        .withOwner(USER1_REF)
        .withDeveloper("OM")
        .withDeveloperUrl("https://test.com")
        .withSupportEmail("test@openmetadata.org")
        .withPrivacyPolicyUrl("https://privacy@openmetadata.org")
        .withClassName("org.openmetadata.service.apps.bundles.test.NoOpTestApplication")
        .withAppType(AppType.Internal)
        .withScheduleType(ScheduleType.Scheduled)
        .withRuntime(new ScheduledExecutionContext().withEnabled(true))
        .withAppConfiguration(new AppConfiguration().withAdditionalProperty("test", "20"))
        .withPermission(NativeAppPermission.All)
        .withAppLogoUrl(new URI("https://test.com"))
        .withAppScreenshots(new HashSet<>(List.of("AppLogo")))
        .withFeatures("App Features");
    } catch (URISyntaxException ex) {
      LOG.error("Encountered error in Create Request for AppMarketPlaceResourceTest for App Logo Url.");
    }
    return null;
  }

  @Override
  public void validateCreatedEntity(
    AppMarketPlaceDefinition createdEntity,
    CreateAppMarketPlaceDefinitionReq request,
    Map<String, String> authHeaders
  )
    throws HttpResponseException {}

  @Override
  public void compareEntities(
    AppMarketPlaceDefinition expected,
    AppMarketPlaceDefinition updated,
    Map<String, String> authHeaders
  )
    throws HttpResponseException {
    assertEquals(expected.getDeveloper(), updated.getDeveloper());
    assertEquals(expected.getDeveloperUrl(), updated.getDeveloperUrl());
    assertEquals(expected.getSupportEmail(), updated.getSupportEmail());
    assertEquals(expected.getPrivacyPolicyUrl(), updated.getPrivacyPolicyUrl());
    assertEquals(expected.getClassName(), updated.getClassName());
    assertEquals(expected.getAppType(), updated.getAppType());
    assertEquals(expected.getScheduleType(), updated.getScheduleType());
    assertEquals(expected.getAppConfiguration(), updated.getAppConfiguration());
    assertEquals(expected.getPermission(), updated.getPermission());
    assertEquals(expected.getAppLogoUrl(), updated.getAppLogoUrl());
    assertEquals(expected.getAppScreenshots(), updated.getAppScreenshots());
    assertEquals(expected.getAppScreenshots(), updated.getAppScreenshots());
    assertEquals(expected.getFeatures(), updated.getFeatures());
  }

  @Override
  public AppMarketPlaceDefinition validateGetWithDifferentFields(AppMarketPlaceDefinition entity, boolean byName)
    throws HttpResponseException {
    String fields = "";
    entity =
      byName
        ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
        : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNull(entity.getOwner());

    fields = "owner,tags";
    entity =
      byName
        ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
        : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
