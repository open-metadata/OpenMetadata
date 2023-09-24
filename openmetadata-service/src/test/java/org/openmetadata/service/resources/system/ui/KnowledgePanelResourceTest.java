package org.openmetadata.service.resources.system.ui;

import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.CoreMatchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.KNOWLEDGE_PANEL;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.system.ui.CreateKnowledgePanel;
import org.openmetadata.schema.api.system.ui.SupportedSize;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.system.ui.KnowledgePanel;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class KnowledgePanelResourceTest extends EntityResourceTest<KnowledgePanel, CreateKnowledgePanel> {
  public KnowledgePanelResourceTest() {
    super(
        KNOWLEDGE_PANEL,
        KnowledgePanel.class,
        KnowledgePanelResource.KnowledgePanelList.class,
        "system/ui/knowledgePanels",
        "");
    supportsSearchIndex = false;
    supportsFieldsQueryParam = false;
  }

  public void setupKnowledgePanels(TestInfo test) throws HttpResponseException {
    CreateKnowledgePanel createKnowledgePanel = createRequest(test, 1).withName("activityFeed");
    ACTIVITY_FEED = createEntity(createKnowledgePanel, ADMIN_AUTH_HEADERS);

    createKnowledgePanel = createRequest(test, 11).withName("myData");
    MY_DATA = createEntity(createKnowledgePanel, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_validKnowledgePanels_as_admin_200_OK(TestInfo test) throws IOException {
    // Create Persona with different optional fields
    CreateKnowledgePanel create = createRequest(test, 1);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 2).withDisplayName("displayName");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 3).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 4);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 5).withDisplayName("displayName").withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void delete_validKnowledgePanels_200_OK(TestInfo test) throws IOException {
    CreateKnowledgePanel create = createRequest(test);
    KnowledgePanel kp = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    deleteAndCheckEntity(kp, ADMIN_AUTH_HEADERS);
  }

  @Test
  void patch_kpAttributes_as_non_admin_403(TestInfo test) throws HttpResponseException {
    // Create team without any attributes
    KnowledgePanel knowledgePanel = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // Patching as a non-admin should be disallowed
    String originalJson = JsonUtils.pojoToJson(knowledgePanel);
    knowledgePanel.setDisplayName("newDisplayName");
    assertResponse(
        () -> patchEntity(knowledgePanel.getId(), originalJson, knowledgePanel, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.EDIT_DISPLAY_NAME)));
  }

  @Test
  void patch_knowledgePanelUpdatePersona_permission(TestInfo test) throws IOException {
    UserResourceTest userResourceTest = new UserResourceTest();
    List<EntityReference> userRefs = new ArrayList<>();
    for (int i = 0; i < 2; i++) {
      User user = userResourceTest.createEntity(userResourceTest.createRequest(test, i), ADMIN_AUTH_HEADERS);
      userRefs.add(user.getEntityReference());
    }
    KnowledgePanel kp = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    List<SupportedSize> currSizes =kp.getSupportedSizes();
    String originalJson = JsonUtils.pojoToJson(kp);
    kp.setSupportedSizes(List.of(SupportedSize.SMALL));
    // Ensure user without UpdateTeam permission cannot add users to a team.
    String randomUserName = userRefs.get(0).getName();
    assertResponse(
        () ->
            patchEntity(kp.getId(), originalJson, kp, SecurityUtil.authHeaders(randomUserName + "@open-metadata.org")),
        FORBIDDEN,
        permissionNotAllowed(randomUserName, List.of(MetadataOperation.EDIT_ALL)));

    // Ensure user with UpdateTeam permission can add users to a team.
    ChangeDescription change = getChangeDescription(kp.getVersion());
    fieldUpdated(change, "supportedSizes", currSizes, kp.getSupportedSizes());
    patchEntityAndCheck(kp, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  private static void validateKnowledgePanel(
      KnowledgePanel kp,
      String expectedDescription,
      String expectedDisplayName,
      List<SupportedSize> expectedSupportedSizes,
      String expectedUpdatedBy) {
    assertListNotNull(kp.getId(), kp.getHref());
    assertEquals(expectedDescription, kp.getDescription());
    assertEquals(expectedUpdatedBy, kp.getUpdatedBy());
    assertEquals(expectedDisplayName, kp.getDisplayName());
    assertEquals(expectedSupportedSizes, kp.getSupportedSizes());
  }

  @Override
  public CreateKnowledgePanel createRequest(String name) {
    return new CreateKnowledgePanel()
        .withName(name)
        .withSupportedSizes(List.of(SupportedSize.SMALL, SupportedSize.MEDIUM, SupportedSize.LARGE));
  }

  @Override
  public void validateCreatedEntity(
      KnowledgePanel knowledgePanel, CreateKnowledgePanel createRequest, Map<String, String> authHeaders) {}

  @Override
  public void compareEntities(KnowledgePanel expected, KnowledgePanel updated, Map<String, String> authHeaders) {
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    List<SupportedSize> expectedSizes = listOrEmpty(expected.getSupportedSizes());
    List<SupportedSize> actualSizes = listOrEmpty(updated.getSupportedSizes());
    assertEquals(expectedSizes, actualSizes);
  }

  @Override
  public KnowledgePanel validateGetWithDifferentFields(KnowledgePanel entity, boolean byName)
      throws HttpResponseException {
    return null;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("supportedSizes")) {
      List<String> actualSupportSizes = (List<String>) actual;
      for (SupportedSize e: (List<SupportedSize>) expected) {
        assertTrue(actualSupportSizes.contains(e.value()));
      }
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

}
