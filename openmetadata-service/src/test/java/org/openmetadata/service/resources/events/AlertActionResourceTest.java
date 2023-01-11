package org.openmetadata.service.resources.events;

import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.events.CreateAlertAction;
import org.openmetadata.schema.entity.alerts.AlertAction;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.alerts.AlertActionResource;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Disabled
public class AlertActionResourceTest extends EntityResourceTest<AlertAction, CreateAlertAction> {

  public AlertActionResourceTest() {
    super(
        Entity.ALERT_ACTION,
        AlertAction.class,
        AlertActionResource.AlertActionList.class,
        "alertAction",
        AlertActionResource.FIELDS);
    supportsEmptyDescription = true;
    supportsSoftDelete = false;
  }

  public Webhook getWebhook(String name, String uri) {
    return new Webhook()
        .withName(name)
        .withDescription("Alert Action Webhook")
        .withEndpoint(URI.create(uri))
        .withSecretKey("webhookTest");
  }

  public CreateAlertAction createRequest(
      String name, AlertAction.AlertActionType type, Object alertActionConfig, boolean enabled) {
    return createRequest(name).withEnabled(enabled).withAlertActionType(type).withAlertActionConfig(alertActionConfig);
  }

  @Override
  public CreateAlertAction createRequest(String name) {
    String uri = "http://localhost:" + APP.getLocalPort() + "/api/v1/test/webhook/ignore";
    return new CreateAlertAction()
        .withName(name)
        .withAlertActionType(AlertAction.AlertActionType.GENERIC_WEBHOOK)
        .withEnabled(true)
        .withBatchSize(100)
        .withAlertActionConfig(getWebhook(name, uri));
  }

  @Override
  public void validateCreatedEntity(
      AlertAction createdEntity, CreateAlertAction request, Map<String, String> authHeaders) {}

  @Override
  public void compareEntities(AlertAction expected, AlertAction updated, Map<String, String> authHeaders) {}

  @Override
  public AlertAction validateGetWithDifferentFields(AlertAction entity, boolean byName) {
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {}

  @Test
  @Override
  protected void post_entityCreateWithInvalidName_400() {
    // Create an entity with mandatory name field null
    // Alert Action doesn't need name in creation it is randomly generated
    CreateAlertAction request = createRequest(null, "description", "displayName", null);
    try {
      AlertAction action = createEntity(request, ADMIN_AUTH_HEADERS);
      AlertAction getAction = getEntityByName(action.getName(), "name", ADMIN_AUTH_HEADERS);
      deleteEntity(action.getId(), ADMIN_AUTH_HEADERS);
    } catch (IOException ex) {
      LOG.error("Error while testing", ex);
    }
  }
}
