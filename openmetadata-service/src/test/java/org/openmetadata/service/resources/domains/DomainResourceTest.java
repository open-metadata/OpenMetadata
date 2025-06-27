package org.openmetadata.service.resources.domains;

import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertEntityReferenceNames;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.entity.data.EntityHierarchy;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.domains.DomainResource.DomainList;
import org.openmetadata.service.util.EntityHierarchyList;
import org.openmetadata.service.util.TestUtils;

public class DomainResourceTest extends EntityResourceTest<Domain, CreateDomain> {
  public DomainResourceTest() {
    super(Entity.DOMAIN, Domain.class, DomainList.class, "domains", DomainResource.FIELDS);
  }

  public void setupDomains(TestInfo test) throws IOException {
    DOMAIN = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    SUB_DOMAIN =
        createEntity(
            createRequest("sub-domain").withParent(DOMAIN.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    DOMAIN1 = createEntity(createRequest(test, 1), ADMIN_AUTH_HEADERS);
  }

  @Test
  void testDomainExpertsUpdate(TestInfo test) throws IOException {
    CreateDomain create =
        createRequest(getEntityName(test)).withExperts(listOf(USER1.getFullyQualifiedName()));
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

    String json = JsonUtils.pojoToJson(domain);
    domain.withExperts(List.of(USER1.getEntityReference(), USER2.getEntityReference()));
    change = getChangeDescription(domain, MINOR_UPDATE);
    fieldAdded(change, "experts", listOf(USER2.getEntityReference()));
    domain = patchEntityAndCheck(domain, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    json = JsonUtils.pojoToJson(domain);
    change = getChangeDescription(domain, MINOR_UPDATE);
    fieldDeleted(change, "experts", listOf(USER2.getEntityReference()));
    domain.withExperts(List.of(USER1.getEntityReference()));
    patchEntityAndCheck(domain, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void testDomainTypeUpdate(TestInfo test) throws IOException {
    CreateDomain create =
        createRequest(getEntityName(test)).withExperts(listOf(USER1.getFullyQualifiedName()));
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
    change = getChangeDescription(domain, MINOR_UPDATE);
    fieldUpdated(change, "domainType", DomainType.SOURCE_ALIGNED, DomainType.CONSUMER_ALIGNED);
    patchEntityAndCheck(domain, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void testInheritedPermissionFromParent(TestInfo test) throws IOException {
    // Create a domain with owner data consumer
    CreateDomain create =
        createRequest(getEntityName(test)).withOwners(List.of(DATA_CONSUMER.getEntityReference()));
    Domain d = createEntity(create, ADMIN_AUTH_HEADERS);

    // Data consumer as an owner of domain can create subdomain under it
    create = createRequest("subdomain").withParent(d.getFullyQualifiedName());
    createEntity(create, authHeaders(DATA_CONSUMER.getName()));
  }

  @Test
  void testValidateDomain() {
    UUID rdnUUID = UUID.randomUUID();
    EntityReference entityReference = new EntityReference().withId(rdnUUID);
    TableRepository entityRepository = (TableRepository) Entity.getEntityRepository(TABLE);

    assertThatThrownBy(() -> entityRepository.validateDomain(entityReference))
        .isInstanceOf(EntityNotFoundException.class)
        .hasMessage(String.format("domain instance for %s not found", rdnUUID));
  }

  @Test
  void patchWrongExperts(TestInfo test) throws IOException {
    Domain entity = createEntity(createRequest(test, 0), ADMIN_AUTH_HEADERS);

    // Add random domain reference
    EntityReference expertReference =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER);
    String originalJson = JsonUtils.pojoToJson(entity);
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    entity.setExperts(List.of(expertReference));

    assertResponse(
        () -> patchEntityAndCheck(entity, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change),
        NOT_FOUND,
        String.format("user instance for %s not found", expertReference.getId()));
  }

  @Test
  void test_buildDomainNestedHierarchyFromSearch() throws HttpResponseException {
    CreateDomain createRootDomain =
        createRequest("rootDomain")
            .withDisplayName("Global Headquarters")
            .withDescription("Root Domain")
            .withDomainType(DomainType.AGGREGATE)
            .withStyle(null)
            .withExperts(null);
    Domain rootDomain = createEntity(createRootDomain, ADMIN_AUTH_HEADERS);

    CreateDomain createSecondLevelDomain =
        createRequest("secondLevelDomain")
            .withDisplayName("Operations Hub")
            .withDescription("Second Level Domain")
            .withDomainType(DomainType.AGGREGATE)
            .withStyle(null)
            .withExperts(null)
            .withParent(rootDomain.getFullyQualifiedName());
    Domain secondLevelDomain = createEntity(createSecondLevelDomain, ADMIN_AUTH_HEADERS);

    CreateDomain createThirdLevelDomain =
        createRequest("thirdLevelDomain")
            .withDisplayName("Innovation Center")
            .withDescription("Third Level Domain")
            .withDomainType(DomainType.AGGREGATE)
            .withStyle(null)
            .withExperts(null)
            .withParent(secondLevelDomain.getFullyQualifiedName());
    Domain thirdLevelDomain = createEntity(createThirdLevelDomain, ADMIN_AUTH_HEADERS);

    // Search for the displayName of third-level child domain and verify the hierarchy
    String response = getResponseFormSearchWithHierarchy("domain_search_index", "*innovation*");
    List<EntityHierarchy> domains = JsonUtils.readObjects(response, EntityHierarchy.class);

    boolean isChild =
        domains.stream()
            .filter(domain -> "rootDomain".equals(domain.getName()))
            .findFirst()
            .map(
                root ->
                    root.getChildren().stream()
                        .filter(domain -> "secondLevelDomain".equals(domain.getName()))
                        .flatMap(secondLevel -> secondLevel.getChildren().stream())
                        .anyMatch(thirdLevel -> "thirdLevelDomain".equals(thirdLevel.getName())))
            .orElse(false);

    assertTrue(
        isChild,
        "thirdLevelDomain should be a child of secondLevelDomain, which should be a child of rootDomain");

    // Search for the fqn of third-level child domain and verify the hierarchy
    response = getResponseFormSearchWithHierarchy("domain_search_index", "*third*");
    domains = JsonUtils.readObjects(response, EntityHierarchy.class);

    isChild =
        domains.stream()
            .filter(domain -> "rootDomain".equals(domain.getName()))
            .findFirst()
            .map(
                root ->
                    root.getChildren().stream()
                        .filter(domain -> "secondLevelDomain".equals(domain.getName()))
                        .flatMap(secondLevel -> secondLevel.getChildren().stream())
                        .anyMatch(thirdLevel -> "thirdLevelDomain".equals(thirdLevel.getName())))
            .orElse(false);

    assertTrue(
        isChild,
        "thirdLevelDomain should be a child of secondLevelDomain, which should be a child of rootDomain");
  }

  @Test
  void get_hierarchicalListOfDomain(TestInfo test) throws HttpResponseException {
    Domain rootDomain = createEntity(createRequest("A_ROOT_DOMAIN"), ADMIN_AUTH_HEADERS);
    Domain subDomain1 =
        createEntity(
            createRequest("A_subDomain1").withParent(rootDomain.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    Domain subDomain2 =
        createEntity(
            createRequest("A_subDomain2").withParent(rootDomain.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    Domain subDomain3 =
        createEntity(
            createRequest("A_subDomain3").withParent(rootDomain.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    // Ensure parent has all the newly created children
    rootDomain = getEntity(rootDomain.getId(), "children,parent", ADMIN_AUTH_HEADERS);
    assertEntityReferences(
        new ArrayList<>(
            List.of(
                subDomain1.getEntityReference(),
                subDomain2.getEntityReference(),
                subDomain3.getEntityReference())),
        rootDomain.getChildren());

    Domain subSubDomain1 =
        createEntity(
            createRequest("A_subSubDomain11").withParent(subDomain1.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    Domain subSubDomain2 =
        createEntity(
            createRequest("A_subSubDomain12").withParent(subDomain1.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    Domain subSubDomain3 =
        createEntity(
            createRequest("A_subSubDomain13").withParent(subDomain1.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    // Ensure parent has all the newly created children
    subDomain1 = getEntity(subDomain1.getId(), "children,parent", ADMIN_AUTH_HEADERS);
    assertEntityReferences(
        new ArrayList<>(
            List.of(
                subSubDomain1.getEntityReference(),
                subSubDomain2.getEntityReference(),
                subSubDomain3.getEntityReference())),
        subDomain1.getChildren());
    assertParent(subSubDomain1, subDomain1.getEntityReference());
    assertParent(subSubDomain2, subDomain1.getEntityReference());
    assertParent(subSubDomain3, subDomain1.getEntityReference());

    // Create another root domain without hierarchy
    Domain secondRootDomain = createEntity(createRequest("B_ROOT_DOMAIN"), ADMIN_AUTH_HEADERS);

    List<EntityHierarchy> hierarchyList = getDomainsHierarchy(ADMIN_AUTH_HEADERS).getData();

    UUID rootDomainId = rootDomain.getId();
    UUID subDomain1Id = subDomain1.getId();
    UUID subDomain2Id = subDomain2.getId();
    UUID subDomain3Id = subDomain3.getId();
    UUID subSubDomain1Id = subSubDomain1.getId();
    UUID subSubDomain2Id = subSubDomain2.getId();
    UUID subSubDomain3Id = subSubDomain3.getId();
    UUID secondRootDomainId = secondRootDomain.getId();

    EntityHierarchy rootHierarchy =
        hierarchyList.stream().filter(h -> h.getId().equals(rootDomainId)).findAny().orElse(null);
    assertNotNull(rootHierarchy);
    assertEquals(3, rootHierarchy.getChildren().size());

    List<EntityHierarchy> rootChildren = rootHierarchy.getChildren();
    assertEquals(3, rootChildren.size());
    assertTrue(rootChildren.stream().anyMatch(h -> h.getId().equals(subDomain1Id)));
    assertTrue(rootChildren.stream().anyMatch(h -> h.getId().equals(subDomain2Id)));
    assertTrue(rootChildren.stream().anyMatch(h -> h.getId().equals(subDomain3Id)));

    EntityHierarchy subDomain1Hierarchy =
        rootChildren.stream().filter(h -> h.getId().equals(subDomain1Id)).findAny().orElse(null);
    assertNotNull(subDomain1Hierarchy);
    assertEquals(3, subDomain1Hierarchy.getChildren().size());

    List<EntityHierarchy> subDomain1Children = subDomain1Hierarchy.getChildren();
    assertTrue(subDomain1Children.stream().anyMatch(h -> h.getId().equals(subSubDomain1Id)));
    assertTrue(subDomain1Children.stream().anyMatch(h -> h.getId().equals(subSubDomain2Id)));
    assertTrue(subDomain1Children.stream().anyMatch(h -> h.getId().equals(subSubDomain3Id)));

    EntityHierarchy subSubDomain1Hierarchy =
        subDomain1Children.stream()
            .filter(h -> h.getId().equals(subSubDomain1Id))
            .findAny()
            .orElse(null);
    assertNotNull(subSubDomain1Hierarchy);
    assertEquals(0, subSubDomain1Hierarchy.getChildren().size());

    EntityHierarchy subSubDomain2Hierarchy =
        subDomain1Children.stream()
            .filter(h -> h.getId().equals(subSubDomain2Id))
            .findAny()
            .orElse(null);
    assertNotNull(subSubDomain2Hierarchy);
    assertEquals(0, subSubDomain2Hierarchy.getChildren().size());

    EntityHierarchy subSubDomain3Hierarchy =
        subDomain1Children.stream()
            .filter(h -> h.getId().equals(subSubDomain3Id))
            .findAny()
            .orElse(null);
    assertNotNull(subSubDomain3Hierarchy);
    assertEquals(0, subSubDomain3Hierarchy.getChildren().size());

    // Verify the new root domain without hierarchy
    EntityHierarchy secondRootDomainHierarchy =
        hierarchyList.stream()
            .filter(h -> h.getId().equals(secondRootDomainId))
            .findAny()
            .orElse(null);
    assertNotNull(secondRootDomainHierarchy);
    assertEquals(0, secondRootDomainHierarchy.getChildren().size());
  }

  private void assertParent(Domain domain, EntityReference expectedParent)
      throws HttpResponseException {
    assertEquals(expectedParent, domain.getParent());
    // Ensure the parent has the given domain as a child
    Domain parent = getEntity(expectedParent.getId(), "children", ADMIN_AUTH_HEADERS);
    assertEntityReferencesContain(parent.getChildren(), domain.getEntityReference());
  }

  private EntityHierarchyList getDomainsHierarchy(Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("domains/hierarchy");
    target = target.queryParam("limit", 25);
    return TestUtils.get(target, EntityHierarchyList.class, authHeaders);
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

  public CreateDomain createRequestWithoutOwnersExperts(String name) {
    return new CreateDomain()
        .withName(name)
        .withDomainType(DomainType.AGGREGATE)
        .withDescription("name")
        .withStyle(new Style().withColor("#FFA07A").withIconURL("https://domainIcon"));
  }

  @Override
  public void validateCreatedEntity(
      Domain createdEntity, CreateDomain request, Map<String, String> authHeaders) {
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
  public Domain validateGetWithDifferentFields(Domain domain, boolean byName)
      throws HttpResponseException {
    Domain getDomain =
        byName
            ? getEntityByName(domain.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(domain.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNotNull(getDomain.getDomainType());
    assertListNull(
        getDomain.getParent(),
        getDomain.getChildren(),
        getDomain.getOwners(),
        getDomain.getExperts());
    String fields = "children,owners,parent,experts,tags,followers";
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
