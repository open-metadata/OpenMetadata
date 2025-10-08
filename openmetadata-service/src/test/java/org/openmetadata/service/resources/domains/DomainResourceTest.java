package org.openmetadata.service.resources.domains;

import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.EntityHierarchy;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
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

  @Test
  void test_domainAssetsAndAssetsCountWithSubdomainInheritance(TestInfo test) throws IOException {
    // Verify that domain.assets and domain.assetsCount include:
    // 1. Direct assets added to the domain
    // 2. Assets inherited from all subdomains in the hierarchy
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

    // Initially, domain should have no assets
    Domain fetchedDomain = getEntity(domain.getId(), "assets,assetsCount", ADMIN_AUTH_HEADERS);
    assertNotNull(fetchedDomain.getAssets());
    assertEquals(0, fetchedDomain.getAssets().size());
    assertNotNull(fetchedDomain.getAssetsCount());
    assertEquals(0, fetchedDomain.getAssetsCount());

    // Add 1 direct asset to root domain
    bulkAddAssets(
        domain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table1.getEntityReference())));

    fetchedDomain = getEntity(domain.getId(), "assets,assetsCount", ADMIN_AUTH_HEADERS);
    assertEquals(1, fetchedDomain.getAssets().size());
    assertEquals(1, fetchedDomain.getAssetsCount());
    assertTrue(fetchedDomain.getAssets().stream().anyMatch(a -> a.getId().equals(table1.getId())));

    // Add 1 asset to subdomain
    bulkAddAssets(
        subDomain.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table2.getEntityReference())));

    // Verify root domain now shows 2 assets: 1 direct + 1 inherited from subdomain
    fetchedDomain = getEntity(domain.getId(), "assets,assetsCount", ADMIN_AUTH_HEADERS);
    assertEquals(
        2,
        fetchedDomain.getAssets().size(),
        "Domain should have 1 direct asset + 1 from subdomain");
    assertEquals(2, fetchedDomain.getAssetsCount());
    assertTrue(fetchedDomain.getAssets().stream().anyMatch(a -> a.getId().equals(table1.getId())));
    assertTrue(fetchedDomain.getAssets().stream().anyMatch(a -> a.getId().equals(table2.getId())));

    // Verify subdomain shows only its direct asset
    Domain fetchedSubDomain =
        getEntity(subDomain.getId(), "assets,assetsCount", ADMIN_AUTH_HEADERS);
    assertEquals(1, fetchedSubDomain.getAssets().size());
    assertEquals(1, fetchedSubDomain.getAssetsCount());
    assertTrue(
        fetchedSubDomain.getAssets().stream().anyMatch(a -> a.getId().equals(table2.getId())));
  }

  @Test
  void test_domainAssetsAndAssetsCountWithAssetInheritance(TestInfo test) throws IOException {
    // Verify that when a domain is assigned to a parent entity (like database schema),
    // the domain.assets and domain.assetsCount automatically include:
    // 1. The parent entity itself (schema)
    // 2. All child entities (tables) that belong to that parent
    Domain domain = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    DatabaseSchemaResourceTest schemaTest = new DatabaseSchemaResourceTest();
    TableResourceTest tableTest = new TableResourceTest();

    // Create a schema with 2 tables
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

    // Assign domain to the schema (not using bulk assets API)
    String json = JsonUtils.pojoToJson(schema);
    schema.withDomains(List.of(domain.getEntityReference()));
    schemaTest.patchEntity(schema.getId(), json, schema, ADMIN_AUTH_HEADERS);

    // Verify domain shows 3 assets: 1 schema + 2 tables inherited from that schema
    Domain fetchedDomain = getEntity(domain.getId(), "assets,assetsCount", ADMIN_AUTH_HEADERS);
    assertEquals(
        3,
        fetchedDomain.getAssets().size(),
        "Domain should have 1 schema + 2 inherited tables from schema");
    assertEquals(3, fetchedDomain.getAssetsCount());
    assertTrue(fetchedDomain.getAssets().stream().anyMatch(a -> a.getId().equals(schema.getId())));
    assertTrue(fetchedDomain.getAssets().stream().anyMatch(a -> a.getId().equals(table1.getId())));
    assertTrue(fetchedDomain.getAssets().stream().anyMatch(a -> a.getId().equals(table2.getId())));
  }

  @Test
  void test_domainAssetsPaginationListDefault(TestInfo test) throws IOException {
    // Tests default pagination (10 assets) on list API when no limit/offset specified
    Domain domain = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    List<EntityReference> tables = new ArrayList<>();

    for (int i = 0; i < 25; i++) {
      Table table =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, i)), ADMIN_AUTH_HEADERS);
      tables.add(table.getEntityReference());
    }

    bulkAddAssets(domain.getFullyQualifiedName(), new BulkAssets().withAssets(tables));

    WebTarget target = getResource("domains");
    target = target.queryParam("fields", "assets");
    target = target.queryParam("limit", 100);
    DomainList domainList = TestUtils.get(target, DomainList.class, ADMIN_AUTH_HEADERS);

    Domain fetchedDomain =
        domainList.getData().stream()
            .filter(d -> d.getId().equals(domain.getId()))
            .findFirst()
            .orElse(null);

    assertNotNull(fetchedDomain, "Domain should be in the list");
    assertNotNull(fetchedDomain.getAssets());
    assertEquals(
        10, fetchedDomain.getAssets().size(), "Default assets limit should be 10 in list API");
  }

  @Test
  void test_domainAssetsPaginationListWithCustomLimit(TestInfo test) throws IOException {
    // Tests custom pagination on list API
    Domain domain = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    List<EntityReference> tables = new ArrayList<>();

    for (int i = 0; i < 25; i++) {
      Table table =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, i)), ADMIN_AUTH_HEADERS);
      tables.add(table.getEntityReference());
    }

    bulkAddAssets(domain.getFullyQualifiedName(), new BulkAssets().withAssets(tables));

    WebTarget target = getResource("domains");
    target = target.queryParam("fields", "assets");
    target = target.queryParam("assetsLimit", 7);
    target = target.queryParam("assetsOffset", 3);
    target = target.queryParam("limit", 100);
    DomainList domainList = TestUtils.get(target, DomainList.class, ADMIN_AUTH_HEADERS);

    Domain fetchedDomain =
        domainList.getData().stream()
            .filter(d -> d.getId().equals(domain.getId()))
            .findFirst()
            .orElse(null);

    assertNotNull(fetchedDomain, "Domain should be in the list");
    assertNotNull(fetchedDomain.getAssets());
    assertEquals(
        7,
        fetchedDomain.getAssets().size(),
        "Custom assets limit should be 7 with offset 3 in list API");
  }

  @Test
  void test_domainAssetsPaginationGetByIdDefault(TestInfo test) throws IOException {
    // Tests default pagination (10 assets) on get by ID when no limit/offset specified
    Domain domain = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    List<EntityReference> tables = new ArrayList<>();

    for (int i = 0; i < 25; i++) {
      Table table =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, i)), ADMIN_AUTH_HEADERS);
      tables.add(table.getEntityReference());
    }

    bulkAddAssets(domain.getFullyQualifiedName(), new BulkAssets().withAssets(tables));

    WebTarget target = getResource("domains/" + domain.getId());
    target = target.queryParam("fields", "assets");
    Domain fetchedDomain = TestUtils.get(target, Domain.class, ADMIN_AUTH_HEADERS);

    assertNotNull(fetchedDomain.getAssets());
    assertEquals(10, fetchedDomain.getAssets().size(), "Default assets limit should be 10");
  }

  @Test
  void test_domainAssetsPaginationGetByIdWithLimitAndOffset(TestInfo test) throws IOException {
    // Tests pagination on get by ID API - verifies different pages return different assets with no
    // duplicates
    Domain domain = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    List<EntityReference> tables = new ArrayList<>();

    for (int i = 0; i < 25; i++) {
      Table table =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, i)), ADMIN_AUTH_HEADERS);
      tables.add(table.getEntityReference());
    }

    bulkAddAssets(domain.getFullyQualifiedName(), new BulkAssets().withAssets(tables));

    WebTarget target = getResource("domains/" + domain.getId());
    target = target.queryParam("fields", "assets");
    target = target.queryParam("assetsLimit", 5);
    target = target.queryParam("assetsOffset", 0);
    Domain firstPage = TestUtils.get(target, Domain.class, ADMIN_AUTH_HEADERS);

    assertNotNull(firstPage.getAssets());
    assertEquals(5, firstPage.getAssets().size(), "Should return 5 assets");

    List<UUID> firstPageIds = firstPage.getAssets().stream().map(EntityReference::getId).toList();

    target = getResource("domains/" + domain.getId());
    target = target.queryParam("fields", "assets");
    target = target.queryParam("assetsLimit", 5);
    target = target.queryParam("assetsOffset", 5);
    Domain secondPage = TestUtils.get(target, Domain.class, ADMIN_AUTH_HEADERS);

    assertNotNull(secondPage.getAssets());
    assertEquals(5, secondPage.getAssets().size(), "Should return 5 more assets");

    List<UUID> secondPageIds = secondPage.getAssets().stream().map(EntityReference::getId).toList();

    for (UUID id : firstPageIds) {
      assertFalse(secondPageIds.contains(id), "Second page should not contain first page assets");
    }
  }

  @Test
  void test_domainAssetsPaginationGetByIdWithCustomLimit(TestInfo test) throws IOException {
    // Tests custom pagination on get by ID API
    Domain domain = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    List<EntityReference> tables = new ArrayList<>();

    for (int i = 0; i < 20; i++) {
      Table table =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, i)), ADMIN_AUTH_HEADERS);
      tables.add(table.getEntityReference());
    }

    bulkAddAssets(domain.getFullyQualifiedName(), new BulkAssets().withAssets(tables));

    WebTarget target = getResource("domains/" + domain.getId());
    target = target.queryParam("fields", "assets");
    target = target.queryParam("assetsLimit", 15);
    target = target.queryParam("assetsOffset", 5);
    Domain fetchedDomain = TestUtils.get(target, Domain.class, ADMIN_AUTH_HEADERS);

    assertNotNull(fetchedDomain.getAssets());
    assertEquals(
        15, fetchedDomain.getAssets().size(), "Should return 15 assets starting from offset 5");
  }

  @Test
  void test_domainAssetsPaginationGetByNameDefault(TestInfo test) throws IOException {
    // Tests default pagination on get by name when no limit/offset specified
    Domain domain = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    List<EntityReference> tables = new ArrayList<>();

    for (int i = 0; i < 20; i++) {
      Table table =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, i)), ADMIN_AUTH_HEADERS);
      tables.add(table.getEntityReference());
    }

    bulkAddAssets(domain.getFullyQualifiedName(), new BulkAssets().withAssets(tables));

    WebTarget target = getResource("domains/name/" + domain.getFullyQualifiedName());
    target = target.queryParam("fields", "assets");
    Domain fetchedDomain = TestUtils.get(target, Domain.class, ADMIN_AUTH_HEADERS);

    assertNotNull(fetchedDomain.getAssets());
    assertEquals(10, fetchedDomain.getAssets().size(), "Default assets limit should be 10");
  }

  @Test
  void test_domainAssetsPaginationGetByNameWithCustomLimit(TestInfo test) throws IOException {
    // Tests custom pagination on get by name
    Domain domain = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    List<EntityReference> tables = new ArrayList<>();

    for (int i = 0; i < 20; i++) {
      Table table =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, i)), ADMIN_AUTH_HEADERS);
      tables.add(table.getEntityReference());
    }

    bulkAddAssets(domain.getFullyQualifiedName(), new BulkAssets().withAssets(tables));

    WebTarget target = getResource("domains/name/" + domain.getFullyQualifiedName());
    target = target.queryParam("fields", "assets");
    target = target.queryParam("assetsLimit", 12);
    target = target.queryParam("assetsOffset", 3);
    Domain fetchedDomain = TestUtils.get(target, Domain.class, ADMIN_AUTH_HEADERS);

    assertNotNull(fetchedDomain.getAssets());
    assertEquals(
        12, fetchedDomain.getAssets().size(), "Should return 12 assets starting from offset 3");
  }

  @Test
  void test_domainAssetsPaginationMultiplePages(TestInfo test) throws IOException {
    // Tests fetching 35 assets across multiple pages (10 per page), verifies all assets are
    // returned without duplicates across
    Domain domain = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    List<EntityReference> tables = new ArrayList<>();

    for (int i = 0; i < 35; i++) {
      Table table =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, i)), ADMIN_AUTH_HEADERS);
      tables.add(table.getEntityReference());
    }

    bulkAddAssets(domain.getFullyQualifiedName(), new BulkAssets().withAssets(tables));

    List<UUID> allFetchedIds = new ArrayList<>();

    for (int offset = 0; offset < 35; offset += 10) {
      WebTarget target = getResource("domains/" + domain.getId());
      target = target.queryParam("fields", "assets");
      target = target.queryParam("assetsLimit", 10);
      target = target.queryParam("assetsOffset", offset);
      Domain fetchedDomain = TestUtils.get(target, Domain.class, ADMIN_AUTH_HEADERS);

      assertNotNull(fetchedDomain.getAssets());
      int expectedSize = Math.min(10, 35 - offset);
      assertEquals(
          expectedSize,
          fetchedDomain.getAssets().size(),
          "Page at offset " + offset + " should return " + expectedSize + " assets");

      List<UUID> pageIds = fetchedDomain.getAssets().stream().map(EntityReference::getId).toList();
      for (UUID id : pageIds) {
        assertFalse(allFetchedIds.contains(id), "Asset should not appear in multiple pages");
      }
      allFetchedIds.addAll(pageIds);
    }

    assertEquals(35, allFetchedIds.size(), "All assets should be fetched across pages");
  }

  @Test
  void test_domainAssetsPaginationOnlyAppliedToSpecifiedField(TestInfo test) throws IOException {
    // Verifies pagination only applies to fields in FieldPagination
    Domain parentDomain = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    Domain childDomain1 =
        createEntity(
            createRequest(getEntityName(test, 1)).withParent(parentDomain.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    Domain childDomain2 =
        createEntity(
            createRequest(getEntityName(test, 2)).withParent(parentDomain.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    Domain childDomain3 =
        createEntity(
            createRequest(getEntityName(test, 3)).withParent(parentDomain.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    TableResourceTest tableTest = new TableResourceTest();
    List<EntityReference> tables = new ArrayList<>();

    for (int i = 0; i < 15; i++) {
      Table table =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, i + 10)), ADMIN_AUTH_HEADERS);
      tables.add(table.getEntityReference());
    }

    bulkAddAssets(parentDomain.getFullyQualifiedName(), new BulkAssets().withAssets(tables));

    WebTarget target = getResource("domains/" + parentDomain.getId());
    target = target.queryParam("fields", "assets,children");
    target = target.queryParam("assetsLimit", 5);
    target = target.queryParam("assetsOffset", 0);
    Domain fetchedDomain = TestUtils.get(target, Domain.class, ADMIN_AUTH_HEADERS);

    assertNotNull(fetchedDomain.getAssets());
    assertEquals(5, fetchedDomain.getAssets().size(), "Assets should be paginated with limit 5");

    assertNotNull(fetchedDomain.getChildren());
    assertEquals(
        3,
        fetchedDomain.getChildren().size(),
        "Children should not be paginated, all 3 children should be returned");
  }

  private void bulkAddAssets(String domainName, BulkAssets request) throws HttpResponseException {
    WebTarget target = getResource("domains/" + domainName + "/assets/add");
    TestUtils.put(target, request, Status.OK, ADMIN_AUTH_HEADERS);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
