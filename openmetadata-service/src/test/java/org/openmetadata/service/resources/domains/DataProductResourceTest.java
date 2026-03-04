package org.openmetadata.service.resources.domains;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.*;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.GenericType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.DataProductPortsView;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.DataProductRepository;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.dashboards.DashboardResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.domains.DataProductResource.DataProductList;
import org.openmetadata.service.resources.topics.TopicResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.TestUtils;

public class DataProductResourceTest extends EntityResourceTest<DataProduct, CreateDataProduct> {
  public DataProductResourceTest() {
    super(
        Entity.DATA_PRODUCT,
        DataProduct.class,
        DataProductList.class,
        "dataProducts",
        DataProductResource.FIELDS);
    supportsPatchDomains = false; // we can't change the domain of a data product
  }

  public void setupDataProducts(TestInfo test) throws HttpResponseException {
    DOMAIN_DATA_PRODUCT = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);
    SUB_DOMAIN_DATA_PRODUCT =
        createEntity(
            createRequest(getEntityName(test, 1))
                .withDomains(List.of(SUB_DOMAIN.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);
  }

  @Test
  void testDataProductAssets(TestInfo test) throws IOException {
    // Disable domain validation rule since TEST_TABLE1 may not have matching domain
    String domainValidationRule = "Data Product Domain Validation";
    EntityResourceTest.toggleRule(domainValidationRule, false);

    try {
      // Create Data product without assets
      CreateDataProduct create = createRequest(getEntityName(test));
      DataProduct product = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

      // Add Table1 as asset using bulk API
      DataProductRepository repository =
          (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);
      BulkAssets addTable1 = new BulkAssets().withAssets(List.of(TEST_TABLE1.getEntityReference()));
      repository.bulkAddAssets(product.getFullyQualifiedName(), addTable1);
      entityInDataProduct(TEST_TABLE1, product, true); // Table1 is part of data product

      TopicResourceTest topicTest = new TopicResourceTest();
      Topic topic =
          topicTest.createEntity(topicTest.createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);

      // Add topic asset using bulk API
      BulkAssets addTopic = new BulkAssets().withAssets(List.of(topic.getEntityReference()));
      repository.bulkAddAssets(product.getFullyQualifiedName(), addTopic);
      entityInDataProduct(topic, product, true); // topic is part of data product

      // Remove topic asset using bulk API
      BulkAssets removeTopic = new BulkAssets().withAssets(List.of(topic.getEntityReference()));
      repository.bulkRemoveAssets(product.getFullyQualifiedName(), removeTopic);
      entityInDataProduct(topic, product, false); // topic is not part of data product

      // Add topic back using bulk API
      repository.bulkAddAssets(product.getFullyQualifiedName(), addTopic);
      entityInDataProduct(topic, product, true); // topic is part of data product

      // Remove topic again using bulk API
      repository.bulkRemoveAssets(product.getFullyQualifiedName(), removeTopic);
      entityInDataProduct(topic, product, false); // topic is not part of data product
    } finally {
      // Re-enable the rule for other tests
      EntityResourceTest.toggleRule(domainValidationRule, true);
    }
  }

  @Test
  void testDataProductExperts(TestInfo test) throws IOException {
    CreateDataProduct create =
        createRequest(getEntityName(test)).withExperts(listOf(USER1.getFullyQualifiedName()));
    DataProduct product = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add User2 as expert using PUT
    create.withExperts(List.of(USER1.getFullyQualifiedName(), USER2.getFullyQualifiedName()));
    ChangeDescription change = getChangeDescription(product, MINOR_UPDATE);
    fieldAdded(change, "experts", listOf(USER2.getEntityReference()));
    product = updateAndCheckEntity(create, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove User2 as expert using PUT
    create.withExperts(List.of(USER1.getFullyQualifiedName()));
    change = getChangeDescription(product, MINOR_UPDATE);
    fieldDeleted(change, "experts", listOf(USER2.getEntityReference()));
    product = updateAndCheckEntity(create, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add User2 as expert using PATCH
    // Changes from this PATCH is consolidated resulting in revert of previous PUT
    String json = JsonUtils.pojoToJson(product);
    change = getChangeDescription(product, MINOR_UPDATE);
    fieldAdded(change, "experts", listOf(USER2.getEntityReference()));
    product.withExperts(List.of(USER1.getEntityReference(), USER2.getEntityReference()));
    product = patchEntityAndCheck(product, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove User2 as expert using PATCH
    // Changes from this PATCH is consolidated with the previous changes resulting in deletion of
    // USER2
    json = JsonUtils.pojoToJson(product);
    product.withExperts(List.of(USER1.getEntityReference()));
    change = getChangeDescription(product, MINOR_UPDATE);
    fieldDeleted(change, "experts", listOf(USER2.getEntityReference()));
    patchEntityAndCheck(product, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void test_listWithDomainFilter(TestInfo test) throws HttpResponseException {
    DomainResourceTest domainTest = new DomainResourceTest();
    String domain1 =
        domainTest
            .createEntity(domainTest.createRequest(test, 1), ADMIN_AUTH_HEADERS)
            .getFullyQualifiedName();
    String domain2 =
        domainTest
            .createEntity(domainTest.createRequest(test, 2), ADMIN_AUTH_HEADERS)
            .getFullyQualifiedName();
    DataProduct p1 =
        createEntity(createRequest(test, 1).withDomains(List.of(domain1)), ADMIN_AUTH_HEADERS);
    DataProduct p2 =
        createEntity(createRequest(test, 2).withDomains(List.of(domain1)), ADMIN_AUTH_HEADERS);
    DataProduct p3 =
        createEntity(createRequest(test, 3).withDomains(List.of(domain2)), ADMIN_AUTH_HEADERS);
    DataProduct p4 =
        createEntity(createRequest(test, 4).withDomains(List.of(domain2)), ADMIN_AUTH_HEADERS);

    Map<String, String> params = new HashMap<>();
    params.put("domain", domain1);
    List<DataProduct> list = listEntities(params, ADMIN_AUTH_HEADERS).getData();
    assertEquals(2, list.size());
    assertTrue(list.stream().anyMatch(s -> s.getName().equals(p1.getName())));
    assertTrue(list.stream().anyMatch(s -> s.getName().equals(p2.getName())));

    params.put("domain", domain2);
    list = listEntities(params, ADMIN_AUTH_HEADERS).getData();
    assertEquals(2, list.size());
    assertTrue(list.stream().anyMatch(s -> s.getName().equals(p3.getName())));
    assertTrue(list.stream().anyMatch(s -> s.getName().equals(p4.getName())));
  }

  @Test
  void testValidateDataProducts() {
    UUID rdnUUID = UUID.randomUUID();
    EntityReference entityReference = new EntityReference().withId(rdnUUID);
    TableRepository entityRepository = (TableRepository) Entity.getEntityRepository(TABLE);

    assertThatThrownBy(() -> entityRepository.validateDataProducts(List.of(entityReference)))
        .isInstanceOf(EntityNotFoundException.class)
        .hasMessage(String.format("dataProduct instance for %s not found", rdnUUID));
  }

  @Test
  void test_bulkAssetsOperationWithMixedAssetTypes(TestInfo test) throws IOException {
    // Disable domain validation rule for this test since we're testing mixed asset types, not
    // domain validation
    String domainValidationRule = "Data Product Domain Validation";
    EntityResourceTest.toggleRule(domainValidationRule, false);

    try {
      // Get the repository instance
      DataProductRepository dataProductRepository =
          (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);

      // Create a data product
      CreateDataProduct create = createRequest(getEntityName(test));
      DataProduct product = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

      // Create different asset types
      TopicResourceTest topicTest = new TopicResourceTest();
      Topic topic =
          topicTest.createEntity(
              topicTest.createRequest(getEntityName(test, 1)), ADMIN_AUTH_HEADERS);

      // Create a dashboard
      DashboardResourceTest dashboardTest = new DashboardResourceTest();
      Dashboard dashboard =
          dashboardTest.createEntity(
              dashboardTest.createRequest(getEntityName(test, 2)), ADMIN_AUTH_HEADERS);

      // Create BulkAssets request with mixed asset types (Table, Dashboard, Topic)
      BulkAssets bulkAssets =
          new BulkAssets()
              .withAssets(
                  List.of(
                      TEST_TABLE1.getEntityReference(),
                      dashboard.getEntityReference(),
                      topic.getEntityReference()));

      // Test bulk add operation
      BulkOperationResult result =
          dataProductRepository.bulkAddAssets(product.getFullyQualifiedName(), bulkAssets);
      assertEquals(ApiStatus.SUCCESS, result.getStatus());
      assertEquals(3, result.getNumberOfRowsProcessed());
      assertEquals(3, result.getNumberOfRowsPassed());

      // Verify all assets are added to the data product using dedicated API
      ResultList<EntityReference> assets =
          dataProductRepository.getDataProductAssets(product.getId(), 100, 0);
      assertEquals(3, assets.getPaging().getTotal());
      assertEquals(3, assets.getData().size());

      // Verify each asset type is present
      List<String> assetTypes =
          assets.getData().stream()
              .map(EntityReference::getType)
              .sorted()
              .collect(Collectors.toList());
      assertEquals(List.of("dashboard", "table", "topic"), assetTypes);

      // Test bulk remove operation
      BulkAssets removeAssets =
          new BulkAssets()
              .withAssets(List.of(dashboard.getEntityReference(), topic.getEntityReference()));

      result =
          dataProductRepository.bulkRemoveAssets(product.getFullyQualifiedName(), removeAssets);
      assertEquals(ApiStatus.SUCCESS, result.getStatus());
      assertEquals(2, result.getNumberOfRowsProcessed());
      assertEquals(2, result.getNumberOfRowsPassed());

      // Verify only table remains using dedicated API
      assets = dataProductRepository.getDataProductAssets(product.getId(), 100, 0);
      assertEquals(1, assets.getPaging().getTotal());
      assertEquals(1, assets.getData().size());
      assertEquals("table", assets.getData().get(0).getType());
      assertEquals(TEST_TABLE1.getId(), assets.getData().get(0).getId());
    } finally {
      // Re-enable the rule for other tests
      EntityResourceTest.toggleRule(domainValidationRule, true);
    }
  }

  @Test
  void test_inheritOwnerExpertsFromDomain(TestInfo test) throws IOException {
    DomainResourceTest domainResourceTest = new DomainResourceTest();

    // Create parent domain
    CreateDomain parentDomainReq =
        domainResourceTest
            .createRequest(test, 1)
            .withOwners(List.of(USER1_REF))
            .withExperts(List.of(USER2.getFullyQualifiedName()));
    Domain parentDomain = domainResourceTest.createEntity(parentDomainReq, ADMIN_AUTH_HEADERS);
    parentDomain = domainResourceTest.getEntity(parentDomain.getId(), "*", ADMIN_AUTH_HEADERS);

    // Create data product corresponding to parent domain
    CreateDataProduct create =
        createRequestWithoutExpertsOwners(getEntityName(test, 1))
            .withDomains(List.of(parentDomain.getFullyQualifiedName()));
    DataProduct dataProduct = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    assertReferenceList(dataProduct.getOwners(), parentDomain.getOwners());
    assertEntityReferences(dataProduct.getExperts(), parentDomain.getExperts());

    // Create subdomain with no owners and experts
    CreateDomain subDomainReq =
        domainResourceTest.createRequestWithoutOwnersExperts(getEntityName(test, 2));
    subDomainReq.setDomains(List.of(parentDomain.getFullyQualifiedName()));

    Domain subDomain = domainResourceTest.createEntity(subDomainReq, ADMIN_AUTH_HEADERS);
    subDomain = domainResourceTest.getEntity(subDomain.getId(), "*", ADMIN_AUTH_HEADERS);

    // Create data product corresponding to subdomain
    CreateDataProduct subDomainDataProductCreate =
        createRequestWithoutExpertsOwners(getEntityName(test, 2))
            .withDomains(List.of(subDomain.getFullyQualifiedName()));
    DataProduct subDomainDataProduct =
        createAndCheckEntity(subDomainDataProductCreate, ADMIN_AUTH_HEADERS);

    // Subdomain and its data product should inherit owners and experts from parent domain
    assertReferenceList(subDomain.getOwners(), parentDomain.getOwners());
    assertEntityReferences(subDomain.getExperts(), parentDomain.getExperts());
    assertReferenceList(subDomainDataProduct.getOwners(), parentDomain.getOwners());
    assertEntityReferences(subDomainDataProduct.getExperts(), parentDomain.getExperts());

    // Add owner and expert to subdomain
    Domain updateSubDomainOwner =
        JsonUtils.readValue(JsonUtils.pojoToJson(subDomain), Domain.class);
    updateSubDomainOwner.setOwners(List.of(TEAM11_REF));
    domainResourceTest.patchEntity(
        subDomain.getId(),
        JsonUtils.pojoToJson(subDomain),
        updateSubDomainOwner,
        ADMIN_AUTH_HEADERS);
    subDomain = domainResourceTest.getEntity(subDomain.getId(), "*", ADMIN_AUTH_HEADERS);

    Domain updateSubDomainExpert =
        JsonUtils.readValue(JsonUtils.pojoToJson(subDomain), Domain.class);
    updateSubDomainExpert.setExperts(List.of(USER1_REF));
    domainResourceTest.patchEntity(
        subDomain.getId(),
        JsonUtils.pojoToJson(subDomain),
        updateSubDomainExpert,
        ADMIN_AUTH_HEADERS);
    subDomain = domainResourceTest.getEntity(subDomain.getId(), "*", ADMIN_AUTH_HEADERS);

    // Data product of subdomain should also have the same changes as its corresponding domain
    assertReferenceList(subDomainDataProduct.getOwners(), subDomain.getOwners());
    assertEntityReferences(subDomainDataProduct.getExperts(), subDomain.getExperts());
  }

  private void entityInDataProduct(
      EntityInterface entity, EntityInterface product, boolean inDataProduct)
      throws HttpResponseException {
    // Only table or topic is expected to assets currently in the tests
    EntityResourceTest<?, ?> test =
        entity.getEntityReference().getType().equals(Entity.TABLE)
            ? new TableResourceTest()
            : new TopicResourceTest();
    entity = test.getEntity(entity.getId(), "dataProducts", ADMIN_AUTH_HEADERS);
    TestUtils.existsInEntityReferenceList(entity.getDataProducts(), product.getId(), inDataProduct);
  }

  @Override
  public CreateDataProduct createRequest(String name) {
    return new CreateDataProduct()
        .withName(name)
        .withDescription(name)
        .withDomains(List.of(DOMAIN.getFullyQualifiedName()))
        .withStyle(new Style().withColor("#40E0D0").withIconURL("https://dataProductIcon"))
        .withExperts(listOf(USER1.getFullyQualifiedName()));
  }

  public CreateDataProduct createRequestWithoutExpertsOwners(String name) {
    return new CreateDataProduct()
        .withName(name)
        .withDescription(name)
        .withDomains(List.of(DOMAIN.getFullyQualifiedName()))
        .withStyle(new Style().withColor("#40E0D0").withIconURL("https://dataProductIcon"));
  }

  @Override
  public void validateCreatedEntity(
      DataProduct createdEntity, CreateDataProduct request, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Entity specific validation
    assertEquals(
        request.getDomains().get(0), createdEntity.getDomains().get(0).getFullyQualifiedName());
    assertEntityReferenceNames(request.getExperts(), createdEntity.getExperts());
    assertStyle(request.getStyle(), createdEntity.getStyle());
  }

  @Override
  public void compareEntities(
      DataProduct expected, DataProduct updated, Map<String, String> authHeaders) {
    // Entity specific validation
    assertReference(expected.getDomains().get(0), updated.getDomains().get(0));
    assertEntityReferences(expected.getExperts(), updated.getExperts());
  }

  @Override
  public DataProduct validateGetWithDifferentFields(DataProduct dataProduct, boolean byName)
      throws HttpResponseException {
    DataProduct getDataProduct =
        byName
            ? getEntityByName(dataProduct.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(dataProduct.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(getDataProduct.getOwners(), getDataProduct.getExperts());
    String fields = "owners,domains,experts,tags,followers";
    getDataProduct =
        byName
            ? getEntityByName(getDataProduct.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(getDataProduct.getId(), fields, ADMIN_AUTH_HEADERS);
    // Fields requested are received
    assertReference(dataProduct.getDomains().get(0), getDataProduct.getDomains().get(0));
    assertEntityReferences(dataProduct.getExperts(), getDataProduct.getExperts());
    // Note: assets field is not available in FIELDS - use dedicated paginated API instead

    // Checks for other owners, tags, and followers is done in the base class
    return getDataProduct;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.startsWith("assets")) {
      assertEntityReferencesFieldChange(expected, actual);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  @Test
  void testBulkAddAssets_DataProductDomainValidation(TestInfo test) throws IOException {
    // Create domains for testing
    DomainResourceTest domainResourceTest = new DomainResourceTest();

    Domain dataDomain =
        domainResourceTest.createEntity(
            domainResourceTest
                .createRequest(test.getDisplayName() + "_DataDomain")
                .withName("DataDomain")
                .withDescription("Data domain for testing"),
            ADMIN_AUTH_HEADERS);

    Domain engineeringDomain =
        domainResourceTest.createEntity(
            domainResourceTest
                .createRequest(test.getDisplayName() + "_EngineeringDomain")
                .withName("EngineeringDomain")
                .withDescription("Engineering domain for testing"),
            ADMIN_AUTH_HEADERS);

    // Create data product with data domain
    CreateDataProduct createDataProduct =
        createRequest(test.getDisplayName() + "_DataProduct")
            .withDomains(List.of(dataDomain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(createDataProduct, ADMIN_AUTH_HEADERS);

    // Create tables with different domain assignments
    TableResourceTest tableResourceTest = new TableResourceTest();

    // Table with matching domain (should succeed in bulk add)
    org.openmetadata.schema.entity.data.Table matchingTable =
        tableResourceTest.createEntity(
            tableResourceTest
                .createRequest(test.getDisplayName() + "_MatchingTable")
                .withDomains(List.of(dataDomain.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);

    // Table with non-matching domain (should fail in bulk add)
    org.openmetadata.schema.entity.data.Table nonMatchingTable =
        tableResourceTest.createEntity(
            tableResourceTest
                .createRequest(test.getDisplayName() + "_NonMatchingTable")
                .withDomains(List.of(engineeringDomain.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);

    // Test 1: Bulk add assets with matching domains - should succeed
    BulkAssets matchingAssetsRequest =
        new BulkAssets().withAssets(List.of(matchingTable.getEntityReference()));

    BulkOperationResult successResult =
        TestUtils.put(
            getCollection().path("/" + dataProduct.getName() + "/assets/add"),
            matchingAssetsRequest,
            BulkOperationResult.class,
            Status.OK,
            ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, successResult.getStatus());
    assertEquals(1, successResult.getNumberOfRowsProcessed());
    assertEquals(1, successResult.getNumberOfRowsPassed());
    assertEquals(0, successResult.getNumberOfRowsFailed());
    assertEquals(1, successResult.getSuccessRequest().size());
    assertTrue(successResult.getFailedRequest().isEmpty());

    // Test 2: Bulk add assets with non-matching domains - should fail
    BulkAssets nonMatchingAssetsRequest =
        new BulkAssets().withAssets(List.of(nonMatchingTable.getEntityReference()));

    BulkOperationResult failResult =
        TestUtils.putExpectStatus(
            getCollection().path("/" + dataProduct.getName() + "/assets/add"),
            nonMatchingAssetsRequest,
            BulkOperationResult.class,
            Status.BAD_REQUEST,
            ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.FAILURE, failResult.getStatus());
    assertEquals(1, failResult.getNumberOfRowsProcessed());
    assertEquals(0, failResult.getNumberOfRowsPassed());
    assertEquals(1, failResult.getNumberOfRowsFailed());
    assertTrue(failResult.getSuccessRequest().isEmpty());
    assertEquals(1, failResult.getFailedRequest().size());
    assertTrue(failResult.getFailedRequest().get(0).getMessage().contains("Cannot assign asset"));
    assertTrue(
        failResult
            .getFailedRequest()
            .get(0)
            .getMessage()
            .contains("Data Product Domain Validation"));

    // Test 3: Mixed bulk operation - one matching, one non-matching
    BulkAssets mixedAssetsRequest =
        new BulkAssets()
            .withAssets(
                List.of(matchingTable.getEntityReference(), nonMatchingTable.getEntityReference()));

    // Remove the matching table first to test mixed scenario cleanly
    BulkAssets removeMatchingRequest =
        new BulkAssets().withAssets(List.of(matchingTable.getEntityReference()));
    TestUtils.put(
        getCollection().path("/" + dataProduct.getName() + "/assets/remove"),
        removeMatchingRequest,
        BulkOperationResult.class,
        Status.OK,
        ADMIN_AUTH_HEADERS);

    // Now test mixed operation
    BulkOperationResult mixedResult =
        TestUtils.put(
            getCollection().path("/" + dataProduct.getName() + "/assets/add"),
            mixedAssetsRequest,
            BulkOperationResult.class,
            Status.OK,
            ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.PARTIAL_SUCCESS, mixedResult.getStatus());
    assertEquals(2, mixedResult.getNumberOfRowsProcessed());
    assertEquals(1, mixedResult.getNumberOfRowsPassed()); // matching table succeeds
    assertEquals(1, mixedResult.getNumberOfRowsFailed()); // non-matching table fails
    assertEquals(1, mixedResult.getSuccessRequest().size());
    assertEquals(1, mixedResult.getFailedRequest().size());

    // Test 4: Disable rule and retry failed operation - should succeed
    String originalRuleName = "Data Product Domain Validation";
    EntityResourceTest.toggleRule(originalRuleName, false);

    try {
      BulkOperationResult disabledRuleResult =
          TestUtils.put(
              getCollection().path("/" + dataProduct.getName() + "/assets/add"),
              nonMatchingAssetsRequest,
              BulkOperationResult.class,
              Status.OK,
              ADMIN_AUTH_HEADERS);

      assertEquals(ApiStatus.SUCCESS, disabledRuleResult.getStatus());
      assertEquals(1, disabledRuleResult.getNumberOfRowsProcessed());
      assertEquals(1, disabledRuleResult.getNumberOfRowsPassed());
      assertEquals(0, disabledRuleResult.getNumberOfRowsFailed());

    } finally {
      // Re-enable rule for other tests
      EntityResourceTest.toggleRule(originalRuleName, true);
    }

    // Test 5: Bulk remove assets - should always work regardless of domain validation
    BulkAssets removeAllRequest =
        new BulkAssets()
            .withAssets(
                List.of(matchingTable.getEntityReference(), nonMatchingTable.getEntityReference()));

    BulkOperationResult removeResult =
        TestUtils.put(
            getCollection().path("/" + dataProduct.getName() + "/assets/remove"),
            removeAllRequest,
            BulkOperationResult.class,
            Status.OK,
            ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, removeResult.getStatus());
    assertEquals(2, removeResult.getNumberOfRowsProcessed());
    assertEquals(2, removeResult.getNumberOfRowsPassed());
    assertEquals(0, removeResult.getNumberOfRowsFailed());
  }

  @Test
  void test_entityStatusUpdateAndPatch(TestInfo test) throws IOException {
    // Create a data product with APPROVED status by default
    CreateDataProduct createDataProduct = createRequest(getEntityName(test));
    DataProduct dataProduct = createEntity(createDataProduct, ADMIN_AUTH_HEADERS);

    // Verify the data product is created with UNPROCESSED status
    assertEquals(
        EntityStatus.UNPROCESSED,
        dataProduct.getEntityStatus(),
        "DataProduct should be created with UNPROCESSED status");

    // Update the entityStatus using PATCH operation
    String originalJson = JsonUtils.pojoToJson(dataProduct);
    dataProduct.setEntityStatus(EntityStatus.IN_REVIEW);

    ChangeDescription change = getChangeDescription(dataProduct, MINOR_UPDATE);
    fieldUpdated(change, "entityStatus", EntityStatus.UNPROCESSED, EntityStatus.IN_REVIEW);
    DataProduct updatedDataProduct =
        patchEntityAndCheck(dataProduct, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Verify the entityStatus was updated correctly
    assertEquals(
        EntityStatus.IN_REVIEW,
        updatedDataProduct.getEntityStatus(),
        "DataProduct should be updated to IN_REVIEW status");

    // Get the data product again to confirm the status is persisted
    DataProduct retrievedDataProduct = getEntity(updatedDataProduct.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(
        EntityStatus.IN_REVIEW,
        retrievedDataProduct.getEntityStatus(),
        "Retrieved data product should maintain IN_REVIEW status");
  }

  @Test
  void test_getDataProductAssetsAPI(TestInfo test) throws IOException {
    String domainValidationRule = "Data Product Domain Validation";
    EntityResourceTest.toggleRule(domainValidationRule, false);

    try {
      CreateDataProduct create = createRequest(getEntityName(test));
      DataProduct dataProduct = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

      TableResourceTest tableTest = new TableResourceTest();
      Table table1 =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, 1)), ADMIN_AUTH_HEADERS);
      Table table2 =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, 2)), ADMIN_AUTH_HEADERS);
      Table table3 =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, 3)), ADMIN_AUTH_HEADERS);

      DataProductRepository repository =
          (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);

      BulkAssets bulkAssets =
          new BulkAssets()
              .withAssets(List.of(table1.getEntityReference(), table2.getEntityReference()));
      bulkAddAssets(dataProduct.getFullyQualifiedName(), bulkAssets);

      ResultList<EntityReference> assets =
          getAssets(dataProduct.getId(), 10, 0, ADMIN_AUTH_HEADERS);

      assertEquals(2, assets.getPaging().getTotal());
      assertEquals(2, assets.getData().size());
      assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table1.getId())));
      assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table2.getId())));

      ResultList<EntityReference> assetsByName =
          getAssetsByName(dataProduct.getFullyQualifiedName(), 10, 0, ADMIN_AUTH_HEADERS);
      assertEquals(2, assetsByName.getPaging().getTotal());
      assertEquals(2, assetsByName.getData().size());

      ResultList<EntityReference> page1 = getAssets(dataProduct.getId(), 1, 0, ADMIN_AUTH_HEADERS);
      assertEquals(2, page1.getPaging().getTotal());
      assertEquals(1, page1.getData().size());

      ResultList<EntityReference> page2 = getAssets(dataProduct.getId(), 1, 1, ADMIN_AUTH_HEADERS);
      assertEquals(2, page2.getPaging().getTotal());
      assertEquals(1, page2.getData().size());
      assertNotEquals(page1.getData().getFirst().getId(), page2.getData().getFirst().getId());

      BulkAssets addTable3 = new BulkAssets().withAssets(List.of(table3.getEntityReference()));
      bulkAddAssets(dataProduct.getFullyQualifiedName(), addTable3);

      ResultList<EntityReference> allAssets =
          getAssets(dataProduct.getId(), 100, 0, ADMIN_AUTH_HEADERS);
      assertEquals(3, allAssets.getPaging().getTotal());
      assertEquals(3, allAssets.getData().size());

      // Test bulk remove assets
      BulkAssets removeTable1 = new BulkAssets().withAssets(List.of(table1.getEntityReference()));
      bulkRemoveAssets(dataProduct.getFullyQualifiedName(), removeTable1);

      // Verify table1 is removed
      assets = getAssets(dataProduct.getId(), 100, 0, ADMIN_AUTH_HEADERS);
      assertEquals(2, assets.getPaging().getTotal());
      assertEquals(2, assets.getData().size());
      assertTrue(assets.getData().stream().noneMatch(a -> a.getId().equals(table1.getId())));
      assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table2.getId())));
      assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table3.getId())));

      // Test pagination after removal
      page1 = getAssets(dataProduct.getId(), 1, 0, ADMIN_AUTH_HEADERS);
      assertEquals(2, page1.getPaging().getTotal());
      assertEquals(1, page1.getData().size());

      page2 = getAssets(dataProduct.getId(), 1, 1, ADMIN_AUTH_HEADERS);
      assertEquals(2, page2.getPaging().getTotal());
      assertEquals(1, page2.getData().size());
      assertNotEquals(page1.getData().getFirst().getId(), page2.getData().getFirst().getId());

      // Remove remaining assets
      BulkAssets removeRemaining =
          new BulkAssets()
              .withAssets(List.of(table2.getEntityReference(), table3.getEntityReference()));
      bulkRemoveAssets(dataProduct.getFullyQualifiedName(), removeRemaining);

      // Verify all assets are removed
      assets = getAssets(dataProduct.getId(), 100, 0, ADMIN_AUTH_HEADERS);
      assertEquals(0, assets.getPaging().getTotal());
      assertEquals(0, assets.getData().size());
    } finally {
      EntityResourceTest.toggleRule(domainValidationRule, true);
    }
  }

  private void bulkAddAssets(String dataProductName, BulkAssets request)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + dataProductName + "/assets/add");
    TestUtils.put(target, request, Status.OK, ADMIN_AUTH_HEADERS);
  }

  private void bulkRemoveAssets(String dataProductName, BulkAssets request)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + dataProductName + "/assets/remove");
    TestUtils.put(target, request, Status.OK, ADMIN_AUTH_HEADERS);
  }

  @SuppressWarnings("unchecked")
  private ResultList<Map<String, Object>> getInputPorts(UUID dataProductId, int limit, int offset)
      throws HttpResponseException {
    WebTarget target =
        getResource("dataProducts/" + dataProductId + "/inputPorts")
            .queryParam("limit", limit)
            .queryParam("offset", offset);
    return TestUtils.get(target, ResultList.class, ADMIN_AUTH_HEADERS);
  }

  @SuppressWarnings("unchecked")
  private ResultList<Map<String, Object>> getOutputPorts(UUID dataProductId, int limit, int offset)
      throws HttpResponseException {
    WebTarget target =
        getResource("dataProducts/" + dataProductId + "/outputPorts")
            .queryParam("limit", limit)
            .queryParam("offset", offset);
    return TestUtils.get(target, ResultList.class, ADMIN_AUTH_HEADERS);
  }

  private UUID getEntityId(Map<String, Object> entity) {
    return UUID.fromString((String) entity.get("id"));
  }

  @Test
  void testDataProductBulkInputPorts(TestInfo test) throws IOException {
    // Create tables to use as input port assets
    TableResourceTest tableTest = new TableResourceTest();
    Table inputTable1 =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test) + "_bulk_input1"), ADMIN_AUTH_HEADERS);
    Table inputTable2 =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test) + "_bulk_input2"), ADMIN_AUTH_HEADERS);

    // Create data product without ports
    CreateDataProduct create = createRequest(getEntityName(test));
    DataProduct product = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Verify no input ports initially using paginated API
    ResultList<Map<String, Object>> inputPorts = getInputPorts(product.getId(), 10, 0);
    assertTrue(inputPorts.getData().isEmpty());

    // Bulk add input ports
    DataProductRepository repository =
        (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);
    BulkAssets bulkAssets =
        new BulkAssets()
            .withAssets(
                List.of(inputTable1.getEntityReference(), inputTable2.getEntityReference()));
    BulkOperationResult result =
        repository.bulkAddInputPorts(product.getFullyQualifiedName(), bulkAssets);

    assertEquals(ApiStatus.SUCCESS, result.getStatus());
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertEquals(2, result.getNumberOfRowsPassed());

    // Verify input ports were added using paginated API (returns full entities)
    inputPorts = getInputPorts(product.getId(), 10, 0);
    assertEquals(2, inputPorts.getData().size());
    assertTrue(
        inputPorts.getData().stream().anyMatch(p -> getEntityId(p).equals(inputTable1.getId())));
    assertTrue(
        inputPorts.getData().stream().anyMatch(p -> getEntityId(p).equals(inputTable2.getId())));

    // Bulk remove one input port
    BulkAssets removeAssets =
        new BulkAssets().withAssets(List.of(inputTable1.getEntityReference()));
    result = repository.bulkRemoveInputPorts(product.getFullyQualifiedName(), removeAssets);

    assertEquals(ApiStatus.SUCCESS, result.getStatus());
    assertEquals(1, result.getNumberOfRowsProcessed());

    // Verify only one input port remains using paginated API
    inputPorts = getInputPorts(product.getId(), 10, 0);
    assertEquals(1, inputPorts.getData().size());
    assertEquals(inputTable2.getId(), getEntityId(inputPorts.getData().get(0)));
  }

  @Test
  void testDataProductBulkOutputPorts(TestInfo test) throws IOException {
    // Create tables to use as output port assets
    TableResourceTest tableTest = new TableResourceTest();
    Table outputTable1 =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test) + "_bulk_output1"), ADMIN_AUTH_HEADERS);
    Table outputTable2 =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test) + "_bulk_output2"), ADMIN_AUTH_HEADERS);

    // Create data product without ports
    CreateDataProduct create = createRequest(getEntityName(test));
    DataProduct product = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Bulk add output ports
    DataProductRepository repository =
        (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);
    BulkAssets bulkAssets =
        new BulkAssets()
            .withAssets(
                List.of(outputTable1.getEntityReference(), outputTable2.getEntityReference()));
    BulkOperationResult result =
        repository.bulkAddOutputPorts(product.getFullyQualifiedName(), bulkAssets);

    assertEquals(ApiStatus.SUCCESS, result.getStatus());
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertEquals(2, result.getNumberOfRowsPassed());

    // Verify output ports were added using paginated API (returns full entities)
    ResultList<Map<String, Object>> outputPorts = getOutputPorts(product.getId(), 10, 0);
    assertEquals(2, outputPorts.getData().size());

    // Bulk remove all output ports
    result = repository.bulkRemoveOutputPorts(product.getFullyQualifiedName(), bulkAssets);

    assertEquals(ApiStatus.SUCCESS, result.getStatus());

    // Verify no output ports remain using paginated API
    outputPorts = getOutputPorts(product.getId(), 10, 0);
    assertTrue(outputPorts.getData().isEmpty());
  }

  @Test
  void testDataProductBulkPortsViaApi(TestInfo test) throws IOException, InterruptedException {
    // Create tables to use as port assets
    TableResourceTest tableTest = new TableResourceTest();
    Table inputTable =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test) + "_api_input"), ADMIN_AUTH_HEADERS);
    Table outputTable =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test) + "_api_output"), ADMIN_AUTH_HEADERS);

    // Create data product without ports
    CreateDataProduct create = createRequest(getEntityName(test));
    DataProduct product = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add input port via REST API
    WebTarget bulkAddInputTarget =
        getResource("dataProducts/" + product.getFullyQualifiedName() + "/inputPorts/add");
    BulkAssets inputAssets = new BulkAssets().withAssets(List.of(inputTable.getEntityReference()));
    BulkOperationResult inputResult =
        TestUtils.put(
            bulkAddInputTarget,
            inputAssets,
            BulkOperationResult.class,
            Status.OK,
            ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, inputResult.getStatus());
    assertEquals(1, inputResult.getNumberOfRowsPassed());

    // Add output port via REST API
    WebTarget bulkAddOutputTarget =
        getResource("dataProducts/" + product.getFullyQualifiedName() + "/outputPorts/add");
    BulkAssets outputAssets =
        new BulkAssets().withAssets(List.of(outputTable.getEntityReference()));
    BulkOperationResult outputResult =
        TestUtils.put(
            bulkAddOutputTarget,
            outputAssets,
            BulkOperationResult.class,
            Status.OK,
            ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, outputResult.getStatus());
    assertEquals(1, outputResult.getNumberOfRowsPassed());

    // Verify ports were added using paginated API (returns full entities)
    ResultList<Map<String, Object>> inputPorts = getInputPorts(product.getId(), 10, 0);
    assertEquals(1, inputPorts.getData().size());
    assertEquals(inputTable.getId(), getEntityId(inputPorts.getData().get(0)));
    ResultList<Map<String, Object>> outputPorts = getOutputPorts(product.getId(), 10, 0);
    assertEquals(1, outputPorts.getData().size());
    assertEquals(outputTable.getId(), getEntityId(outputPorts.getData().get(0)));

    // Remove input port via REST API
    WebTarget bulkRemoveInputTarget =
        getResource("dataProducts/" + product.getFullyQualifiedName() + "/inputPorts/remove");
    BulkOperationResult removeResult =
        TestUtils.put(
            bulkRemoveInputTarget,
            inputAssets,
            BulkOperationResult.class,
            Status.OK,
            ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, removeResult.getStatus());

    // Verify input port was removed using paginated API
    inputPorts = getInputPorts(product.getId(), 10, 0);
    assertTrue(inputPorts.getData().isEmpty());
    outputPorts = getOutputPorts(product.getId(), 10, 0);
    assertEquals(1, outputPorts.getData().size());

    // Remove output port via REST API
    WebTarget bulkRemoveOutputTarget =
        getResource("dataProducts/" + product.getFullyQualifiedName() + "/outputPorts/remove");
    removeResult =
        TestUtils.put(
            bulkRemoveOutputTarget,
            outputAssets,
            BulkOperationResult.class,
            Status.OK,
            ADMIN_AUTH_HEADERS);

    assertEquals(ApiStatus.SUCCESS, removeResult.getStatus());

    // Verify all ports were removed using paginated API
    inputPorts = getInputPorts(product.getId(), 10, 0);
    assertTrue(inputPorts.getData().isEmpty());
    outputPorts = getOutputPorts(product.getId(), 10, 0);
    assertTrue(outputPorts.getData().isEmpty());
  }

  @Test
  void testGetInputPortsReturnsFullEntities(TestInfo test) throws IOException {
    // Test that GET /inputPorts returns full entity objects with all expected fields
    TableResourceTest tableTest = new TableResourceTest();
    Table inputTable =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test) + "_full_entity"), ADMIN_AUTH_HEADERS);

    CreateDataProduct create = createRequest(getEntityName(test));
    DataProduct product = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add input port
    DataProductRepository repository =
        (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);
    repository.bulkAddInputPorts(
        product.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(inputTable.getEntityReference())));

    // Get input ports and validate full entity fields
    ResultList<Map<String, Object>> inputPorts = getInputPorts(product.getId(), 10, 0);
    assertEquals(1, inputPorts.getData().size());

    Map<String, Object> portEntity = inputPorts.getData().get(0);
    // Validate essential entity fields are present
    assertNotNull(portEntity.get("id"), "Entity should have id");
    assertNotNull(portEntity.get("name"), "Entity should have name");
    assertNotNull(portEntity.get("fullyQualifiedName"), "Entity should have fullyQualifiedName");
    assertEquals(inputTable.getName(), portEntity.get("name"));
    assertEquals(inputTable.getFullyQualifiedName(), portEntity.get("fullyQualifiedName"));
  }

  @Test
  void testGetOutputPortsReturnsFullEntities(TestInfo test) throws IOException {
    // Test that GET /outputPorts returns full entity objects with all expected fields
    TableResourceTest tableTest = new TableResourceTest();
    Table outputTable =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test) + "_full_entity"), ADMIN_AUTH_HEADERS);

    CreateDataProduct create = createRequest(getEntityName(test));
    DataProduct product = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add output port
    DataProductRepository repository =
        (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);
    repository.bulkAddOutputPorts(
        product.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(outputTable.getEntityReference())));

    // Get output ports and validate full entity fields
    ResultList<Map<String, Object>> outputPorts = getOutputPorts(product.getId(), 10, 0);
    assertEquals(1, outputPorts.getData().size());

    Map<String, Object> portEntity = outputPorts.getData().get(0);
    // Validate essential entity fields are present
    assertNotNull(portEntity.get("id"), "Entity should have id");
    assertNotNull(portEntity.get("name"), "Entity should have name");
    assertNotNull(portEntity.get("fullyQualifiedName"), "Entity should have fullyQualifiedName");
    assertEquals(outputTable.getName(), portEntity.get("name"));
    assertEquals(outputTable.getFullyQualifiedName(), portEntity.get("fullyQualifiedName"));
  }

  @Test
  void testGetPortsViewEndpoint(TestInfo test) throws IOException {
    // Test the combined portsView endpoint
    TableResourceTest tableTest = new TableResourceTest();
    Table inputTable =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test) + "_view_input"), ADMIN_AUTH_HEADERS);
    Table outputTable =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test) + "_view_output"), ADMIN_AUTH_HEADERS);

    CreateDataProduct create = createRequest(getEntityName(test));
    DataProduct product = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add ports
    DataProductRepository repository =
        (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);
    repository.bulkAddInputPorts(
        product.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(inputTable.getEntityReference())));
    repository.bulkAddOutputPorts(
        product.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(outputTable.getEntityReference())));

    // Get portsView via REST API
    WebTarget target =
        getResource("dataProducts/" + product.getId() + "/portsView")
            .queryParam("inputLimit", 10)
            .queryParam("inputOffset", 0)
            .queryParam("outputLimit", 10)
            .queryParam("outputOffset", 0);
    DataProductPortsView portsView =
        TestUtils.get(target, DataProductPortsView.class, ADMIN_AUTH_HEADERS);

    // Validate response
    assertNotNull(portsView.getEntity());
    assertEquals(product.getId(), portsView.getEntity().getId());

    assertNotNull(portsView.getInputPorts());
    assertEquals(1, portsView.getInputPorts().getPaging().getTotal());
    assertEquals(1, portsView.getInputPorts().getData().size());

    assertNotNull(portsView.getOutputPorts());
    assertEquals(1, portsView.getOutputPorts().getPaging().getTotal());
    assertEquals(1, portsView.getOutputPorts().getData().size());
  }

  @Test
  void testGetPortsByNameEndpoints(TestInfo test) throws IOException {
    // Test the /name/{fqn}/inputPorts and /name/{fqn}/outputPorts endpoints
    TableResourceTest tableTest = new TableResourceTest();
    Table inputTable =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test) + "_byname_input"), ADMIN_AUTH_HEADERS);
    Table outputTable =
        tableTest.createEntity(
            tableTest.createRequest(getEntityName(test) + "_byname_output"), ADMIN_AUTH_HEADERS);

    CreateDataProduct create = createRequest(getEntityName(test));
    DataProduct product = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add ports
    DataProductRepository repository =
        (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);
    repository.bulkAddInputPorts(
        product.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(inputTable.getEntityReference())));
    repository.bulkAddOutputPorts(
        product.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(outputTable.getEntityReference())));

    // Get input ports by name
    WebTarget inputTarget =
        getResource("dataProducts/name/" + product.getFullyQualifiedName() + "/inputPorts")
            .queryParam("limit", 10)
            .queryParam("offset", 0);
    ResultList<?> inputPorts = TestUtils.get(inputTarget, ResultList.class, ADMIN_AUTH_HEADERS);
    assertEquals(1, inputPorts.getData().size());

    // Get output ports by name
    WebTarget outputTarget =
        getResource("dataProducts/name/" + product.getFullyQualifiedName() + "/outputPorts")
            .queryParam("limit", 10)
            .queryParam("offset", 0);
    ResultList<?> outputPorts = TestUtils.get(outputTarget, ResultList.class, ADMIN_AUTH_HEADERS);
    assertEquals(1, outputPorts.getData().size());

    // Get portsView by name
    WebTarget portsViewTarget =
        getResource("dataProducts/name/" + product.getFullyQualifiedName() + "/portsView")
            .queryParam("inputLimit", 10)
            .queryParam("inputOffset", 0)
            .queryParam("outputLimit", 10)
            .queryParam("outputOffset", 0);
    DataProductPortsView portsView =
        TestUtils.get(portsViewTarget, DataProductPortsView.class, ADMIN_AUTH_HEADERS);
    assertEquals(product.getId(), portsView.getEntity().getId());
    assertEquals(1, portsView.getInputPorts().getData().size());
    assertEquals(1, portsView.getOutputPorts().getData().size());
  }

  @Test
  void testEmptyPortsReturnsEmptyList(TestInfo test) throws IOException {
    // Test that a data product with no ports returns empty lists
    CreateDataProduct create = createRequest(getEntityName(test));
    DataProduct product = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Get input ports - should be empty
    ResultList<Map<String, Object>> inputPorts = getInputPorts(product.getId(), 10, 0);
    assertTrue(inputPorts.getData().isEmpty());
    assertEquals(0, inputPorts.getPaging().getTotal());

    // Get output ports - should be empty
    ResultList<Map<String, Object>> outputPorts = getOutputPorts(product.getId(), 10, 0);
    assertTrue(outputPorts.getData().isEmpty());
    assertEquals(0, outputPorts.getPaging().getTotal());

    // Get portsView - should have empty lists
    WebTarget target =
        getResource("dataProducts/" + product.getId() + "/portsView")
            .queryParam("inputLimit", 10)
            .queryParam("inputOffset", 0)
            .queryParam("outputLimit", 10)
            .queryParam("outputOffset", 0);
    DataProductPortsView portsView =
        TestUtils.get(target, DataProductPortsView.class, ADMIN_AUTH_HEADERS);

    assertEquals(0, portsView.getInputPorts().getPaging().getTotal());
    assertTrue(portsView.getInputPorts().getData().isEmpty());
    assertEquals(0, portsView.getOutputPorts().getPaging().getTotal());
    assertTrue(portsView.getOutputPorts().getData().isEmpty());
  }

  @Test
  void test_getAllDataProductsWithAssetsCount(TestInfo test) throws IOException {
    String domainValidationRule = "Data Product Domain Validation";
    EntityResourceTest.toggleRule(domainValidationRule, false);

    try {
      DomainResourceTest domainTest = new DomainResourceTest();
      Domain domain = domainTest.createEntity(domainTest.createRequest(test), ADMIN_AUTH_HEADERS);

      DataProduct dataProduct1 =
          createEntity(
              createRequest(getEntityName(test, 1))
                  .withDomains(List.of(domain.getFullyQualifiedName())),
              ADMIN_AUTH_HEADERS);
      DataProduct dataProduct2 =
          createEntity(
              createRequest(getEntityName(test, 2))
                  .withDomains(List.of(domain.getFullyQualifiedName())),
              ADMIN_AUTH_HEADERS);

      TableResourceTest tableTest = new TableResourceTest();
      Table table1 =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, 3)), ADMIN_AUTH_HEADERS);
      Table table2 =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, 4)), ADMIN_AUTH_HEADERS);
      Table table3 =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, 5)), ADMIN_AUTH_HEADERS);

      bulkAddAssets(
          dataProduct1.getFullyQualifiedName(),
          new BulkAssets()
              .withAssets(List.of(table1.getEntityReference(), table2.getEntityReference())));
      bulkAddAssets(
          dataProduct2.getFullyQualifiedName(),
          new BulkAssets().withAssets(List.of(table3.getEntityReference())));

      Map<String, Integer> assetsCount = getAllDataProductsWithAssetsCount();

      assertNotNull(assetsCount);
      assertEquals(
          2,
          assetsCount.get(dataProduct1.getFullyQualifiedName()),
          "Data product 1 should have 2 assets");
      assertEquals(
          1,
          assetsCount.get(dataProduct2.getFullyQualifiedName()),
          "Data product 2 should have 1 asset");
    } finally {
      EntityResourceTest.toggleRule(domainValidationRule, true);
    }
  }

  private Map<String, Integer> getAllDataProductsWithAssetsCount() throws HttpResponseException {
    WebTarget target = getResource("dataProducts/assets/counts");
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
    return response.readEntity(new GenericType<Map<String, Integer>>() {});
  }

  @Test
  void testRenameDataProduct(TestInfo test) throws IOException {
    // Create a data product
    DomainResourceTest domainTest = new DomainResourceTest();
    Domain domain = domainTest.createEntity(domainTest.createRequest(test), ADMIN_AUTH_HEADERS);

    DataProduct dataProduct =
        createEntity(
            createRequest(getEntityName(test)).withDomains(List.of(domain.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);

    String oldName = dataProduct.getName();
    String oldFqn = dataProduct.getFullyQualifiedName();
    String newName = "renamed-" + oldName;

    // Rename the data product using PATCH
    String json = JsonUtils.pojoToJson(dataProduct);
    ChangeDescription change = getChangeDescription(dataProduct, MINOR_UPDATE);
    fieldUpdated(change, "name", oldName, newName);
    dataProduct.setName(newName);
    // FQN for data product is quoted name
    dataProduct.setFullyQualifiedName(FullyQualifiedName.quoteName(newName));

    dataProduct = patchEntityAndCheck(dataProduct, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Verify the data product was renamed
    assertEquals(newName, dataProduct.getName());
    assertNotEquals(oldFqn, dataProduct.getFullyQualifiedName());

    // Verify we can get by new FQN
    DataProduct getByFqn = getEntityByName(dataProduct.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    assertEquals(newName, getByFqn.getName());

    // Verify old FQN no longer works
    assertThatThrownBy(() -> getEntityByName(oldFqn, ADMIN_AUTH_HEADERS))
        .isInstanceOf(HttpResponseException.class);
  }

  @Test
  void testRenameDataProductWithAssets(TestInfo test) throws IOException {
    // Disable domain validation rule since test tables may not have matching domain
    String domainValidationRule = "Data Product Domain Validation";
    EntityResourceTest.toggleRule(domainValidationRule, false);

    try {
      // Create a domain and data product
      DomainResourceTest domainTest = new DomainResourceTest();
      Domain domain = domainTest.createEntity(domainTest.createRequest(test), ADMIN_AUTH_HEADERS);

      DataProduct dataProduct =
          createEntity(
              createRequest(getEntityName(test))
                  .withDomains(List.of(domain.getFullyQualifiedName())),
              ADMIN_AUTH_HEADERS);

      String oldFqn = dataProduct.getFullyQualifiedName();

      // Add an asset to the data product
      TableResourceTest tableTest = new TableResourceTest();
      Table table =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, 1)), ADMIN_AUTH_HEADERS);
      bulkAddAssets(
          dataProduct.getFullyQualifiedName(),
          new BulkAssets().withAssets(List.of(table.getEntityReference())));

      // Verify asset count and that table has the data product reference
      ResultList<EntityReference> assets =
          getAssets(dataProduct.getId(), 10, 0, ADMIN_AUTH_HEADERS);
      assertEquals(1, assets.getPaging().getTotal());

      // Verify the table has the data product in its dataProducts field
      Table tableWithDataProducts =
          tableTest.getEntity(table.getId(), "dataProducts", ADMIN_AUTH_HEADERS);
      assertNotNull(tableWithDataProducts.getDataProducts());
      assertEquals(1, tableWithDataProducts.getDataProducts().size());
      assertEquals(oldFqn, tableWithDataProducts.getDataProducts().get(0).getFullyQualifiedName());

      String oldName = dataProduct.getName();
      String newName = "renamed-" + oldName;
      String newFqn = FullyQualifiedName.quoteName(newName);

      // Rename the data product
      String json = JsonUtils.pojoToJson(dataProduct);
      ChangeDescription change = getChangeDescription(dataProduct, MINOR_UPDATE);
      fieldUpdated(change, "name", oldName, newName);
      dataProduct.setName(newName);
      dataProduct.setFullyQualifiedName(newFqn);

      dataProduct =
          patchEntityAndCheck(dataProduct, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

      // Verify the data product was renamed
      assertEquals(newName, dataProduct.getName());
      assertEquals(newFqn, dataProduct.getFullyQualifiedName());

      // Verify assets are still associated with the renamed data product
      assets = getAssets(dataProduct.getId(), 10, 0, ADMIN_AUTH_HEADERS);
      assertEquals(1, assets.getPaging().getTotal());
      assertEquals(table.getId(), assets.getData().getFirst().getId());

      // Verify the table's dataProducts field has the UPDATED FQN
      tableWithDataProducts =
          tableTest.getEntity(table.getId(), "dataProducts", ADMIN_AUTH_HEADERS);
      assertNotNull(tableWithDataProducts.getDataProducts());
      assertEquals(1, tableWithDataProducts.getDataProducts().size());
      assertEquals(
          newFqn,
          tableWithDataProducts.getDataProducts().get(0).getFullyQualifiedName(),
          "Table's dataProducts reference should have updated FQN after rename");
    } finally {
      EntityResourceTest.toggleRule(domainValidationRule, true);
    }
  }

  @Test
  void testRenameDataProductSearchIndexUpdate(TestInfo test)
      throws IOException, InterruptedException {
    // Disable domain validation rule since test tables may not have matching domain
    String domainValidationRule = "Data Product Domain Validation";
    EntityResourceTest.toggleRule(domainValidationRule, false);

    try {
      // Use simple alphanumeric names to avoid URL encoding issues in search queries
      String timestamp = String.valueOf(System.currentTimeMillis());
      String simpleName = "searchIndexTestDP" + timestamp;
      String simpleDomainName = "searchIndexTestDomain" + timestamp;
      String simpleTableName = "searchIndexTestTable" + timestamp;

      // Create a domain and data product
      DomainResourceTest domainTest = new DomainResourceTest();
      Domain domain =
          domainTest.createEntity(domainTest.createRequest(simpleDomainName), ADMIN_AUTH_HEADERS);

      DataProduct dataProduct =
          createEntity(
              createRequest(simpleName).withDomains(List.of(domain.getFullyQualifiedName())),
              ADMIN_AUTH_HEADERS);

      String oldFqn = dataProduct.getFullyQualifiedName();

      // Add an asset to the data product
      TableResourceTest tableTest = new TableResourceTest();
      Table table =
          tableTest.createEntity(tableTest.createRequest(simpleTableName), ADMIN_AUTH_HEADERS);
      bulkAddAssets(
          dataProduct.getFullyQualifiedName(),
          new BulkAssets().withAssets(List.of(table.getEntityReference())));

      // Wait for search index to be updated
      Thread.sleep(2000);

      // Verify asset can be found via search with old FQN
      String searchQuery = "dataProducts.fullyQualifiedName:" + escapeSearchQuery(oldFqn);
      String searchResponse = searchWithQuery("table_search_index", searchQuery);
      assertTrue(
          searchResponse.contains(table.getName()),
          "Table should be found in search with old dataProduct FQN");

      String oldName = dataProduct.getName();
      String newName = "renamed-" + oldName;
      String newFqn = FullyQualifiedName.quoteName(newName);

      // Rename the data product
      String json = JsonUtils.pojoToJson(dataProduct);
      ChangeDescription change = getChangeDescription(dataProduct, MINOR_UPDATE);
      fieldUpdated(change, "name", oldName, newName);
      dataProduct.setName(newName);
      dataProduct.setFullyQualifiedName(newFqn);

      dataProduct =
          patchEntityAndCheck(dataProduct, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

      // Wait for search index to be updated
      Thread.sleep(2000);

      // Verify asset can be found via search with NEW FQN
      searchQuery = "dataProducts.fullyQualifiedName:" + escapeSearchQuery(newFqn);
      searchResponse = searchWithQuery("table_search_index", searchQuery);
      assertTrue(
          searchResponse.contains(table.getName()),
          "Table should be found in search with new dataProduct FQN after rename");

    } finally {
      EntityResourceTest.toggleRule(domainValidationRule, true);
    }
  }

  private String searchWithQuery(String indexName, String query) throws HttpResponseException {
    WebTarget target =
        getResource(
            String.format(
                "search/query?q=%s&index=%s&from=0&deleted=false&size=100", query, indexName));
    return TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
  }

  private String escapeSearchQuery(String value) {
    // Escape special characters for Elasticsearch query
    return value.replace("\"", "\\\"");
  }

  @Test
  void testMultipleRenamesDataProductWithAssets(TestInfo test) throws IOException {
    // Test that assets are preserved after multiple renames
    String domainValidationRule = "Data Product Domain Validation";
    EntityResourceTest.toggleRule(domainValidationRule, false);

    try {
      // Create a domain and data product
      DomainResourceTest domainTest = new DomainResourceTest();
      Domain domain = domainTest.createEntity(domainTest.createRequest(test), ADMIN_AUTH_HEADERS);

      DataProduct dataProduct =
          createEntity(
              createRequest(getEntityName(test))
                  .withDomains(List.of(domain.getFullyQualifiedName())),
              ADMIN_AUTH_HEADERS);

      // Add an asset to the data product
      TableResourceTest tableTest = new TableResourceTest();
      Table table =
          tableTest.createEntity(
              tableTest.createRequest(getEntityName(test, 1)), ADMIN_AUTH_HEADERS);
      bulkAddAssets(
          dataProduct.getFullyQualifiedName(),
          new BulkAssets().withAssets(List.of(table.getEntityReference())));

      // Verify initial asset count
      ResultList<EntityReference> assets =
          getAssets(dataProduct.getId(), 10, 0, ADMIN_AUTH_HEADERS);
      assertEquals(1, assets.getPaging().getTotal(), "Initial asset count should be 1");

      // Perform multiple renames and verify assets after each
      String[] newNames = {"renamed-first", "renamed-second", "renamed-third"};

      for (int i = 0; i < newNames.length; i++) {
        String oldName = dataProduct.getName();
        String oldFqn = dataProduct.getFullyQualifiedName();
        String newName = newNames[i] + "-" + UUID.randomUUID().toString().substring(0, 8);
        String newFqn = FullyQualifiedName.quoteName(newName);

        // Rename the data product
        String json = JsonUtils.pojoToJson(dataProduct);
        ChangeDescription change = getChangeDescription(dataProduct, MINOR_UPDATE);
        fieldUpdated(change, "name", oldName, newName);
        dataProduct.setName(newName);
        dataProduct.setFullyQualifiedName(newFqn);

        dataProduct =
            patchEntityAndCheck(dataProduct, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

        // Verify the data product was renamed
        assertEquals(newName, dataProduct.getName());
        assertEquals(newFqn, dataProduct.getFullyQualifiedName());

        // Verify old FQN no longer works
        final String finalOldFqn = oldFqn;
        assertThatThrownBy(() -> getEntityByName(finalOldFqn, ADMIN_AUTH_HEADERS))
            .isInstanceOf(HttpResponseException.class);

        // CRITICAL: Verify assets are still associated after rename
        assets = getAssets(dataProduct.getId(), 10, 0, ADMIN_AUTH_HEADERS);
        assertEquals(
            1,
            assets.getPaging().getTotal(),
            "Asset count should still be 1 after rename " + (i + 1));
        assertEquals(
            table.getId(),
            assets.getData().getFirst().getId(),
            "Asset should still be the same table after rename " + (i + 1));

        // Verify the table's dataProducts field has the UPDATED FQN
        Table tableWithDataProducts =
            tableTest.getEntity(table.getId(), "dataProducts", ADMIN_AUTH_HEADERS);
        assertNotNull(
            tableWithDataProducts.getDataProducts(),
            "Table should still have dataProducts after rename " + (i + 1));
        assertEquals(
            1,
            tableWithDataProducts.getDataProducts().size(),
            "Table should have exactly 1 data product after rename " + (i + 1));
        assertEquals(
            newFqn,
            tableWithDataProducts.getDataProducts().get(0).getFullyQualifiedName(),
            "Table's dataProducts reference should have updated FQN after rename " + (i + 1));
      }
    } finally {
      EntityResourceTest.toggleRule(domainValidationRule, true);
    }
  }

  @Test
  void testRenameDataProductWithDuplicateName(TestInfo test) throws IOException {
    // Create a domain
    DomainResourceTest domainTest = new DomainResourceTest();
    Domain domain = domainTest.createEntity(domainTest.createRequest(test), ADMIN_AUTH_HEADERS);

    // Create two data products
    DataProduct dataProduct1 =
        createEntity(
            createRequest(getEntityName(test, 1))
                .withDomains(List.of(domain.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);

    DataProduct dataProduct2 =
        createEntity(
            createRequest(getEntityName(test, 2))
                .withDomains(List.of(domain.getFullyQualifiedName())),
            ADMIN_AUTH_HEADERS);

    // Try to rename dataProduct1 to the name of dataProduct2
    String json = JsonUtils.pojoToJson(dataProduct1);
    dataProduct1.setName(dataProduct2.getName());
    dataProduct1.setFullyQualifiedName(FullyQualifiedName.quoteName(dataProduct2.getName()));

    // Expect an exception when trying to rename to an existing name
    assertThatThrownBy(
            () -> patchEntity(dataProduct1.getId(), json, dataProduct1, ADMIN_AUTH_HEADERS))
        .isInstanceOf(HttpResponseException.class)
        .hasMessageContaining("already exists");
  }

  /**
   * Helper method to rename a data product and verify the change.
   */
  public void renameDataProductAndCheck(DataProduct dataProduct, String newName)
      throws IOException {
    String oldName = dataProduct.getName();
    String json = JsonUtils.pojoToJson(dataProduct);
    ChangeDescription change = getChangeDescription(dataProduct, MINOR_UPDATE);
    fieldUpdated(change, "name", oldName, newName);
    dataProduct.setName(newName);
    dataProduct.setFullyQualifiedName(FullyQualifiedName.quoteName(newName));
    patchEntityAndCheck(dataProduct, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // GET the data product and verify it was renamed
    DataProduct updated = getEntity(dataProduct.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(newName, updated.getName());
  }

  @Test
  void testDataProductDomainMigration(TestInfo test) throws IOException {
    // Test that when a data product's domain changes, all its assets are migrated to the new domain

    // Disable domain validation rule since we need to add assets before domain migration
    String domainValidationRule = "Data Product Domain Validation";
    EntityResourceTest.toggleRule(domainValidationRule, false);

    try {
      // Create two domains
      DomainResourceTest domainTest = new DomainResourceTest();
      Domain sourceDomain =
          domainTest.createEntity(
              domainTest.createRequest(getEntityName(test) + "_source"), ADMIN_AUTH_HEADERS);
      Domain targetDomain =
          domainTest.createEntity(
              domainTest.createRequest(getEntityName(test) + "_target"), ADMIN_AUTH_HEADERS);

      // Create data product in source domain
      DataProduct dataProduct =
          createEntity(
              createRequest(getEntityName(test))
                  .withDomains(List.of(sourceDomain.getFullyQualifiedName())),
              ADMIN_AUTH_HEADERS);

      // Create tables and assign them to source domain
      TableResourceTest tableTest = new TableResourceTest();
      Table table1 =
          tableTest.createEntity(
              tableTest
                  .createRequest(getEntityName(test) + "_table1")
                  .withDomains(List.of(sourceDomain.getFullyQualifiedName())),
              ADMIN_AUTH_HEADERS);
      Table table2 =
          tableTest.createEntity(
              tableTest
                  .createRequest(getEntityName(test) + "_table2")
                  .withDomains(List.of(sourceDomain.getFullyQualifiedName())),
              ADMIN_AUTH_HEADERS);

      // Add tables to data product as assets
      BulkAssets bulkAssets =
          new BulkAssets()
              .withAssets(List.of(table1.getEntityReference(), table2.getEntityReference()));
      bulkAddAssets(dataProduct.getFullyQualifiedName(), bulkAssets);

      // Verify assets were added
      ResultList<EntityReference> assets =
          getAssets(dataProduct.getId(), 10, 0, ADMIN_AUTH_HEADERS);
      assertEquals(2, assets.getPaging().getTotal());

      // Verify tables are in source domain
      Table table1Before = tableTest.getEntity(table1.getId(), "domains", ADMIN_AUTH_HEADERS);
      assertEquals(1, table1Before.getDomains().size());
      assertEquals(sourceDomain.getId(), table1Before.getDomains().get(0).getId());

      Table table2Before = tableTest.getEntity(table2.getId(), "domains", ADMIN_AUTH_HEADERS);
      assertEquals(1, table2Before.getDomains().size());
      assertEquals(sourceDomain.getId(), table2Before.getDomains().get(0).getId());

      // CRITICAL: Change data product domain to target domain using PATCH
      String json = JsonUtils.pojoToJson(dataProduct);
      dataProduct.setDomains(List.of(targetDomain.getEntityReference()));
      ChangeDescription change = getChangeDescription(dataProduct, MINOR_UPDATE);
      fieldAdded(change, "domains", List.of(targetDomain.getEntityReference()));
      fieldDeleted(change, "domains", List.of(sourceDomain.getEntityReference()));
      dataProduct =
          patchEntityAndCheck(dataProduct, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

      // Verify data product is now in target domain
      assertEquals(1, dataProduct.getDomains().size());
      assertEquals(targetDomain.getId(), dataProduct.getDomains().get(0).getId());

      // CRITICAL ASSERTION: Verify tables were migrated to target domain
      Table table1After = tableTest.getEntity(table1.getId(), "domains", ADMIN_AUTH_HEADERS);
      assertEquals(
          1,
          table1After.getDomains().size(),
          "Table1 should have exactly 1 domain after migration");
      assertEquals(
          targetDomain.getId(),
          table1After.getDomains().get(0).getId(),
          "Table1 should be in target domain after migration");

      Table table2After = tableTest.getEntity(table2.getId(), "domains", ADMIN_AUTH_HEADERS);
      assertEquals(
          1,
          table2After.getDomains().size(),
          "Table2 should have exactly 1 domain after migration");
      assertEquals(
          targetDomain.getId(),
          table2After.getDomains().get(0).getId(),
          "Table2 should be in target domain after migration");

      // Verify assets are still in the data product
      assets = getAssets(dataProduct.getId(), 10, 0, ADMIN_AUTH_HEADERS);
      assertEquals(2, assets.getPaging().getTotal(), "Assets should still be in data product");

    } finally {
      EntityResourceTest.toggleRule(domainValidationRule, true);
    }
  }

  @Test
  void testDataProductDomainMigrationWithInputOutputPorts(TestInfo test) throws IOException {
    // Test that input/output ports are also migrated when domain changes

    String domainValidationRule = "Data Product Domain Validation";
    EntityResourceTest.toggleRule(domainValidationRule, false);

    try {
      // Create two domains
      DomainResourceTest domainTest = new DomainResourceTest();
      Domain sourceDomain =
          domainTest.createEntity(
              domainTest.createRequest(getEntityName(test) + "_source_port"), ADMIN_AUTH_HEADERS);
      Domain targetDomain =
          domainTest.createEntity(
              domainTest.createRequest(getEntityName(test) + "_target_port"), ADMIN_AUTH_HEADERS);

      // Create tables for ports and assign them to source domain
      TableResourceTest tableTest = new TableResourceTest();
      Table inputPort =
          tableTest.createEntity(
              tableTest
                  .createRequest(getEntityName(test) + "_input")
                  .withDomains(List.of(sourceDomain.getFullyQualifiedName())),
              ADMIN_AUTH_HEADERS);
      Table outputPort =
          tableTest.createEntity(
              tableTest
                  .createRequest(getEntityName(test) + "_output")
                  .withDomains(List.of(sourceDomain.getFullyQualifiedName())),
              ADMIN_AUTH_HEADERS);

      // Create data product
      DataProduct dataProduct =
          createEntity(
              createRequest(getEntityName(test))
                  .withDomains(List.of(sourceDomain.getFullyQualifiedName())),
              ADMIN_AUTH_HEADERS);

      // Add ports using bulk API
      DataProductRepository repository =
          (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);
      repository.bulkAddInputPorts(
          dataProduct.getFullyQualifiedName(),
          new BulkAssets().withAssets(List.of(inputPort.getEntityReference())));
      repository.bulkAddOutputPorts(
          dataProduct.getFullyQualifiedName(),
          new BulkAssets().withAssets(List.of(outputPort.getEntityReference())));

      // Verify ports are in source domain
      Table inputBefore = tableTest.getEntity(inputPort.getId(), "domains", ADMIN_AUTH_HEADERS);
      assertEquals(sourceDomain.getId(), inputBefore.getDomains().get(0).getId());
      Table outputBefore = tableTest.getEntity(outputPort.getId(), "domains", ADMIN_AUTH_HEADERS);
      assertEquals(sourceDomain.getId(), outputBefore.getDomains().get(0).getId());

      // Change data product domain to target domain
      String json = JsonUtils.pojoToJson(dataProduct);
      dataProduct.setDomains(List.of(targetDomain.getEntityReference()));
      ChangeDescription change = getChangeDescription(dataProduct, MINOR_UPDATE);
      fieldAdded(change, "domains", List.of(targetDomain.getEntityReference()));
      fieldDeleted(change, "domains", List.of(sourceDomain.getEntityReference()));
      dataProduct =
          patchEntityAndCheck(dataProduct, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

      // Verify ports were migrated to target domain
      Table inputAfter = tableTest.getEntity(inputPort.getId(), "domains", ADMIN_AUTH_HEADERS);
      assertEquals(
          targetDomain.getId(),
          inputAfter.getDomains().get(0).getId(),
          "Input port should be in target domain after migration");

      Table outputAfter = tableTest.getEntity(outputPort.getId(), "domains", ADMIN_AUTH_HEADERS);
      assertEquals(
          targetDomain.getId(),
          outputAfter.getDomains().get(0).getId(),
          "Output port should be in target domain after migration");

      // Verify ports are still associated with data product using paginated API (returns full
      // entities)
      ResultList<Map<String, Object>> inputPorts = getInputPorts(dataProduct.getId(), 10, 0);
      assertEquals(1, inputPorts.getData().size());
      assertEquals(inputPort.getId(), getEntityId(inputPorts.getData().get(0)));
      ResultList<Map<String, Object>> outputPorts = getOutputPorts(dataProduct.getId(), 10, 0);
      assertEquals(1, outputPorts.getData().size());
      assertEquals(outputPort.getId(), getEntityId(outputPorts.getData().get(0)));

    } finally {
      EntityResourceTest.toggleRule(domainValidationRule, true);
    }
  }
}
