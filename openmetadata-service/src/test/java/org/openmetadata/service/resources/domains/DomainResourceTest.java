package org.openmetadata.service.resources.domains;

import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
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
import jakarta.ws.rs.core.GenericType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.EntityHierarchy;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.domains.DomainResource.DomainList;
import org.openmetadata.service.security.SecurityUtil;
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

    assertThatThrownBy(() -> entityRepository.validateDomainsByRef(List.of(entityReference)))
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

    // Store IDs and FQNs for lambda expressions
    UUID rootDomainId = rootDomain.getId();
    UUID secondRootDomainId = secondRootDomain.getId();
    UUID subDomain1Id = subDomain1.getId();
    UUID subDomain2Id = subDomain2.getId();
    UUID subDomain3Id = subDomain3.getId();
    UUID subSubDomain1Id = subSubDomain1.getId();
    UUID subSubDomain2Id = subSubDomain2.getId();
    UUID subSubDomain3Id = subSubDomain3.getId();
    String rootDomainFqn = rootDomain.getFullyQualifiedName();
    String subDomain1Fqn = subDomain1.getFullyQualifiedName();
    String secondRootDomainFqn = secondRootDomain.getFullyQualifiedName();

    // Test 1: Get root domains (no directChildrenOf parameter) - should include our test root
    // domains
    EntityHierarchyList rootDomainsResult = getDomainsHierarchy(ADMIN_AUTH_HEADERS);
    List<EntityHierarchy> rootDomains = rootDomainsResult.getData();
    assertTrue(
        rootDomains.size() >= 2,
        "Should have at least our 2 root domains (may have more from other tests)");
    assertTrue(
        rootDomains.stream().anyMatch(h -> h.getId().equals(rootDomainId)),
        "Should contain first root domain");
    assertTrue(
        rootDomains.stream().anyMatch(h -> h.getId().equals(secondRootDomainId)),
        "Should contain second root domain");
    assertNotNull(rootDomainsResult.getPaging(), "Paging should not be null");
    assertTrue(
        rootDomainsResult.getPaging().getTotal() >= 2,
        "Total count should be at least 2 (may have more from other tests)");

    // Test 2: Get direct children of root domain
    EntityHierarchyList rootChildrenResult =
        getDomainsHierarchyWithDirectChildrenOf(rootDomainFqn, ADMIN_AUTH_HEADERS);
    List<EntityHierarchy> rootChildren = rootChildrenResult.getData();
    assertEquals(3, rootChildren.size());
    assertTrue(rootChildren.stream().anyMatch(h -> h.getId().equals(subDomain1Id)));
    assertTrue(rootChildren.stream().anyMatch(h -> h.getId().equals(subDomain2Id)));
    assertTrue(rootChildren.stream().anyMatch(h -> h.getId().equals(subDomain3Id)));
    assertNotNull(rootChildrenResult.getPaging(), "Paging should not be null");
    assertEquals(3, rootChildrenResult.getPaging().getTotal(), "Total count should be 3");

    // Test 2b: Test pagination - limit results but verify total count is still correct
    // This specifically tests that total != data.size() when limit is applied
    EntityHierarchyList rootChildrenPage1 =
        getDomainsHierarchyWithPagination(rootDomainFqn, 2, 0, ADMIN_AUTH_HEADERS);
    assertEquals(
        2,
        rootChildrenPage1.getData().size(),
        "Should return only 2 items due to limit, even though there are 3 total");
    assertNotNull(rootChildrenPage1.getPaging(), "Paging should not be null");
    assertEquals(
        3,
        rootChildrenPage1.getPaging().getTotal(),
        "Total should still be 3 even though only 2 items returned due to limit");

    EntityHierarchyList rootChildrenPage2 =
        getDomainsHierarchyWithPagination(rootDomainFqn, 2, 2, ADMIN_AUTH_HEADERS);
    assertEquals(
        1, rootChildrenPage2.getData().size(), "Should return only 1 remaining item on page 2");
    assertNotNull(rootChildrenPage2.getPaging(), "Paging should not be null");
    assertEquals(3, rootChildrenPage2.getPaging().getTotal(), "Total should still be 3 on page 2");

    // Test 3: Get direct children of subDomain1
    EntityHierarchyList subDomain1ChildrenResult =
        getDomainsHierarchyWithDirectChildrenOf(subDomain1Fqn, ADMIN_AUTH_HEADERS);
    List<EntityHierarchy> subDomain1Children = subDomain1ChildrenResult.getData();
    assertEquals(3, subDomain1Children.size());
    assertTrue(subDomain1Children.stream().anyMatch(h -> h.getId().equals(subSubDomain1Id)));
    assertTrue(subDomain1Children.stream().anyMatch(h -> h.getId().equals(subSubDomain2Id)));
    assertTrue(subDomain1Children.stream().anyMatch(h -> h.getId().equals(subSubDomain3Id)));
    assertNotNull(subDomain1ChildrenResult.getPaging(), "Paging should not be null");
    assertEquals(3, subDomain1ChildrenResult.getPaging().getTotal(), "Total count should be 3");

    // Test 4: Verify second root domain has no children
    EntityHierarchyList secondRootChildrenResult =
        getDomainsHierarchyWithDirectChildrenOf(secondRootDomainFqn, ADMIN_AUTH_HEADERS);
    List<EntityHierarchy> secondRootChildren = secondRootChildrenResult.getData();
    assertEquals(0, secondRootChildren.size());
    assertNotNull(secondRootChildrenResult.getPaging(), "Paging should not be null");
    assertEquals(0, secondRootChildrenResult.getPaging().getTotal(), "Total count should be 0");
  }

  @Test
  void test_domainHierarchyPagination(TestInfo test) throws HttpResponseException {
    // Create root domain for testing pagination
    Domain paginationRoot = createEntity(createRequest("paginationRoot"), ADMIN_AUTH_HEADERS);

    // Create child domains under paginationRoot
    Domain child1 =
        createEntity(
            createRequest("pagChild1").withParent(paginationRoot.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    Domain child2 =
        createEntity(
            createRequest("pagChild2").withParent(paginationRoot.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    Domain child3 =
        createEntity(
            createRequest("pagChild3").withParent(paginationRoot.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    // Test pagination of children with offset - should return 3 total children
    List<EntityHierarchy> allChildren =
        getDomainsHierarchyWithPagination(
                paginationRoot.getFullyQualifiedName(), 100, 0, ADMIN_AUTH_HEADERS)
            .getData();
    assertEquals(3, allChildren.size(), "Should have 3 total children");

    // Test first page (limit 2)
    List<EntityHierarchy> childPage1 =
        getDomainsHierarchyWithPagination(
                paginationRoot.getFullyQualifiedName(), 2, 0, ADMIN_AUTH_HEADERS)
            .getData();
    assertEquals(2, childPage1.size(), "First page should have 2 children");

    // Test second page (limit 2, offset 2)
    List<EntityHierarchy> childPage2 =
        getDomainsHierarchyWithPagination(
                paginationRoot.getFullyQualifiedName(), 2, 2, ADMIN_AUTH_HEADERS)
            .getData();
    assertEquals(1, childPage2.size(), "Second page should have 1 remaining child");

    // Verify all children IDs are present across pages
    Set<UUID> allIds = new HashSet<>();
    allIds.addAll(childPage1.stream().map(EntityHierarchy::getId).collect(Collectors.toSet()));
    allIds.addAll(childPage2.stream().map(EntityHierarchy::getId).collect(Collectors.toSet()));
    assertEquals(3, allIds.size(), "Combined pages should have all 3 unique children");
  }

  @Test
  void test_domainChildrenCount(TestInfo test) throws HttpResponseException {
    // Create root domain
    Domain root = createEntity(createRequest("rootWithCount"), ADMIN_AUTH_HEADERS);

    // Create child domains
    Domain child1 =
        createEntity(
            createRequest("countChild1").withParent(root.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    Domain child2 =
        createEntity(
            createRequest("countChild2").withParent(root.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    // Create grandchild domains under child1
    Domain grandchild1 =
        createEntity(
            createRequest("grandchild1").withParent(child1.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    Domain grandchild2 =
        createEntity(
            createRequest("grandchild2").withParent(child1.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    // Get root domain with childrenCount field
    Domain rootWithCount = getEntity(root.getId(), "childrenCount", ADMIN_AUTH_HEADERS);
    assertEquals(
        4, rootWithCount.getChildrenCount()); // 2 children + 2 grandchildren = 4 total nested

    // Get child1 with childrenCount field
    Domain child1WithCount = getEntity(child1.getId(), "childrenCount", ADMIN_AUTH_HEADERS);
    assertEquals(2, child1WithCount.getChildrenCount()); // 2 grandchildren

    // Get child2 with childrenCount field
    Domain child2WithCount = getEntity(child2.getId(), "childrenCount", ADMIN_AUTH_HEADERS);
    assertEquals(0, child2WithCount.getChildrenCount()); // No children
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

  private EntityHierarchyList getDomainsHierarchyWithDirectChildrenOf(
      String directChildrenOf, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("domains/hierarchy");
    target = target.queryParam("limit", 25);
    target = target.queryParam("directChildrenOf", directChildrenOf);
    return TestUtils.get(target, EntityHierarchyList.class, authHeaders);
  }

  private EntityHierarchyList getDomainsHierarchyWithPagination(
      String directChildrenOf, int limit, int offset, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("domains/hierarchy");
    target = target.queryParam("limit", limit);
    target = target.queryParam("offset", offset);
    if (directChildrenOf != null) {
      target = target.queryParam("directChildrenOf", directChildrenOf);
    }
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

  @Test
  void test_domainAssetsAndAssetsCountWithSubdomainInheritance(TestInfo test) throws IOException {
    // Tests assets API includes direct assets and inherited assets from subdomains
    Domain domain = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    Domain subDomain =
        createEntity(
            createRequest(getEntityName(test, 1)).withParent(domain.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    Table table1 =
        tableTest.createEntity(tableTest.createRequest(getEntityName(test, 2)), ADMIN_AUTH_HEADERS);
    Table table2 =
        tableTest.createEntity(tableTest.createRequest(getEntityName(test, 3)), ADMIN_AUTH_HEADERS);

    ResultList<EntityReference> assets = getAssets(domain.getId(), 100, 0, ADMIN_AUTH_HEADERS);
    assertNotNull(assets.getData());
    assertEquals(0, assets.getData().size());
    assertNotNull(assets.getPaging().getTotal());
    assertEquals(0, assets.getPaging().getTotal());

    bulkAddAssets(
        domain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table1.getEntityReference())));

    assets = getAssets(domain.getId(), 100, 0, ADMIN_AUTH_HEADERS);
    assertEquals(1, assets.getData().size());
    assertEquals(1, assets.getPaging().getTotal());
    assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table1.getId())));

    bulkAddAssets(
        subDomain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table2.getEntityReference())));

    assets = getAssets(domain.getId(), 100, 0, ADMIN_AUTH_HEADERS);
    assertEquals(
        2, assets.getData().size(), "Domain should have 1 direct asset + 1 from subdomain");
    assertEquals(2, assets.getPaging().getTotal());
    assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table1.getId())));
    assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table2.getId())));

    ResultList<EntityReference> subDomainAssets =
        getAssets(subDomain.getId(), 100, 0, ADMIN_AUTH_HEADERS);
    assertEquals(1, subDomainAssets.getData().size());
    assertEquals(1, subDomainAssets.getPaging().getTotal());
    assertTrue(subDomainAssets.getData().stream().anyMatch(a -> a.getId().equals(table2.getId())));

    // Test bulk remove assets
    bulkRemoveAssets(
        subDomain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table2.getEntityReference())));

    // Verify table2 is removed from subdomain
    subDomainAssets = getAssets(subDomain.getId(), 100, 0, ADMIN_AUTH_HEADERS);
    assertEquals(0, subDomainAssets.getData().size());
    assertEquals(0, subDomainAssets.getPaging().getTotal());

    // Verify parent domain now only has table1
    assets = getAssets(domain.getId(), 100, 0, ADMIN_AUTH_HEADERS);
    assertEquals(1, assets.getData().size());
    assertEquals(1, assets.getPaging().getTotal());
    assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table1.getId())));
    assertFalse(assets.getData().stream().anyMatch(a -> a.getId().equals(table2.getId())));

    // Remove table1 from parent domain
    bulkRemoveAssets(
        domain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table1.getEntityReference())));

    // Verify domain has no assets
    assets = getAssets(domain.getId(), 100, 0, ADMIN_AUTH_HEADERS);
    assertEquals(0, assets.getData().size());
    assertEquals(0, assets.getPaging().getTotal());
  }

  @Test
  void test_domainAssetsAndAssetsCountWithAssetInheritance(TestInfo test) throws IOException {
    // Tests assets API includes parent entity and all child entities when domain is assigned
    Domain domain = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    DatabaseSchemaResourceTest schemaTest = new DatabaseSchemaResourceTest();
    TableResourceTest tableTest = new TableResourceTest();

    DatabaseSchema schema =
        schemaTest.createEntity(
            schemaTest.createRequest(getEntityName(test, 1)), ADMIN_AUTH_HEADERS);

    Table table1 =
        tableTest.createEntity(
            tableTest
                .createRequest(getEntityName(test, 2))
                .withDatabaseSchema(schema.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    Table table2 =
        tableTest.createEntity(
            tableTest
                .createRequest(getEntityName(test, 3))
                .withDatabaseSchema(schema.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    String json = JsonUtils.pojoToJson(schema);
    schema.withDomains(List.of(domain.getEntityReference()));
    schemaTest.patchEntity(schema.getId(), json, schema, ADMIN_AUTH_HEADERS);

    ResultList<EntityReference> assets = getAssets(domain.getId(), 100, 0, ADMIN_AUTH_HEADERS);
    assertEquals(
        3, assets.getData().size(), "Domain should have 1 schema + 2 inherited tables from schema");
    assertEquals(3, assets.getPaging().getTotal());
    assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(schema.getId())));
    assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table1.getId())));
    assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table2.getId())));
  }

  private void bulkAddAssets(String domainName, BulkAssets request) throws HttpResponseException {
    WebTarget target = getResource("domains/" + domainName + "/assets/add");
    TestUtils.put(target, request, Status.OK, ADMIN_AUTH_HEADERS);
  }

  private void bulkRemoveAssets(String domainName, BulkAssets request)
      throws HttpResponseException {
    WebTarget target = getResource("domains/" + domainName + "/assets/remove");
    TestUtils.put(target, request, Status.OK, ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_getDomainAssetsAPI(TestInfo test) throws IOException {
    Domain rootDomain = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    Domain subDomain =
        createEntity(
            createRequest(getEntityName(test, 1)).withParent(rootDomain.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    DataProductResourceTest dataProductTest = new DataProductResourceTest();
    DataProduct dataProduct =
        dataProductTest.createEntity(
            dataProductTest
                .createRequest(getEntityName(test, 2))
                .withDomains(List.of(subDomain.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    Table table1 =
        tableTest.createEntity(tableTest.createRequest(getEntityName(test, 3)), ADMIN_AUTH_HEADERS);
    Table table2 =
        tableTest.createEntity(tableTest.createRequest(getEntityName(test, 4)), ADMIN_AUTH_HEADERS);
    Table table3 =
        tableTest.createEntity(tableTest.createRequest(getEntityName(test, 5)), ADMIN_AUTH_HEADERS);

    bulkAddAssets(
        rootDomain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table1.getEntityReference())));
    bulkAddAssets(
        subDomain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table2.getEntityReference())));

    ResultList<EntityReference> assets = getAssets(rootDomain.getId(), 10, 0, ADMIN_AUTH_HEADERS);

    assertEquals(2, assets.getPaging().getTotal());
    assertEquals(2, assets.getData().size());
    assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table1.getId())));
    assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table2.getId())));
    assertFalse(assets.getData().stream().anyMatch(a -> a.getId().equals(dataProduct.getId())));

    ResultList<EntityReference> assetsByName =
        getAssetsByName(rootDomain.getFullyQualifiedName(), 10, 0, ADMIN_AUTH_HEADERS);
    assertEquals(2, assetsByName.getPaging().getTotal());
    assertEquals(2, assetsByName.getData().size());

    ResultList<EntityReference> subDomainAssets =
        getAssets(subDomain.getId(), 10, 0, ADMIN_AUTH_HEADERS);
    assertEquals(1, subDomainAssets.getPaging().getTotal());
    assertEquals(1, subDomainAssets.getData().size());
    assertTrue(subDomainAssets.getData().stream().anyMatch(a -> a.getId().equals(table2.getId())));

    ResultList<EntityReference> page1 = getAssets(rootDomain.getId(), 1, 0, ADMIN_AUTH_HEADERS);
    assertEquals(2, page1.getPaging().getTotal());
    assertEquals(1, page1.getData().size());

    ResultList<EntityReference> page2 = getAssets(rootDomain.getId(), 1, 1, ADMIN_AUTH_HEADERS);
    assertEquals(2, page2.getPaging().getTotal());
    assertEquals(1, page2.getData().size());
    assertNotEquals(page1.getData().getFirst().getId(), page2.getData().getFirst().getId());

    bulkAddAssets(
        rootDomain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table3.getEntityReference())));
    ResultList<EntityReference> allAssets =
        getAssets(rootDomain.getId(), 100, 0, ADMIN_AUTH_HEADERS);
    assertEquals(3, allAssets.getPaging().getTotal());
    assertEquals(3, allAssets.getData().size());

    // Test bulk remove assets
    bulkRemoveAssets(
        rootDomain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table1.getEntityReference())));

    // Verify table1 is removed
    assets = getAssets(rootDomain.getId(), 100, 0, ADMIN_AUTH_HEADERS);
    assertEquals(2, assets.getPaging().getTotal());
    assertEquals(2, assets.getData().size());
    assertFalse(assets.getData().stream().anyMatch(a -> a.getId().equals(table1.getId())));
    assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table2.getId())));
    assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table3.getId())));

    // Test pagination after removal
    page1 = getAssets(rootDomain.getId(), 1, 0, ADMIN_AUTH_HEADERS);
    assertEquals(2, page1.getPaging().getTotal());
    assertEquals(1, page1.getData().size());

    page2 = getAssets(rootDomain.getId(), 1, 1, ADMIN_AUTH_HEADERS);
    assertEquals(2, page2.getPaging().getTotal());
    assertEquals(1, page2.getData().size());
    assertNotEquals(page1.getData().getFirst().getId(), page2.getData().getFirst().getId());

    // Remove remaining assets
    bulkRemoveAssets(
        rootDomain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table3.getEntityReference())));
    bulkRemoveAssets(
        subDomain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table2.getEntityReference())));

    // Verify all assets are removed
    assets = getAssets(rootDomain.getId(), 100, 0, ADMIN_AUTH_HEADERS);
    assertEquals(0, assets.getPaging().getTotal());
    assertEquals(0, assets.getData().size());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }

  @Test
  void test_getAllDomainsWithAssetsCount(TestInfo test) throws IOException {
    Domain rootDomain = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    Domain subDomain =
        createEntity(
            createRequest(getEntityName(test, 1)).withParent(rootDomain.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    Domain anotherDomain = createEntity(createRequest(getEntityName(test, 2)), ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    Table table1 =
        tableTest.createEntity(tableTest.createRequest(getEntityName(test, 3)), ADMIN_AUTH_HEADERS);
    Table table2 =
        tableTest.createEntity(tableTest.createRequest(getEntityName(test, 4)), ADMIN_AUTH_HEADERS);
    Table table3 =
        tableTest.createEntity(tableTest.createRequest(getEntityName(test, 5)), ADMIN_AUTH_HEADERS);

    bulkAddAssets(
        rootDomain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table1.getEntityReference())));
    bulkAddAssets(
        subDomain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table2.getEntityReference())));
    bulkAddAssets(
        anotherDomain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table3.getEntityReference())));

    Map<String, Integer> assetsCount = getAllDomainsWithAssetsCount();

    assertNotNull(assetsCount);
    assertEquals(
        2,
        assetsCount.get(rootDomain.getFullyQualifiedName()),
        "Root domain should have 2 assets (1 direct + 1 from subdomain)");
    assertEquals(
        1, assetsCount.get(subDomain.getFullyQualifiedName()), "Subdomain should have 1 asset");
    assertEquals(
        1,
        assetsCount.get(anotherDomain.getFullyQualifiedName()),
        "Another domain should have 1 asset");
  }

  private Map<String, Integer> getAllDomainsWithAssetsCount() throws HttpResponseException {
    WebTarget target = getResource("domains/assets/counts");
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
    return response.readEntity(new GenericType<Map<String, Integer>>() {});
  }
}
