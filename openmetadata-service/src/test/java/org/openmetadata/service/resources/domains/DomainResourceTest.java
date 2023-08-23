package org.openmetadata.service.resources.domains;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertEntityReferenceNames;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.domains.DomainResource.DomainList;
import org.openmetadata.service.util.JsonUtils;

public class DomainResourceTest extends EntityResourceTest<Domain, CreateDomain> {
  public DomainResourceTest() {
    super(Entity.DOMAIN, Domain.class, DomainList.class, "domains", DomainResource.FIELDS);
    supportsFieldsQueryParam = false; // TODO
  }

  @Override
  public CreateDomain createRequest(String name) {
    return new CreateDomain()
        .withName(name)
        .withDomainType(DomainType.AGGREGATE)
        .withExperts(listOf(USER1.getFullyQualifiedName()));
  }

  @Override
  public void validateCreatedEntity(Domain createdEntity, CreateDomain request, Map<String, String> authHeaders) {
    // Entity specific validation
    assertEquals(request.getDomainType(), createdEntity.getDomainType());
    assertReference(request.getParent(), createdEntity.getParent());
    assertEntityReferenceNames(request.getExperts(), createdEntity.getExperts());
  }

  @Override
  public void compareEntities(Domain expected, Domain updated, Map<String, String> authHeaders) {
    // Entity specific validation
    assertEquals(expected.getDomainType(), updated.getDomainType());
    assertReference(expected.getParent(), updated.getParent());
    assertEntityReferences(expected.getExperts(), updated.getExperts());
  }

  @Override
  public Domain validateGetWithDifferentFields(Domain domain, boolean byName) throws HttpResponseException {
    Domain getDomain =
        byName
            ? getEntityByName(domain.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(domain.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNotNull(getDomain.getDomainType());
    assertListNull(getDomain.getParent(), getDomain.getChildren(), getDomain.getOwner(), getDomain.getExperts());
    String fields = "children,owner,parent,experts";
    getDomain =
        byName
            ? getEntityByName(getDomain.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(getDomain.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(getDomain.getDomainType());
    // Fields requested are received
    assertEquals(domain.getParent(), getDomain.getParent());
    assertEntityReferences(domain.getChildren(), getDomain.getChildren());
    assertEntityReferences(domain.getExperts(), getDomain.getExperts());

    // Checks for other owner, tags, and followers is done in the base class
    return getDomain;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.startsWith("parent")) {
      EntityReference expectedRef = (EntityReference) expected;
      EntityReference actualRef = JsonUtils.readValue(actual.toString(), EntityReference.class);
      assertEquals(expectedRef.getId(), actualRef.getId());
    } else if (fieldName.startsWith("experts")) {
      @SuppressWarnings("unchecked")
      List<EntityReference> expectedRefs = (List<EntityReference>) expected;
      List<EntityReference> actualRefs = JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertEntityReferences(expectedRefs, actualRefs);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
