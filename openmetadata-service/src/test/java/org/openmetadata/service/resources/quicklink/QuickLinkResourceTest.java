package org.openmetadata.service.resources.quicklink;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import javax.ws.rs.core.Response;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateQuickLink;
import org.openmetadata.schema.entity.data.QuickLink;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.util.JsonUtils;

class QuickLinkResourceTest extends EntityResourceTest<QuickLink, CreateQuickLink> {
  private final String QUICK_LINK_URL = "http://test.com";

  public QuickLinkResourceTest() {
    super(
        Entity.QUICK_LINK,
        QuickLink.class,
        QuickLinkResource.QuickLinkList.class,
        "quicklinks",
        QuickLinkResource.FIELDS);
    supportsSoftDelete = false;
  }

  @Test
  void post_valid_quick_link_test_created(TestInfo test) throws IOException {
    CreateQuickLink create = createRequest(getEntityName(test));
    createEntity(create, ADMIN_AUTH_HEADERS);
    assertNotNull(create);
  }

  @Test
  void post_without_uri_400(TestInfo test) {
    CreateQuickLink create = createRequest(getEntityName(test)).withUrl(null);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), Response.Status.BAD_REQUEST, "[url must not be null]");
  }

  @Test
  void post_same_quickLink_forSameEntityType_409(TestInfo test) throws HttpResponseException {
    CreateQuickLink create = createRequest(getEntityName(test));
    createEntity(create, ADMIN_AUTH_HEADERS);

    CreateQuickLink create1 = createRequest(getEntityName(test));

    assertResponse(() -> createEntity(create1, ADMIN_AUTH_HEADERS), Response.Status.CONFLICT, "Entity already exists");
  }

  @Test
  void patch_uri_200_ok(TestInfo test) throws IOException {
    CreateQuickLink create = createRequest(test);
    QuickLink quickLink = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    String json = JsonUtils.pojoToJson(quickLink);
    String updatedUrl = "http://testcase.com";
    quickLink.withUrl(URI.create(updatedUrl));
    QuickLink updatedQuickLink = patchEntity(quickLink.getId(), json, quickLink, ADMIN_AUTH_HEADERS);

    QuickLink getQuickLink = getEntity(quickLink.getId(), ADMIN_AUTH_HEADERS);

    assertEquals(getQuickLink.getUrl(), URI.create(updatedUrl));
  }

  @Override
  public CreateQuickLink createRequest(String name) {
    return new CreateQuickLink().withName(name).withOwner(USER1_REF).withUrl(URI.create(QUICK_LINK_URL));
  }

  @Override
  public void validateCreatedEntity(QuickLink createdEntity, CreateQuickLink request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(request.getUrl(), createdEntity.getUrl());
  }

  @Override
  public void compareEntities(QuickLink expected, QuickLink updated, Map<String, String> authHeaders)
      throws HttpResponseException {}

  @Override
  public QuickLink validateGetWithDifferentFields(QuickLink entity, boolean byName) throws HttpResponseException {
    String fields = "";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(entity.getOwner(), entity.getFollowers(), entity.getTags());
    fields = "owner,tags,followers";
    entity =
        byName
            ? getEntityByName(entity.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);
    return entity;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {}
}
