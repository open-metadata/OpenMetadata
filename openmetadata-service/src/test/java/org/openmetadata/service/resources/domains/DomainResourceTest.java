package org.openmetadata.service.resources.domains;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.CHANGE_CONSOLIDATED;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.REVERT;
import static org.openmetadata.service.util.TestUtils.assertEntityReferenceNames;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import javax.ws.rs.core.Response.Status;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.domains.DomainResource.DomainList;
import org.openmetadata.service.util.JsonUtils;

public class DomainResourceTest extends EntityResourceTest<Domain, CreateDomain> {
  public DomainResourceTest() {
    super(Entity.DOMAIN, Domain.class, DomainList.class, "domains", DomainResource.FIELDS);
  }

  public void setupDomains(TestInfo test) throws IOException {
    DOMAIN = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    SUB_DOMAIN =
        createEntity(createRequest("sub-domain").withParent(DOMAIN.getFullyQualifiedName()), ADMIN_AUTH_HEADERS);
    DOMAIN1 = createEntity(createRequest(test, 1), ADMIN_AUTH_HEADERS);
  }

  @Test
  void testDomainExpertsUpdate(TestInfo test) throws IOException {
    CreateDomain create = createRequest(getEntityName(test)).withExperts(listOf(USER1.getFullyQualifiedName()));
    Domain domain = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Version 0.2 - Add User2 with existing USER1 as expert using PUT
    create.withExperts(List.of(USER1.getFullyQualifiedName(), USER2.getFullyQualifiedName()));
    ChangeDescription change = getChangeDescription(domain, MINOR_UPDATE);
    fieldAdded(change, "experts", listOf(USER2.getEntityReference()));
    domain = updateAndCheckEntity(create, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Version 0.3 - Remove User2 as expert using PUT leaving USER1 as the expert
    create.withExperts(List.of(USER1.getFullyQualifiedName()));
    change = getChangeDescription(domain, MINOR_UPDATE);
    fieldDeleted(change, "experts", listOf(USER2.getEntityReference()));
    domain = updateAndCheckEntity(create, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add User2 back as expert using PATCH
    // Version 0. 2 - Changes from this PATCH is consolidated with the previous change resulting in no change
    String json = JsonUtils.pojoToJson(domain);
    domain.withExperts(List.of(USER1.getEntityReference(), USER2.getEntityReference()));
    change = getChangeDescription(domain, REVERT);
    domain = patchEntityAndCheck(domain, json, ADMIN_AUTH_HEADERS, REVERT, change);

    // Remove User2 as expert using PATCH
    // Version 0.1 - Changes from this PATCH is consolidated with the previous two changes resulting in deletion of
    // USER2
    json = JsonUtils.pojoToJson(domain);
    change = getChangeDescription(domain, REVERT);
    domain.withExperts(List.of(USER1.getEntityReference()));
    patchEntityAndCheck(domain, json, ADMIN_AUTH_HEADERS, REVERT, change);
  }

  @Test
  void testDomainTypeUpdate(TestInfo test) throws IOException {
    CreateDomain create = createRequest(getEntityName(test)).withExperts(listOf(USER1.getFullyQualifiedName()));
    Domain domain = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Change domain type from AGGREGATE to SOURCE_ALIGNED using PUT
    create.withDomainType(DomainType.SOURCE_ALIGNED);
    ChangeDescription change = getChangeDescription(domain, MINOR_UPDATE);
    fieldUpdated(change, "domainType", DomainType.AGGREGATE, DomainType.SOURCE_ALIGNED);
    domain = updateAndCheckEntity(create, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Change domain type from SOURCE_ALIGNED to CONSUMER_ALIGNED using PATCH
    // Changes from this PATCH is consolidated with the previous changes
    String json = JsonUtils.pojoToJson(domain);
    domain.withDomainType(DomainType.CONSUMER_ALIGNED);
    change = getChangeDescription(domain, CHANGE_CONSOLIDATED);
    fieldUpdated(change, "domainType", DomainType.AGGREGATE, DomainType.CONSUMER_ALIGNED);
    patchEntityAndCheck(domain, json, ADMIN_AUTH_HEADERS, CHANGE_CONSOLIDATED, change);
  }

  @Test
  void testInheritedPermissionFromParent(TestInfo test) throws IOException {
    // Create a domain with owner data consumer
    CreateDomain create = createRequest(getEntityName(test)).withOwner(DATA_CONSUMER.getEntityReference());
    Domain d = createEntity(create, ADMIN_AUTH_HEADERS);

    // Data consumer as an owner of domain can create subdomain under it
    create = createRequest("subdomain").withParent(d.getFullyQualifiedName());
    createEntity(create, authHeaders(DATA_CONSUMER.getName()));
  }

  @Override
  public CreateDomain createRequest(String name) {
    return new CreateDomain()
        .withName(name)
        .withDomainType(DomainType.AGGREGATE)
        .withDescription("name")
        .withStyle(new Style().withColor("#FFA07A").withIconURL("https://domainIcon"))
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
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
