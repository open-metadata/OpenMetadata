package org.openmetadata.service.resources.quicklink;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNull;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.openmetadata.schema.api.data.CreateQuickLink;
import org.openmetadata.schema.entity.data.QuickLink;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;

public class QuickLinkResourceTest extends EntityResourceTest<QuickLink, CreateQuickLink> {
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
