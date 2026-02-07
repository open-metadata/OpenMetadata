package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.bootstrap.SharedEntities.*;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.util.EntityRulesUtil;
import org.openmetadata.it.util.EntityValidation;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.domains.DataProductPortsView;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for DataProduct entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds data product-specific tests for
 * assets, experts, and domain relationships.
 *
 * <p>Migrated from: org.openmetadata.service.resources.domains.DataProductResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class DataProductResourceIT extends BaseEntityIT<DataProduct, CreateDataProduct> {

  // DataProduct is itself a data product, so this field doesn't apply to it
  // DataProduct API doesn't expose include parameter for soft delete operations
  {
    supportsDataProducts = false;
    supportsPatchDomains = true; // Domain change is now supported with asset migration
    supportsSoftDelete = false;
    supportsListHistoryByTimestamp = true;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateDataProduct createMinimalRequest(TestNamespace ns) {
    Domain domain = getOrCreateDomain(ns);

    return new CreateDataProduct()
        .withName(ns.prefix("dataproduct"))
        .withDescription("Test data product created by integration test")
        .withDomains(List.of(domain.getFullyQualifiedName()));
  }

  @Override
  protected CreateDataProduct createRequest(String name, TestNamespace ns) {
    Domain domain = getOrCreateDomain(ns);

    return new CreateDataProduct()
        .withName(name)
        .withDescription("Test data product")
        .withDomains(List.of(domain.getFullyQualifiedName()));
  }

  private Domain getOrCreateDomain(TestNamespace ns) {
    String domainName = ns.prefix("domain");
    try {
      return SdkClients.adminClient().domains().getByName(domainName);
    } catch (Exception e) {
      CreateDomain createDomain =
          new CreateDomain()
              .withName(domainName)
              .withDescription("Test domain for data products")
              .withDomainType(DomainType.AGGREGATE);
      return SdkClients.adminClient().domains().create(createDomain);
    }
  }

  @Override
  protected DataProduct createEntity(CreateDataProduct createRequest) {
    return SdkClients.adminClient().dataProducts().create(createRequest);
  }

  @Override
  protected DataProduct getEntity(String id) {
    return SdkClients.adminClient().dataProducts().get(id);
  }

  @Override
  protected DataProduct getEntityByName(String fqn) {
    return SdkClients.adminClient().dataProducts().getByName(fqn);
  }

  @Override
  protected DataProduct patchEntity(String id, DataProduct entity) {
    return SdkClients.adminClient().dataProducts().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().dataProducts().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().dataProducts().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().dataProducts().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "dataProduct";
  }

  @Override
  protected void validateCreatedEntity(DataProduct entity, CreateDataProduct createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getDomains(), "DataProduct must have a domain");
    assertFalse(entity.getDomains().isEmpty(), "DataProduct must have at least one domain");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain data product name");
  }

  @Override
  protected ListResponse<DataProduct> listEntities(ListParams params) {
    return SdkClients.adminClient().dataProducts().list(params);
  }

  @Override
  protected DataProduct getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().dataProducts().get(id, fields);
  }

  @Override
  protected DataProduct getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().dataProducts().getByName(fqn, fields);
  }

  @Override
  protected DataProduct getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient()
        .dataProducts()
        .get(id, "domains,owners,experts,assets,tags,followers", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().dataProducts().getVersionList(id);
  }

  @Override
  protected DataProduct getVersion(UUID id, Double version) {
    return SdkClients.adminClient().dataProducts().getVersion(id.toString(), version);
  }

  // ===================================================================
  // DATA PRODUCT-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_dataProductWithStyle_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct request =
        new CreateDataProduct()
            .withName(ns.prefix("dp_style"))
            .withDescription("Data product with style")
            .withDomains(List.of(domain.getFullyQualifiedName()))
            .withStyle(new Style().withColor("#40E0D0").withIconURL("https://icon.example.com"));

    DataProduct dataProduct = createEntity(request);
    assertNotNull(dataProduct);
    assertNotNull(dataProduct.getStyle());
    assertEquals("#40E0D0", dataProduct.getStyle().getColor());
  }

  @Test
  void put_dataProductDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct request =
        new CreateDataProduct()
            .withName(ns.prefix("dp_update_desc"))
            .withDescription("Initial description")
            .withDomains(List.of(domain.getFullyQualifiedName()));

    DataProduct dataProduct = createEntity(request);
    assertEquals("Initial description", dataProduct.getDescription());

    // Update description
    dataProduct.setDescription("Updated description");
    DataProduct updated = patchEntity(dataProduct.getId().toString(), dataProduct);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_dataProductNameUniquenessWithinDomain(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain = getOrCreateDomain(ns);

    // Create first data product
    String dpName = ns.prefix("unique_dp");
    CreateDataProduct request1 =
        new CreateDataProduct()
            .withName(dpName)
            .withDescription("First data product")
            .withDomains(List.of(domain.getFullyQualifiedName()));

    DataProduct dp1 = createEntity(request1);
    assertNotNull(dp1);

    // Attempt to create duplicate within same domain
    CreateDataProduct request2 =
        new CreateDataProduct()
            .withName(dpName)
            .withDescription("Duplicate data product")
            .withDomains(List.of(domain.getFullyQualifiedName()));

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate data product in same domain should fail");
  }

  @Test
  @org.junit.jupiter.api.Disabled(
      "Requires modifying system settings - EntityRulesUtil.toggleRule not working via API")
  void testDataProductAssets(TestNamespace ns) throws Exception {
    String domainValidationRule = "Data Product Domain Validation";
    EntityRulesUtil.toggleRule(SdkClients.adminClient(), domainValidationRule, false);

    try {
      Domain domain = getOrCreateDomain(ns);
      CreateDataProduct create =
          new CreateDataProduct()
              .withName(ns.prefix("dp_assets"))
              .withDescription("Data product for assets test")
              .withDomains(List.of(domain.getFullyQualifiedName()));
      DataProduct product = createEntity(create);

      Table table1 = createTestTable(ns, "table1", domain);

      BulkAssets addTable1 = new BulkAssets().withAssets(List.of(table1.getEntityReference()));
      bulkAddAssets(product.getFullyQualifiedName(), addTable1);

      table1 = SdkClients.adminClient().tables().get(table1.getId().toString(), "dataProducts");
      assertNotNull(table1.getDataProducts());
      assertTrue(
          table1.getDataProducts().stream().anyMatch(dp -> dp.getId().equals(product.getId())));

      BulkAssets removeTable1 = new BulkAssets().withAssets(List.of(table1.getEntityReference()));
      bulkRemoveAssets(product.getFullyQualifiedName(), removeTable1);

      table1 = SdkClients.adminClient().tables().get(table1.getId().toString(), "dataProducts");
      assertTrue(
          table1.getDataProducts() == null
              || table1.getDataProducts().stream()
                  .noneMatch(dp -> dp.getId().equals(product.getId())));
    } finally {
      EntityRulesUtil.toggleRule(SdkClients.adminClient(), domainValidationRule, true);
    }
  }

  @Test
  void testDataProductExperts(TestNamespace ns) throws Exception {
    SharedEntities shared = SharedEntities.get();
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_experts"))
            .withDescription("Data product for experts test")
            .withDomains(List.of(domain.getFullyQualifiedName()))
            .withExperts(List.of(shared.USER1.getFullyQualifiedName()));
    DataProduct product = createEntity(create);

    EntityValidation.assertEntityReferences(List.of(shared.USER1_REF), product.getExperts());

    create.withExperts(
        List.of(shared.USER1.getFullyQualifiedName(), shared.USER2.getFullyQualifiedName()));
    DataProduct updated = SdkClients.adminClient().dataProducts().upsert(create);

    EntityValidation.assertEntityReferences(
        List.of(shared.USER1_REF, shared.USER2_REF), updated.getExperts());

    create.withExperts(List.of(shared.USER1.getFullyQualifiedName()));
    updated = SdkClients.adminClient().dataProducts().upsert(create);

    EntityValidation.assertEntityReferences(List.of(shared.USER1_REF), updated.getExperts());
  }

  @Test
  void test_listWithDomainFilter(TestNamespace ns) throws Exception {
    Domain domain1 = createTestDomain(ns, "domain1");
    Domain domain2 = createTestDomain(ns, "domain2");

    DataProduct p1 =
        createEntity(
            new CreateDataProduct()
                .withName(ns.prefix("dp1"))
                .withDescription("Product 1")
                .withDomains(List.of(domain1.getFullyQualifiedName())));

    DataProduct p2 =
        createEntity(
            new CreateDataProduct()
                .withName(ns.prefix("dp2"))
                .withDescription("Product 2")
                .withDomains(List.of(domain1.getFullyQualifiedName())));

    DataProduct p3 =
        createEntity(
            new CreateDataProduct()
                .withName(ns.prefix("dp3"))
                .withDescription("Product 3")
                .withDomains(List.of(domain2.getFullyQualifiedName())));

    DataProduct p4 =
        createEntity(
            new CreateDataProduct()
                .withName(ns.prefix("dp4"))
                .withDescription("Product 4")
                .withDomains(List.of(domain2.getFullyQualifiedName())));

    String nsPrefix = ns.prefix("");
    ListParams params = new ListParams().withDomain(domain1.getFullyQualifiedName()).withLimit(100);
    ListResponse<DataProduct> list = SdkClients.adminClient().dataProducts().list(params);
    List<DataProduct> filtered =
        list.getData().stream()
            .filter(dp -> dp.getName().contains(nsPrefix))
            .collect(java.util.stream.Collectors.toList());
    // Verify our specific products are in the list (may have more from parallel tests)
    assertTrue(
        filtered.size() >= 2, "Should find at least 2 data products in domain1 from this test");
    assertTrue(filtered.stream().anyMatch(s -> s.getName().equals(p1.getName())));
    assertTrue(filtered.stream().anyMatch(s -> s.getName().equals(p2.getName())));

    params = new ListParams().withDomain(domain2.getFullyQualifiedName()).withLimit(100);
    list = SdkClients.adminClient().dataProducts().list(params);
    filtered =
        list.getData().stream()
            .filter(dp -> dp.getName().contains(nsPrefix))
            .collect(java.util.stream.Collectors.toList());
    // Verify our specific products are in the list (may have more from parallel tests)
    assertTrue(
        filtered.size() >= 2, "Should find at least 2 data products in domain2 from this test");
    assertTrue(filtered.stream().anyMatch(s -> s.getName().equals(p3.getName())));
    assertTrue(filtered.stream().anyMatch(s -> s.getName().equals(p4.getName())));
  }

  @Test
  void test_inheritOwnerExpertsFromDomain(TestNamespace ns) throws Exception {
    SharedEntities shared = SharedEntities.get();

    CreateDomain parentDomainReq =
        new CreateDomain()
            .withName(ns.prefix("parent_domain"))
            .withDescription("Parent domain")
            .withDomainType(DomainType.AGGREGATE)
            .withOwners(List.of(shared.USER1_REF))
            .withExperts(List.of(shared.USER2.getFullyQualifiedName()));
    Domain parentDomain = SdkClients.adminClient().domains().create(parentDomainReq);
    parentDomain = SdkClients.adminClient().domains().get(parentDomain.getId().toString(), "*");

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_inherit"))
            .withDescription("Data product with inherited owners/experts")
            .withDomains(List.of(parentDomain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);
    dataProduct =
        SdkClients.adminClient()
            .dataProducts()
            .get(dataProduct.getId().toString(), "owners,experts");

    EntityValidation.assertEntityReferences(parentDomain.getOwners(), dataProduct.getOwners());
    EntityValidation.assertEntityReferences(parentDomain.getExperts(), dataProduct.getExperts());

    CreateDomain subDomainReq =
        new CreateDomain()
            .withName(ns.prefix("sub_domain"))
            .withDescription("Sub domain")
            .withDomainType(DomainType.AGGREGATE)
            .withParent(parentDomain.getFullyQualifiedName());
    Domain subDomain = SdkClients.adminClient().domains().create(subDomainReq);
    subDomain = SdkClients.adminClient().domains().get(subDomain.getId().toString(), "*");

    CreateDataProduct subDomainDataProductCreate =
        new CreateDataProduct()
            .withName(ns.prefix("dp_inherit_sub"))
            .withDescription("Data product in subdomain")
            .withDomains(List.of(subDomain.getFullyQualifiedName()));
    DataProduct subDomainDataProduct = createEntity(subDomainDataProductCreate);
    subDomainDataProduct =
        SdkClients.adminClient()
            .dataProducts()
            .get(subDomainDataProduct.getId().toString(), "owners,experts");

    EntityValidation.assertEntityReferences(
        parentDomain.getOwners(), subDomainDataProduct.getOwners());
    EntityValidation.assertEntityReferences(
        parentDomain.getExperts(), subDomainDataProduct.getExperts());
  }

  @Test
  @org.junit.jupiter.api.Disabled(
      "Requires modifying system settings - EntityRulesUtil.toggleRule not working via API")
  void testBulkAddAssets_DataProductDomainValidation(TestNamespace ns) throws Exception {
    Domain dataDomain = createTestDomain(ns, "data_domain");
    Domain engineeringDomain = createTestDomain(ns, "engineering_domain");

    CreateDataProduct createDataProduct =
        new CreateDataProduct()
            .withName(ns.prefix("dp_validation"))
            .withDescription("Data product for domain validation")
            .withDomains(List.of(dataDomain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(createDataProduct);

    Table matchingTable = createTestTable(ns, "matching_table", dataDomain);
    Table nonMatchingTable = createTestTable(ns, "non_matching_table", engineeringDomain);

    BulkAssets matchingAssetsRequest =
        new BulkAssets().withAssets(List.of(matchingTable.getEntityReference()));
    BulkOperationResult successResult =
        bulkAddAssetsWithResult(dataProduct.getName(), matchingAssetsRequest);

    assertEquals(ApiStatus.SUCCESS, successResult.getStatus());
    assertEquals(1, successResult.getNumberOfRowsProcessed());
    assertEquals(1, successResult.getNumberOfRowsPassed());
    assertEquals(0, successResult.getNumberOfRowsFailed());

    BulkAssets nonMatchingAssetsRequest =
        new BulkAssets().withAssets(List.of(nonMatchingTable.getEntityReference()));
    InvalidRequestException failException =
        assertThrows(
            InvalidRequestException.class,
            () -> bulkAddAssetsWithResult(dataProduct.getName(), nonMatchingAssetsRequest));
    BulkOperationResult failResult =
        JsonUtils.readValue(failException.getResponseBody(), BulkOperationResult.class);

    assertEquals(ApiStatus.FAILURE, failResult.getStatus());
    assertEquals(1, failResult.getNumberOfRowsProcessed());
    assertEquals(0, failResult.getNumberOfRowsPassed());
    assertEquals(1, failResult.getNumberOfRowsFailed());
    assertEquals(1, failResult.getFailedRequest().size());
    assertTrue(failResult.getFailedRequest().get(0).getMessage().contains("Cannot assign asset"));

    bulkRemoveAssets(dataProduct.getFullyQualifiedName(), matchingAssetsRequest);

    BulkAssets mixedAssetsRequest =
        new BulkAssets()
            .withAssets(
                List.of(matchingTable.getEntityReference(), nonMatchingTable.getEntityReference()));
    BulkOperationResult mixedResult =
        bulkAddAssetsWithResult(dataProduct.getName(), mixedAssetsRequest);

    assertEquals(ApiStatus.PARTIAL_SUCCESS, mixedResult.getStatus());
    assertEquals(2, mixedResult.getNumberOfRowsProcessed());
    assertEquals(1, mixedResult.getNumberOfRowsPassed());
    assertEquals(1, mixedResult.getNumberOfRowsFailed());

    String originalRuleName = "Data Product Domain Validation";
    EntityRulesUtil.toggleRule(SdkClients.adminClient(), originalRuleName, false);

    try {
      BulkOperationResult disabledRuleResult =
          bulkAddAssetsWithResult(dataProduct.getName(), nonMatchingAssetsRequest);
      assertEquals(ApiStatus.SUCCESS, disabledRuleResult.getStatus());
      assertEquals(1, disabledRuleResult.getNumberOfRowsProcessed());
      assertEquals(1, disabledRuleResult.getNumberOfRowsPassed());
    } finally {
      EntityRulesUtil.toggleRule(SdkClients.adminClient(), originalRuleName, true);
    }

    BulkAssets removeAllRequest =
        new BulkAssets()
            .withAssets(
                List.of(matchingTable.getEntityReference(), nonMatchingTable.getEntityReference()));
    BulkOperationResult removeResult =
        bulkRemoveAssetsWithResult(dataProduct.getName(), removeAllRequest);

    assertEquals(ApiStatus.SUCCESS, removeResult.getStatus());
    assertEquals(2, removeResult.getNumberOfRowsProcessed());
    assertEquals(2, removeResult.getNumberOfRowsPassed());
  }

  @Test
  void test_entityStatusUpdateAndPatch(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);
    CreateDataProduct createDataProduct =
        new CreateDataProduct()
            .withName(ns.prefix("dp_status"))
            .withDescription("Data product for status test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(createDataProduct);

    assertEquals(EntityStatus.UNPROCESSED, dataProduct.getEntityStatus());

    dataProduct.setEntityStatus(EntityStatus.IN_REVIEW);
    DataProduct updatedDataProduct =
        SdkClients.adminClient().dataProducts().update(dataProduct.getId().toString(), dataProduct);

    assertEquals(EntityStatus.IN_REVIEW, updatedDataProduct.getEntityStatus());

    DataProduct retrievedDataProduct =
        SdkClients.adminClient().dataProducts().get(updatedDataProduct.getId().toString());
    assertEquals(EntityStatus.IN_REVIEW, retrievedDataProduct.getEntityStatus());
  }

  @Test
  @org.junit.jupiter.api.Disabled(
      "Requires modifying system settings - EntityRulesUtil.toggleRule not working via API")
  void test_getDataProductAssetsAPI(TestNamespace ns) throws Exception {
    String domainValidationRule = "Data Product Domain Validation";
    EntityRulesUtil.toggleRule(SdkClients.adminClient(), domainValidationRule, false);

    try {
      Domain domain = getOrCreateDomain(ns);
      CreateDataProduct create =
          new CreateDataProduct()
              .withName(ns.prefix("dp_assets_api"))
              .withDescription("Data product for assets API test")
              .withDomains(List.of(domain.getFullyQualifiedName()));
      DataProduct dataProduct = createEntity(create);

      Table table1 = createTestTable(ns, "assets_table1", domain);
      Table table2 = createTestTable(ns, "assets_table2", domain);
      Table table3 = createTestTable(ns, "assets_table3", domain);

      BulkAssets bulkAssets =
          new BulkAssets()
              .withAssets(List.of(table1.getEntityReference(), table2.getEntityReference()));
      bulkAddAssets(dataProduct.getFullyQualifiedName(), bulkAssets);

      ResultList<EntityReference> assets = getAssets(dataProduct.getId(), 10, 0);
      assertEquals(2, assets.getPaging().getTotal());
      assertEquals(2, assets.getData().size());
      assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table1.getId())));
      assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table2.getId())));

      ResultList<EntityReference> assetsByName =
          getAssetsByName(dataProduct.getFullyQualifiedName(), 10, 0);
      assertEquals(2, assetsByName.getPaging().getTotal());
      assertEquals(2, assetsByName.getData().size());

      ResultList<EntityReference> page1 = getAssets(dataProduct.getId(), 1, 0);
      assertEquals(2, page1.getPaging().getTotal());
      assertEquals(1, page1.getData().size());

      ResultList<EntityReference> page2 = getAssets(dataProduct.getId(), 1, 1);
      assertEquals(2, page2.getPaging().getTotal());
      assertEquals(1, page2.getData().size());
      assertNotEquals(page1.getData().get(0).getId(), page2.getData().get(0).getId());

      BulkAssets addTable3 = new BulkAssets().withAssets(List.of(table3.getEntityReference()));
      bulkAddAssets(dataProduct.getFullyQualifiedName(), addTable3);

      ResultList<EntityReference> allAssets = getAssets(dataProduct.getId(), 100, 0);
      assertEquals(3, allAssets.getPaging().getTotal());
      assertEquals(3, allAssets.getData().size());

      BulkAssets removeTable1 = new BulkAssets().withAssets(List.of(table1.getEntityReference()));
      bulkRemoveAssets(dataProduct.getFullyQualifiedName(), removeTable1);

      assets = getAssets(dataProduct.getId(), 100, 0);
      assertEquals(2, assets.getPaging().getTotal());
      assertEquals(2, assets.getData().size());
      assertTrue(assets.getData().stream().noneMatch(a -> a.getId().equals(table1.getId())));
      assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table2.getId())));
      assertTrue(assets.getData().stream().anyMatch(a -> a.getId().equals(table3.getId())));

      page1 = getAssets(dataProduct.getId(), 1, 0);
      assertEquals(2, page1.getPaging().getTotal());
      assertEquals(1, page1.getData().size());

      page2 = getAssets(dataProduct.getId(), 1, 1);
      assertEquals(2, page2.getPaging().getTotal());
      assertEquals(1, page2.getData().size());
      assertNotEquals(page1.getData().get(0).getId(), page2.getData().get(0).getId());

      BulkAssets removeRemaining =
          new BulkAssets()
              .withAssets(List.of(table2.getEntityReference(), table3.getEntityReference()));
      bulkRemoveAssets(dataProduct.getFullyQualifiedName(), removeRemaining);

      assets = getAssets(dataProduct.getId(), 100, 0);
      assertEquals(0, assets.getPaging().getTotal());
      assertEquals(0, assets.getData().size());
    } finally {
      EntityRulesUtil.toggleRule(SdkClients.adminClient(), domainValidationRule, true);
    }
  }

  @Test
  @org.junit.jupiter.api.Disabled(
      "Requires modifying system settings - EntityRulesUtil.toggleRule not working via API")
  void test_getAllDataProductsWithAssetsCount(TestNamespace ns) throws Exception {
    String domainValidationRule = "Data Product Domain Validation";
    EntityRulesUtil.toggleRule(SdkClients.adminClient(), domainValidationRule, false);

    try {
      Domain domain = createTestDomain(ns, "count_domain");

      DataProduct dataProduct1 =
          createEntity(
              new CreateDataProduct()
                  .withName(ns.prefix("dp_count1"))
                  .withDescription("Product 1 for count")
                  .withDomains(List.of(domain.getFullyQualifiedName())));
      DataProduct dataProduct2 =
          createEntity(
              new CreateDataProduct()
                  .withName(ns.prefix("dp_count2"))
                  .withDescription("Product 2 for count")
                  .withDomains(List.of(domain.getFullyQualifiedName())));

      Table table1 = createTestTable(ns, "count_table1", domain);
      Table table2 = createTestTable(ns, "count_table2", domain);
      Table table3 = createTestTable(ns, "count_table3", domain);

      bulkAddAssets(
          dataProduct1.getFullyQualifiedName(),
          new BulkAssets()
              .withAssets(List.of(table1.getEntityReference(), table2.getEntityReference())));
      bulkAddAssets(
          dataProduct2.getFullyQualifiedName(),
          new BulkAssets().withAssets(List.of(table3.getEntityReference())));

      Map<String, Integer> assetsCount = getAllDataProductsWithAssetsCount();

      assertNotNull(assetsCount);
      assertTrue(assetsCount.containsKey(dataProduct1.getFullyQualifiedName()));
      assertTrue(assetsCount.containsKey(dataProduct2.getFullyQualifiedName()));
      assertEquals(2, assetsCount.get(dataProduct1.getFullyQualifiedName()));
      assertEquals(1, assetsCount.get(dataProduct2.getFullyQualifiedName()));
    } finally {
      EntityRulesUtil.toggleRule(SdkClients.adminClient(), domainValidationRule, true);
    }
  }

  private Domain createTestDomain(TestNamespace ns, String suffix) {
    CreateDomain createDomain =
        new CreateDomain()
            .withName(ns.prefix(suffix))
            .withDescription("Test domain " + suffix)
            .withDomainType(DomainType.AGGREGATE);
    return SdkClients.adminClient().domains().create(createDomain);
  }

  private Table createTestTable(TestNamespace ns, String suffix, Domain domain) {
    DatabaseService service = getOrCreateDatabaseService(ns);
    org.openmetadata.schema.entity.data.Database database =
        getOrCreateDatabase(ns, service.getFullyQualifiedName());
    org.openmetadata.schema.entity.data.DatabaseSchema schema =
        getOrCreateDatabaseSchema(ns, database.getFullyQualifiedName());

    CreateTable createTable =
        new CreateTable()
            .withName(ns.prefix(suffix))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDomains(List.of(domain.getFullyQualifiedName()));
    return SdkClients.adminClient().tables().create(createTable);
  }

  private Dashboard createTestDashboard(TestNamespace ns, String suffix, Domain domain) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard createDashboard =
        new CreateDashboard()
            .withName(ns.prefix(suffix))
            .withService(service.getFullyQualifiedName())
            .withDomains(List.of(domain.getFullyQualifiedName()));
    return SdkClients.adminClient().dashboards().create(createDashboard);
  }

  private Topic createTestTopic(TestNamespace ns, String suffix, Domain domain) {
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic createTopic =
        new CreateTopic()
            .withName(ns.prefix(suffix))
            .withService(service.getFullyQualifiedName())
            .withPartitions(1)
            .withDomains(List.of(domain.getFullyQualifiedName()));
    return SdkClients.adminClient().topics().create(createTopic);
  }

  private org.openmetadata.schema.entity.data.DatabaseSchema getOrCreateDatabaseSchema(
      TestNamespace ns, String databaseFqn) {
    String schemaName = ns.prefix("schema");
    try {
      return SdkClients.adminClient().databaseSchemas().getByName(databaseFqn + "." + schemaName);
    } catch (Exception e) {
      org.openmetadata.schema.api.data.CreateDatabaseSchema create =
          new org.openmetadata.schema.api.data.CreateDatabaseSchema()
              .withName(schemaName)
              .withDatabase(databaseFqn);
      return SdkClients.adminClient().databaseSchemas().create(create);
    }
  }

  private DatabaseService getOrCreateDatabaseService(TestNamespace ns) {
    String serviceName = ns.prefix("service");
    try {
      return SdkClients.adminClient().databaseServices().getByName(serviceName);
    } catch (Exception e) {
      MysqlConnection connection =
          new MysqlConnection()
              .withHostPort("localhost:3306")
              .withUsername("test")
              .withAuthType(new basicAuth().withPassword("test"));

      CreateDatabaseService create =
          new CreateDatabaseService()
              .withName(serviceName)
              .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
              .withConnection(
                  new org.openmetadata.schema.api.services.DatabaseConnection()
                      .withConfig(connection));
      return SdkClients.adminClient().databaseServices().create(create);
    }
  }

  private org.openmetadata.schema.entity.data.Database getOrCreateDatabase(
      TestNamespace ns, String serviceFqn) {
    String dbName = ns.prefix("database");
    try {
      return SdkClients.adminClient().databases().getByName(serviceFqn + "." + dbName);
    } catch (Exception e) {
      org.openmetadata.schema.api.data.CreateDatabase create =
          new org.openmetadata.schema.api.data.CreateDatabase()
              .withName(dbName)
              .withService(serviceFqn);
      return SdkClients.adminClient().databases().create(create);
    }
  }

  private void bulkAddAssets(String dataProductName, BulkAssets request) throws Exception {
    String path = "/v1/dataProducts/" + dataProductName + "/assets/add";
    SdkClients.adminClient().getHttpClient().execute(HttpMethod.PUT, path, request, Void.class);
  }

  private void bulkRemoveAssets(String dataProductName, BulkAssets request) throws Exception {
    String path = "/v1/dataProducts/" + dataProductName + "/assets/remove";
    SdkClients.adminClient().getHttpClient().execute(HttpMethod.PUT, path, request, Void.class);
  }

  private BulkOperationResult bulkAddAssetsWithResult(String dataProductName, BulkAssets request)
      throws Exception {
    String path = "/v1/dataProducts/" + dataProductName + "/assets/add";
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PUT, path, request, BulkOperationResult.class);
  }

  private BulkOperationResult bulkRemoveAssetsWithResult(String dataProductName, BulkAssets request)
      throws Exception {
    String path = "/v1/dataProducts/" + dataProductName + "/assets/remove";
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PUT, path, request, BulkOperationResult.class);
  }

  private ResultList<EntityReference> getAssets(UUID id, int limit, int offset) throws Exception {
    String path = "/v1/dataProducts/" + id + "/assets?limit=" + limit + "&offset=" + offset;
    String responseJson =
        SdkClients.adminClient().getHttpClient().executeForString(HttpMethod.GET, path, null, null);
    return JsonUtils.readValue(responseJson, new TypeReference<ResultList<EntityReference>>() {});
  }

  private ResultList<EntityReference> getAssetsByName(String name, int limit, int offset)
      throws Exception {
    String path = "/v1/dataProducts/name/" + name + "/assets?limit=" + limit + "&offset=" + offset;
    String responseJson =
        SdkClients.adminClient().getHttpClient().executeForString(HttpMethod.GET, path, null, null);
    return JsonUtils.readValue(responseJson, new TypeReference<ResultList<EntityReference>>() {});
  }

  private Map<String, Integer> getAllDataProductsWithAssetsCount() throws Exception {
    String path = "/v1/dataProducts/assets/counts";
    String responseJson =
        SdkClients.adminClient().getHttpClient().executeForString(HttpMethod.GET, path, null, null);
    return JsonUtils.readValue(responseJson, new TypeReference<Map<String, Integer>>() {});
  }

  private List<EntityReference> getEntityReferencesFromSearchIndex(
      UUID entityId, String indexName, String fieldName) throws Exception {
    String query = "id:" + entityId.toString();
    String searchResponse =
        SdkClients.adminClient().search().query(query).index(indexName).execute();

    JsonNode root = JsonUtils.readTree(searchResponse);
    JsonNode fieldNode = root.path("hits").path("hits").path(0).path("_source").path(fieldName);

    if (fieldNode.isMissingNode() || !fieldNode.isArray()) {
      return null;
    }

    return JsonUtils.readObjects(fieldNode.toString(), EntityReference.class);
  }

  // ===================================================================
  // RENAME + CONSOLIDATION TESTS
  // Tests that verify assets are preserved when:
  // 1. DataProduct is renamed
  // 2. Another field is updated within the same session (triggering consolidation)
  // ===================================================================

  @Test
  void test_renameDataProduct(TestNamespace ns) {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_rename"))
            .withDescription("Data product for rename test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    String oldName = dataProduct.getName();
    String oldFqn = dataProduct.getFullyQualifiedName();
    String newName = "renamed-" + oldName;

    dataProduct.setName(newName);
    DataProduct renamed = patchEntity(dataProduct.getId().toString(), dataProduct);

    assertEquals(newName, renamed.getName());
    assertNotEquals(oldFqn, renamed.getFullyQualifiedName());

    DataProduct fetched = getEntityByName(renamed.getFullyQualifiedName());
    assertEquals(newName, fetched.getName());
  }

  @Test
  void test_renameDataProductWithAssets(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);
    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_rename_assets"))
            .withDescription("Data product for rename with assets test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table = createTestTable(ns, "rename_table", domain);
    BulkAssets addTable = new BulkAssets().withAssets(List.of(table.getEntityReference()));
    bulkAddAssets(dataProduct.getFullyQualifiedName(), addTable);

    // Wait for asset to be added (may be async)
    UUID dataProductId = dataProduct.getId();
    Awaitility.await("Wait for asset to be added before rename")
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              ResultList<EntityReference> assets = getAssets(dataProductId, 10, 0);
              assertEquals(1, assets.getPaging().getTotal(), "Should have 1 asset before rename");
            });

    String oldName = dataProduct.getName();
    String newName = "renamed-" + oldName;

    dataProduct.setName(newName);
    DataProduct renamed = patchEntity(dataProduct.getId().toString(), dataProduct);
    assertEquals(newName, renamed.getName());

    // Wait for assets to be properly reflected after rename (may involve async processing)
    UUID renamedId = renamed.getId();
    UUID tableId = table.getId();
    Awaitility.await("Wait for asset to be present after rename")
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              ResultList<EntityReference> assets = getAssets(renamedId, 10, 0);
              assertEquals(
                  1, assets.getPaging().getTotal(), "Should still have 1 asset after rename");
              assertEquals(tableId, assets.getData().get(0).getId());
            });
  }

  /**
   * Test that reproduces the consolidation bug when:
   * 1. DataProduct is renamed
   * 2. Another field (description) is updated within the same session
   *
   * The consolidation logic would revert to the previous version which has the OLD name/FQN,
   * potentially causing asset relationships to be lost.
   *
   * Fix: Skip consolidation when name has changed.
   */
  @Test
  void test_renameAndUpdateDescriptionPreservesAssets(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);
    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_rename_consolidate"))
            .withDescription("Initial description")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table = createTestTable(ns, "consolidate_table", domain);
    BulkAssets addTable = new BulkAssets().withAssets(List.of(table.getEntityReference()));
    bulkAddAssets(dataProduct.getFullyQualifiedName(), addTable);

    // Wait for asset to be added (may be async)
    UUID dataProductId = dataProduct.getId();
    Awaitility.await("Wait for asset to be added before rename")
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              ResultList<EntityReference> assets = getAssets(dataProductId, 10, 0);
              assertEquals(1, assets.getPaging().getTotal(), "Should have 1 asset before rename");
            });

    String oldName = dataProduct.getName();
    String newName = "renamed-" + oldName;
    dataProduct.setName(newName);
    DataProduct renamed = patchEntity(dataProduct.getId().toString(), dataProduct);
    assertEquals(newName, renamed.getName());

    // Wait for assets to be properly reflected after rename
    UUID renamedId = renamed.getId();
    UUID tableId = table.getId();
    Awaitility.await("Wait for asset to be present after rename")
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              ResultList<EntityReference> assets = getAssets(renamedId, 10, 0);
              assertEquals(1, assets.getPaging().getTotal(), "Should have 1 asset after rename");
            });

    renamed.setDescription("Updated description after rename");
    DataProduct afterDescUpdate = patchEntity(renamed.getId().toString(), renamed);
    assertEquals("Updated description after rename", afterDescUpdate.getDescription());

    // Wait for assets after description update and consolidation
    UUID afterDescUpdateId = afterDescUpdate.getId();
    Awaitility.await("Wait for asset after consolidation")
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              ResultList<EntityReference> assets = getAssets(afterDescUpdateId, 10, 0);
              assertEquals(
                  1,
                  assets.getPaging().getTotal(),
                  "CRITICAL: Assets should still be present after rename + description update consolidation");
              assertEquals(
                  tableId,
                  assets.getData().get(0).getId(),
                  "Asset should be the same table after consolidation");
            });

    Table tableWithDataProducts =
        SdkClients.adminClient().tables().get(table.getId().toString(), "dataProducts");
    assertNotNull(tableWithDataProducts.getDataProducts());
    assertEquals(1, tableWithDataProducts.getDataProducts().size());
    assertEquals(
        afterDescUpdate.getFullyQualifiedName(),
        tableWithDataProducts.getDataProducts().get(0).getFullyQualifiedName(),
        "Table's dataProducts reference should have updated FQN after consolidation");
  }

  /**
   * Test multiple renames followed by updates within the same session.
   * This is a more complex scenario that tests the robustness of the consolidation fix.
   */
  @Test
  void test_multipleRenamesWithUpdatesPreservesAssets(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);
    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_multi_rename"))
            .withDescription("Initial description")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table = createTestTable(ns, "multi_rename_table", domain);
    BulkAssets addTable = new BulkAssets().withAssets(List.of(table.getEntityReference()));
    bulkAddAssets(dataProduct.getFullyQualifiedName(), addTable);

    // Wait for asset to be added (may be async)
    UUID dataProductId = dataProduct.getId();
    Awaitility.await("Wait for asset to be added")
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              ResultList<EntityReference> assets = getAssets(dataProductId, 10, 0);
              assertEquals(1, assets.getPaging().getTotal());
            });

    String[] names = {"renamed-first", "renamed-second", "renamed-third"};

    for (int i = 0; i < names.length; i++) {
      String newName = names[i] + "-" + UUID.randomUUID().toString().substring(0, 8);

      dataProduct.setName(newName);
      dataProduct = patchEntity(dataProduct.getId().toString(), dataProduct);
      assertEquals(newName, dataProduct.getName());

      ResultList<EntityReference> assets = getAssets(dataProduct.getId(), 10, 0);
      assertEquals(
          1,
          assets.getPaging().getTotal(),
          "Assets should be preserved immediately after rename " + (i + 1));

      dataProduct.setDescription("Description after rename " + (i + 1));
      dataProduct = patchEntity(dataProduct.getId().toString(), dataProduct);

      assets = getAssets(dataProduct.getId(), 10, 0);
      assertEquals(
          1,
          assets.getPaging().getTotal(),
          "Assets should be preserved after rename + update iteration " + (i + 1));
    }

    Table tableWithDataProducts =
        SdkClients.adminClient().tables().get(table.getId().toString(), "dataProducts");
    assertNotNull(tableWithDataProducts.getDataProducts());
    assertEquals(1, tableWithDataProducts.getDataProducts().size());
    assertEquals(
        dataProduct.getFullyQualifiedName(),
        tableWithDataProducts.getDataProducts().get(0).getFullyQualifiedName());
  }

  // ===================================================================
  // DOMAIN CHANGE TESTS
  // Tests that verify domain change works correctly including:
  // 1. Basic domain change (no assets)
  // 2. Domain change with asset migration
  // 3. Domain change for input/output ports
  // ===================================================================

  @Test
  void test_changeDataProductDomain_noAssets(TestNamespace ns) {
    // Create two domains
    Domain domain1 = createTestDomain(ns, "domain_change_1");
    Domain domain2 = createTestDomain(ns, "domain_change_2");

    // Create data product in domain1
    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_domain_change"))
            .withDescription("Data product for domain change test")
            .withDomains(List.of(domain1.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    // Verify initial domain
    assertEquals(1, dataProduct.getDomains().size());
    assertEquals(domain1.getId(), dataProduct.getDomains().get(0).getId());

    // Change domain to domain2
    dataProduct.setDomains(List.of(domain2.getEntityReference()));
    DataProduct updated = patchEntity(dataProduct.getId().toString(), dataProduct);

    // Verify domain changed
    assertEquals(1, updated.getDomains().size());
    assertEquals(domain2.getId(), updated.getDomains().get(0).getId());

    // Fetch fresh and verify
    DataProduct fetched =
        SdkClients.adminClient().dataProducts().get(updated.getId().toString(), "domains");
    assertEquals(1, fetched.getDomains().size());
    assertEquals(domain2.getId(), fetched.getDomains().get(0).getId());
  }

  @Test
  void test_changeDataProductDomain_withAssetMigration(TestNamespace ns) throws Exception {
    // Create two domains
    Domain domain1 = createTestDomain(ns, "domain_migrate_1");
    Domain domain2 = createTestDomain(ns, "domain_migrate_2");

    // Create data product in domain1
    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_domain_migrate"))
            .withDescription("Data product for domain migration test")
            .withDomains(List.of(domain1.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    // Create a table in domain1 and add it as asset to the data product
    Table table = createTestTable(ns, "migrate_asset", domain1);
    BulkAssets addTable = new BulkAssets().withAssets(List.of(table.getEntityReference()));
    bulkAddAssets(dataProduct.getFullyQualifiedName(), addTable);

    // Verify asset is linked
    ResultList<EntityReference> assets = getAssets(dataProduct.getId(), 10, 0);
    assertEquals(1, assets.getPaging().getTotal());

    // Verify table is in domain1
    Table tableBeforeChange =
        SdkClients.adminClient().tables().get(table.getId().toString(), "domains");
    assertEquals(1, tableBeforeChange.getDomains().size());
    assertEquals(domain1.getId(), tableBeforeChange.getDomains().get(0).getId());

    // Change data product domain to domain2
    dataProduct.setDomains(List.of(domain2.getEntityReference()));
    DataProduct updated = patchEntity(dataProduct.getId().toString(), dataProduct);

    // Verify data product is now in domain2
    assertEquals(1, updated.getDomains().size());
    assertEquals(domain2.getId(), updated.getDomains().get(0).getId());

    // Verify asset is still linked
    assets = getAssets(updated.getId(), 10, 0);
    assertEquals(
        1, assets.getPaging().getTotal(), "Asset should still be linked after domain change");

    // Verify table's domain was migrated to domain2
    Table tableAfterChange =
        SdkClients.adminClient().tables().get(table.getId().toString(), "domains");
    assertEquals(1, tableAfterChange.getDomains().size());
    assertEquals(
        domain2.getId(),
        tableAfterChange.getDomains().getFirst().getId(),
        "Asset should have been migrated to the new domain");

    long uniqueDomainIds =
        tableAfterChange.getDomains().stream().map(EntityReference::getId).distinct().count();
    assertEquals(
        tableAfterChange.getDomains().size(),
        uniqueDomainIds,
        "No duplicate domains should exist in the asset's domains list");

    assertEquals(
        domain2.getFullyQualifiedName(),
        tableAfterChange.getDomains().getFirst().getFullyQualifiedName(),
        "Domain FQN should match the new domain");

    waitForSearchIndexing();

    List<EntityReference> searchIndexDomains =
        getEntityReferencesFromSearchIndex(table.getId(), "table_search_index", "domains");
    assertNotNull(searchIndexDomains, "Table should be present in search index with domains");
    assertEquals(
        1, searchIndexDomains.size(), "Search index should show exactly 1 domain after migration");

    List<UUID> searchDomainIds = searchIndexDomains.stream().map(EntityReference::getId).toList();
    long uniqueSearchDomainIds = searchDomainIds.stream().distinct().count();
    assertEquals(
        searchDomainIds.size(),
        uniqueSearchDomainIds,
        "No duplicate domains should exist in search index (all domain IDs should be unique)");

    assertEquals(
        domain2.getId(),
        searchIndexDomains.getFirst().getId(),
        "Search index should show the migrated domain2");
  }

  @Test
  void test_changeDataProductDomain_multipleAssets(TestNamespace ns) throws Exception {
    // Create two domains
    Domain domain1 = createTestDomain(ns, "domain_multi_1");
    Domain domain2 = createTestDomain(ns, "domain_multi_2");

    // Create data product in domain1
    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_domain_multi"))
            .withDescription("Data product for multiple asset migration")
            .withDomains(List.of(domain1.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    // Create multiple tables in domain1
    Table table1 = createTestTable(ns, "multi_asset_1", domain1);
    Table table2 = createTestTable(ns, "multi_asset_2", domain1);
    Table table3 = createTestTable(ns, "multi_asset_3", domain1);

    // Add all tables as assets
    BulkAssets addTables =
        new BulkAssets()
            .withAssets(
                List.of(
                    table1.getEntityReference(),
                    table2.getEntityReference(),
                    table3.getEntityReference()));
    bulkAddAssets(dataProduct.getFullyQualifiedName(), addTables);

    // Verify all assets are linked
    ResultList<EntityReference> assets = getAssets(dataProduct.getId(), 10, 0);
    assertEquals(3, assets.getPaging().getTotal());

    // Change data product domain to domain2
    dataProduct.setDomains(List.of(domain2.getEntityReference()));
    DataProduct updated = patchEntity(dataProduct.getId().toString(), dataProduct);

    // Verify data product is now in domain2
    assertEquals(domain2.getId(), updated.getDomains().get(0).getId());

    // Verify all assets are still linked
    assets = getAssets(updated.getId(), 10, 0);
    assertEquals(3, assets.getPaging().getTotal(), "All assets should still be linked");

    // Verify all tables' domains were migrated to domain2
    for (Table table : List.of(table1, table2, table3)) {
      Table tableAfterChange =
          SdkClients.adminClient().tables().get(table.getId().toString(), "domains");
      assertEquals(1, tableAfterChange.getDomains().size());
      assertEquals(
          domain2.getId(),
          tableAfterChange.getDomains().get(0).getId(),
          "Asset " + table.getName() + " should have been migrated to the new domain");

      long uniqueDomainIds =
          tableAfterChange.getDomains().stream().map(EntityReference::getId).distinct().count();
      assertEquals(
          tableAfterChange.getDomains().size(),
          uniqueDomainIds,
          "No duplicate domains should exist for asset " + table.getName());

      assertEquals(
          domain2.getFullyQualifiedName(),
          tableAfterChange.getDomains().get(0).getFullyQualifiedName(),
          "Domain FQN should match the new domain for asset " + table.getName());
    }
  }

  @Test
  void test_renameDataProductWithTags(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_rename_tags"))
            .withDescription("Data product for rename with tags test")
            .withDomains(List.of(domain.getFullyQualifiedName()))
            .withTags(List.of(shared.PERSONAL_DATA_TAG_LABEL));
    DataProduct dataProduct = createEntity(create);

    assertNotNull(dataProduct.getTags());
    assertEquals(1, dataProduct.getTags().size());
    assertEquals(
        shared.PERSONAL_DATA_TAG.getFullyQualifiedName(), dataProduct.getTags().get(0).getTagFQN());

    String oldName = dataProduct.getName();
    String oldFqn = dataProduct.getFullyQualifiedName();
    String newName = "renamed-" + oldName;

    dataProduct.setName(newName);
    DataProduct renamed = patchEntity(dataProduct.getId().toString(), dataProduct);

    assertEquals(newName, renamed.getName());
    assertNotEquals(oldFqn, renamed.getFullyQualifiedName());

    DataProduct fetchedWithTags = getEntityWithFields(renamed.getId().toString(), "tags");
    assertNotNull(fetchedWithTags.getTags(), "Tags should not be null after rename");
    assertEquals(1, fetchedWithTags.getTags().size(), "Tags should be preserved after rename");
    assertEquals(
        shared.PERSONAL_DATA_TAG.getFullyQualifiedName(),
        fetchedWithTags.getTags().get(0).getTagFQN(),
        "Tag FQN should remain unchanged after data product rename");
  }

  @Test
  void test_renameDataProductWithGlossaryTerms(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_rename_glossary"))
            .withDescription("Data product for rename with glossary terms test")
            .withDomains(List.of(domain.getFullyQualifiedName()))
            .withTags(List.of(shared.GLOSSARY1_TERM1_LABEL));
    DataProduct dataProduct = createEntity(create);

    assertNotNull(dataProduct.getTags());
    assertEquals(1, dataProduct.getTags().size());
    assertEquals(
        shared.GLOSSARY1_TERM1.getFullyQualifiedName(), dataProduct.getTags().get(0).getTagFQN());
    assertEquals(TagLabel.TagSource.GLOSSARY, dataProduct.getTags().get(0).getSource());

    String oldName = dataProduct.getName();
    String oldFqn = dataProduct.getFullyQualifiedName();
    String newName = "renamed-" + oldName;

    dataProduct.setName(newName);
    DataProduct renamed = patchEntity(dataProduct.getId().toString(), dataProduct);

    assertEquals(newName, renamed.getName());
    assertNotEquals(oldFqn, renamed.getFullyQualifiedName());

    DataProduct fetchedWithTags = getEntityWithFields(renamed.getId().toString(), "tags");
    assertNotNull(fetchedWithTags.getTags(), "Glossary terms should not be null after rename");
    assertEquals(
        1, fetchedWithTags.getTags().size(), "Glossary terms should be preserved after rename");
    assertEquals(
        shared.GLOSSARY1_TERM1.getFullyQualifiedName(),
        fetchedWithTags.getTags().getFirst().getTagFQN(),
        "Glossary term FQN should remain unchanged after data product rename");
    assertEquals(
        TagLabel.TagSource.GLOSSARY,
        fetchedWithTags.getTags().getFirst().getSource(),
        "Tag source should remain GLOSSARY after rename");
  }

  @Test
  void test_renameDataProductWithMultipleTagsAndGlossaryTerms(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_rename_mixed"))
            .withDescription("Data product for rename with mixed tags/glossary terms test")
            .withDomains(List.of(domain.getFullyQualifiedName()))
            .withTags(
                List.of(
                    shared.PERSONAL_DATA_TAG_LABEL,
                    shared.PII_SENSITIVE_TAG_LABEL,
                    shared.GLOSSARY1_TERM1_LABEL));
    DataProduct dataProduct = createEntity(create);

    assertNotNull(dataProduct.getTags());
    assertEquals(3, dataProduct.getTags().size());

    String oldName = dataProduct.getName();
    String newName = "renamed-" + oldName;

    dataProduct.setName(newName);
    DataProduct renamed = patchEntity(dataProduct.getId().toString(), dataProduct);

    DataProduct fetchedWithTags = getEntityWithFields(renamed.getId().toString(), "tags");
    assertNotNull(
        fetchedWithTags.getTags(), "Tags and glossary terms should not be null after rename");
    assertEquals(
        3,
        fetchedWithTags.getTags().size(),
        "All tags and glossary terms should be preserved after rename");

    List<String> tagFQNs = fetchedWithTags.getTags().stream().map(TagLabel::getTagFQN).toList();

    assertTrue(
        tagFQNs.contains(shared.PERSONAL_DATA_TAG.getFullyQualifiedName()),
        "Classification tag 1 should be preserved");
    assertTrue(
        tagFQNs.contains(shared.SENSITIVE_TAG.getFullyQualifiedName()),
        "Classification tag 2 should be preserved");
    assertTrue(
        tagFQNs.contains(shared.GLOSSARY1_TERM1.getFullyQualifiedName()),
        "Glossary term should be preserved");

    long classificationCount =
        fetchedWithTags.getTags().stream()
            .filter(t -> t.getSource() == TagLabel.TagSource.CLASSIFICATION)
            .count();
    long glossaryCount =
        fetchedWithTags.getTags().stream()
            .filter(t -> t.getSource() == TagLabel.TagSource.GLOSSARY)
            .count();

    assertEquals(2, classificationCount, "Should have 2 classification tags");
    assertEquals(1, glossaryCount, "Should have 1 glossary term");
  }

  @Test
  void test_changeDataProductDomain_andUpdateDescription(TestNamespace ns) throws Exception {
    // Create two domains
    Domain domain1 = createTestDomain(ns, "domain_desc_1");
    Domain domain2 = createTestDomain(ns, "domain_desc_2");

    // Create data product in domain1 with an asset
    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_domain_desc"))
            .withDescription("Initial description")
            .withDomains(List.of(domain1.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table = createTestTable(ns, "desc_asset", domain1);
    BulkAssets addTable = new BulkAssets().withAssets(List.of(table.getEntityReference()));
    bulkAddAssets(dataProduct.getFullyQualifiedName(), addTable);

    // Change domain
    dataProduct.setDomains(List.of(domain2.getEntityReference()));
    DataProduct afterDomainChange = patchEntity(dataProduct.getId().toString(), dataProduct);
    assertEquals(domain2.getId(), afterDomainChange.getDomains().get(0).getId());

    // Update description (triggers consolidation)
    afterDomainChange.setDescription("Updated description after domain change");
    DataProduct afterDescUpdate =
        patchEntity(afterDomainChange.getId().toString(), afterDomainChange);
    assertEquals("Updated description after domain change", afterDescUpdate.getDescription());

    // Verify domain is still domain2 after consolidation
    assertEquals(domain2.getId(), afterDescUpdate.getDomains().get(0).getId());

    // Verify asset is still linked and in new domain
    ResultList<EntityReference> assets = getAssets(afterDescUpdate.getId(), 10, 0);
    assertEquals(1, assets.getPaging().getTotal());

    Table tableAfter = SdkClients.adminClient().tables().get(table.getId().toString(), "domains");
    assertEquals(1, tableAfter.getDomains().size(), "Asset should have exactly 1 domain");
    assertEquals(domain2.getId(), tableAfter.getDomains().get(0).getId());

    long uniqueDomainIds =
        tableAfter.getDomains().stream().map(EntityReference::getId).distinct().count();
    assertEquals(
        tableAfter.getDomains().size(),
        uniqueDomainIds,
        "No duplicate domains should exist after domain change and consolidation");

    assertEquals(
        domain2.getFullyQualifiedName(),
        tableAfter.getDomains().get(0).getFullyQualifiedName(),
        "Domain FQN should match the new domain after consolidation");

    waitForSearchIndexing();

    List<EntityReference> searchIndexDomains =
        getEntityReferencesFromSearchIndex(table.getId(), "table_search_index", "domains");
    assertNotNull(
        searchIndexDomains,
        "Table should be present in search index with domains after consolidation");
    assertEquals(
        1,
        searchIndexDomains.size(),
        "Search index should show exactly 1 domain after consolidation");

    List<UUID> searchDomainIds = searchIndexDomains.stream().map(EntityReference::getId).toList();
    long uniqueSearchDomainIds = searchDomainIds.stream().distinct().count();
    assertEquals(
        searchDomainIds.size(),
        uniqueSearchDomainIds,
        "No duplicate domains in search index after domain change and consolidation");

    assertEquals(
        domain2.getId(),
        searchIndexDomains.get(0).getId(),
        "Search index should reflect domain2 after consolidation");
  }

  // ===================================================================
  // INPUT/OUTPUT PORTS API TESTS
  // Tests for the new paginated port endpoints
  // ===================================================================

  @Test
  void test_getInputPortsPaginated(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_input_ports"))
            .withDescription("Data product for input ports test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table1 = createTestTable(ns, "input_port_1", domain);
    Table table2 = createTestTable(ns, "input_port_2", domain);
    Table table3 = createTestTable(ns, "input_port_3", domain);

    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(
                List.of(
                    table1.getEntityReference(),
                    table2.getEntityReference(),
                    table3.getEntityReference())));

    ResultList<Map<String, Object>> allInputPorts = getInputPorts(dataProduct.getId(), 10, 0);
    assertEquals(3, allInputPorts.getPaging().getTotal());
    assertEquals(3, allInputPorts.getData().size());

    ResultList<Map<String, Object>> page1 = getInputPorts(dataProduct.getId(), 2, 0);
    assertEquals(3, page1.getPaging().getTotal());
    assertEquals(2, page1.getData().size());

    ResultList<Map<String, Object>> page2 = getInputPorts(dataProduct.getId(), 2, 2);
    assertEquals(3, page2.getPaging().getTotal());
    assertEquals(1, page2.getData().size());

    ResultList<Map<String, Object>> inputPortsByName =
        getInputPortsByName(dataProduct.getFullyQualifiedName(), 10, 0);
    assertEquals(3, inputPortsByName.getPaging().getTotal());
    assertEquals(3, inputPortsByName.getData().size());
  }

  @Test
  void test_getOutputPortsPaginated(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_output_ports"))
            .withDescription("Data product for output ports test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table1 = createTestTable(ns, "output_port_1", domain);
    Table table2 = createTestTable(ns, "output_port_2", domain);

    bulkAddOutputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(List.of(table1.getEntityReference(), table2.getEntityReference())));

    ResultList<Map<String, Object>> allOutputPorts = getOutputPorts(dataProduct.getId(), 10, 0);
    assertEquals(2, allOutputPorts.getPaging().getTotal());
    assertEquals(2, allOutputPorts.getData().size());

    ResultList<Map<String, Object>> page1 = getOutputPorts(dataProduct.getId(), 1, 0);
    assertEquals(2, page1.getPaging().getTotal());
    assertEquals(1, page1.getData().size());

    ResultList<Map<String, Object>> page2 = getOutputPorts(dataProduct.getId(), 1, 1);
    assertEquals(2, page2.getPaging().getTotal());
    assertEquals(1, page2.getData().size());

    assertNotEquals(getEntityId(page1.getData().get(0)), getEntityId(page2.getData().get(0)));

    ResultList<Map<String, Object>> outputPortsByName =
        getOutputPortsByName(dataProduct.getFullyQualifiedName(), 10, 0);
    assertEquals(2, outputPortsByName.getPaging().getTotal());
    assertEquals(2, outputPortsByName.getData().size());
  }

  @Test
  void test_getPortsViewCombined(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_ports_view"))
            .withDescription("Data product for combined ports view test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table inputTable1 = createTestTable(ns, "view_input_1", domain);
    Table inputTable2 = createTestTable(ns, "view_input_2", domain);
    Table inputTable3 = createTestTable(ns, "view_input_3", domain);
    Table outputTable1 = createTestTable(ns, "view_output_1", domain);
    Table outputTable2 = createTestTable(ns, "view_output_2", domain);

    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(
                List.of(
                    inputTable1.getEntityReference(),
                    inputTable2.getEntityReference(),
                    inputTable3.getEntityReference())));

    bulkAddOutputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(
                List.of(outputTable1.getEntityReference(), outputTable2.getEntityReference())));

    DataProductPortsView portsView = getPortsView(dataProduct.getId(), 10, 0, 10, 0);

    assertNotNull(portsView.getEntity());
    assertEquals(dataProduct.getId(), portsView.getEntity().getId());

    assertNotNull(portsView.getInputPorts());
    assertEquals(3, portsView.getInputPorts().getPaging().getTotal());
    assertEquals(3, portsView.getInputPorts().getData().size());

    assertNotNull(portsView.getOutputPorts());
    assertEquals(2, portsView.getOutputPorts().getPaging().getTotal());
    assertEquals(2, portsView.getOutputPorts().getData().size());

    DataProductPortsView paginatedView = getPortsView(dataProduct.getId(), 2, 0, 1, 0);

    assertEquals(3, paginatedView.getInputPorts().getPaging().getTotal());
    assertEquals(2, paginatedView.getInputPorts().getData().size());

    assertEquals(2, paginatedView.getOutputPorts().getPaging().getTotal());
    assertEquals(1, paginatedView.getOutputPorts().getData().size());

    DataProductPortsView portsViewByName =
        getPortsViewByName(dataProduct.getFullyQualifiedName(), 10, 0, 10, 0);

    assertEquals(dataProduct.getId(), portsViewByName.getEntity().getId());
    assertEquals(3, portsViewByName.getInputPorts().getPaging().getTotal());
    assertEquals(2, portsViewByName.getOutputPorts().getPaging().getTotal());
  }

  @Test
  void test_getPortsViewWithDifferentPagination(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_ports_pagination"))
            .withDescription("Data product for ports pagination test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    List<Table> inputTables = new java.util.ArrayList<>();
    for (int i = 0; i < 5; i++) {
      inputTables.add(createTestTable(ns, "pagination_input_" + i, domain));
    }

    List<Table> outputTables = new java.util.ArrayList<>();
    for (int i = 0; i < 3; i++) {
      outputTables.add(createTestTable(ns, "pagination_output_" + i, domain));
    }

    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(inputTables.stream().map(Table::getEntityReference).toList()));

    bulkAddOutputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(outputTables.stream().map(Table::getEntityReference).toList()));

    DataProductPortsView view1 = getPortsView(dataProduct.getId(), 2, 0, 3, 0);
    assertEquals(5, view1.getInputPorts().getPaging().getTotal());
    assertEquals(2, view1.getInputPorts().getData().size());
    assertEquals(3, view1.getOutputPorts().getPaging().getTotal());
    assertEquals(3, view1.getOutputPorts().getData().size());

    DataProductPortsView view2 = getPortsView(dataProduct.getId(), 2, 2, 1, 1);
    assertEquals(5, view2.getInputPorts().getPaging().getTotal());
    assertEquals(2, view2.getInputPorts().getData().size());
    assertEquals(3, view2.getOutputPorts().getPaging().getTotal());
    assertEquals(1, view2.getOutputPorts().getData().size());

    DataProductPortsView view3 = getPortsView(dataProduct.getId(), 2, 4, 1, 2);
    assertEquals(5, view3.getInputPorts().getPaging().getTotal());
    assertEquals(1, view3.getInputPorts().getData().size());
    assertEquals(3, view3.getOutputPorts().getPaging().getTotal());
    assertEquals(1, view3.getOutputPorts().getData().size());
  }

  @Test
  void test_emptyPortsView(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_empty_ports"))
            .withDescription("Data product with no ports")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    DataProductPortsView portsView = getPortsView(dataProduct.getId(), 10, 0, 10, 0);

    assertNotNull(portsView.getEntity());
    assertEquals(dataProduct.getId(), portsView.getEntity().getId());

    assertNotNull(portsView.getInputPorts());
    assertEquals(0, portsView.getInputPorts().getPaging().getTotal());
    assertEquals(0, portsView.getInputPorts().getData().size());

    assertNotNull(portsView.getOutputPorts());
    assertEquals(0, portsView.getOutputPorts().getPaging().getTotal());
    assertEquals(0, portsView.getOutputPorts().getData().size());
  }

  private void bulkAddInputPorts(String dataProductName, BulkAssets request) {
    SdkClients.adminClient().dataProducts().inputPorts(dataProductName).add(request);
  }

  private void bulkAddOutputPorts(String dataProductName, BulkAssets request) throws Exception {
    bulkAddAssets(dataProductName, request);
    SdkClients.adminClient().dataProducts().outputPorts(dataProductName).add(request);
  }

  @SuppressWarnings("unchecked")
  private ResultList<Map<String, Object>> getInputPorts(UUID id, int limit, int offset) {
    return (ResultList<Map<String, Object>>)
        SdkClients.adminClient().dataProducts().inputPorts(id).list(limit, offset);
  }

  @SuppressWarnings("unchecked")
  private ResultList<Map<String, Object>> getInputPorts(
      UUID id, String fields, int limit, int offset) {
    return (ResultList<Map<String, Object>>)
        SdkClients.adminClient().dataProducts().inputPorts(id).list(fields, limit, offset);
  }

  @SuppressWarnings("unchecked")
  private ResultList<Map<String, Object>> getInputPortsByName(String name, int limit, int offset) {
    return (ResultList<Map<String, Object>>)
        SdkClients.adminClient().dataProducts().inputPorts(name).list(limit, offset);
  }

  @SuppressWarnings("unchecked")
  private ResultList<Map<String, Object>> getOutputPorts(UUID id, int limit, int offset) {
    return (ResultList<Map<String, Object>>)
        SdkClients.adminClient().dataProducts().outputPorts(id).list(limit, offset);
  }

  @SuppressWarnings("unchecked")
  private ResultList<Map<String, Object>> getOutputPorts(
      UUID id, String fields, int limit, int offset) {
    return (ResultList<Map<String, Object>>)
        SdkClients.adminClient().dataProducts().outputPorts(id).list(fields, limit, offset);
  }

  @SuppressWarnings("unchecked")
  private ResultList<Map<String, Object>> getOutputPortsByName(String name, int limit, int offset) {
    return (ResultList<Map<String, Object>>)
        SdkClients.adminClient().dataProducts().outputPorts(name).list(limit, offset);
  }

  private UUID getEntityId(Map<String, Object> entity) {
    return UUID.fromString((String) entity.get("id"));
  }

  private DataProductPortsView getPortsView(
      UUID id, int inputLimit, int inputOffset, int outputLimit, int outputOffset) {
    return SdkClients.adminClient()
        .dataProducts()
        .portsView(id)
        .get(inputLimit, inputOffset, outputLimit, outputOffset);
  }

  private DataProductPortsView getPortsView(
      UUID id, String fields, int inputLimit, int inputOffset, int outputLimit, int outputOffset) {
    return SdkClients.adminClient()
        .dataProducts()
        .portsView(id)
        .get(fields, inputLimit, inputOffset, outputLimit, outputOffset);
  }

  private DataProductPortsView getPortsViewByName(
      String name, int inputLimit, int inputOffset, int outputLimit, int outputOffset) {
    return SdkClients.adminClient()
        .dataProducts()
        .portsView(name)
        .get(inputLimit, inputOffset, outputLimit, outputOffset);
  }

  // ===================================================================
  // ADDITIONAL PORT OPERATION TESTS
  // Tests for remove operations, by-ID operations, and edge cases
  // ===================================================================

  @Test
  void test_removeInputPorts(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_remove_input_ports"))
            .withDescription("Data product for remove input ports test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table1 = createTestTable(ns, "remove_input_1", domain);
    Table table2 = createTestTable(ns, "remove_input_2", domain);
    Table table3 = createTestTable(ns, "remove_input_3", domain);

    // Add all ports
    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(
                List.of(
                    table1.getEntityReference(),
                    table2.getEntityReference(),
                    table3.getEntityReference())));

    ResultList<Map<String, Object>> beforeRemove = getInputPorts(dataProduct.getId(), 10, 0);
    assertEquals(3, beforeRemove.getPaging().getTotal());

    // Remove one port
    SdkClients.adminClient()
        .dataProducts()
        .inputPorts(dataProduct.getFullyQualifiedName())
        .remove(new BulkAssets().withAssets(List.of(table2.getEntityReference())));

    ResultList<Map<String, Object>> afterRemove = getInputPorts(dataProduct.getId(), 10, 0);
    assertEquals(2, afterRemove.getPaging().getTotal());

    // Verify correct port was removed
    List<UUID> remainingIds = afterRemove.getData().stream().map(this::getEntityId).toList();
    assertTrue(remainingIds.contains(table1.getId()));
    assertFalse(remainingIds.contains(table2.getId()));
    assertTrue(remainingIds.contains(table3.getId()));
  }

  @Test
  void test_removeOutputPorts(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_remove_output_ports"))
            .withDescription("Data product for remove output ports test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table1 = createTestTable(ns, "remove_output_1", domain);
    Table table2 = createTestTable(ns, "remove_output_2", domain);

    // Add ports
    bulkAddOutputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(List.of(table1.getEntityReference(), table2.getEntityReference())));

    assertEquals(2, getOutputPorts(dataProduct.getId(), 10, 0).getPaging().getTotal());

    // Remove one port
    SdkClients.adminClient()
        .dataProducts()
        .outputPorts(dataProduct.getFullyQualifiedName())
        .remove(new BulkAssets().withAssets(List.of(table1.getEntityReference())));

    ResultList<Map<String, Object>> afterRemove = getOutputPorts(dataProduct.getId(), 10, 0);
    assertEquals(1, afterRemove.getPaging().getTotal());
    assertEquals(table2.getId(), getEntityId(afterRemove.getData().get(0)));
  }

  @Test
  void test_listPortsById(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_list_by_id"))
            .withDescription("Data product for list ports by ID test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table1 = createTestTable(ns, "list_by_id_1", domain);
    Table table2 = createTestTable(ns, "list_by_id_2", domain);

    // Add ports by name (bulk operations use name-based endpoints)
    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table1.getEntityReference())));
    bulkAddOutputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table2.getEntityReference())));

    // List ports by ID (list operations support ID-based endpoints)
    ResultList<Map<String, Object>> inputPorts = getInputPorts(dataProduct.getId(), 10, 0);
    ResultList<Map<String, Object>> outputPorts = getOutputPorts(dataProduct.getId(), 10, 0);

    assertEquals(1, inputPorts.getPaging().getTotal());
    assertEquals(1, outputPorts.getPaging().getTotal());
    assertEquals(table1.getId(), getEntityId(inputPorts.getData().get(0)));
    assertEquals(table2.getId(), getEntityId(outputPorts.getData().get(0)));
  }

  @Test
  void test_paginationOffsetBeyondTotal(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_offset_beyond"))
            .withDescription("Data product for offset beyond total test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table1 = createTestTable(ns, "offset_test_1", domain);
    Table table2 = createTestTable(ns, "offset_test_2", domain);

    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(List.of(table1.getEntityReference(), table2.getEntityReference())));

    // Request with offset beyond total
    ResultList<Map<String, Object>> result = getInputPorts(dataProduct.getId(), 10, 100);
    assertEquals(2, result.getPaging().getTotal());
    assertEquals(0, result.getData().size());

    // Test via portsView as well
    DataProductPortsView portsView = getPortsView(dataProduct.getId(), 10, 100, 10, 100);
    assertEquals(2, portsView.getInputPorts().getPaging().getTotal());
    assertEquals(0, portsView.getInputPorts().getData().size());
  }

  @Test
  void test_bulkRemoveMultiplePorts(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_bulk_remove"))
            .withDescription("Data product for bulk remove ports test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table1 = createTestTable(ns, "bulk_remove_1", domain);
    Table table2 = createTestTable(ns, "bulk_remove_2", domain);
    Table table3 = createTestTable(ns, "bulk_remove_3", domain);

    // Add all ports
    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(
                List.of(
                    table1.getEntityReference(),
                    table2.getEntityReference(),
                    table3.getEntityReference())));

    assertEquals(3, getInputPorts(dataProduct.getId(), 10, 0).getPaging().getTotal());

    // Remove multiple ports at once
    SdkClients.adminClient()
        .dataProducts()
        .inputPorts(dataProduct.getFullyQualifiedName())
        .remove(
            new BulkAssets()
                .withAssets(List.of(table1.getEntityReference(), table3.getEntityReference())));

    ResultList<Map<String, Object>> afterRemove = getInputPorts(dataProduct.getId(), 10, 0);
    assertEquals(1, afterRemove.getPaging().getTotal());
    assertEquals(table2.getId(), getEntityId(afterRemove.getData().get(0)));
  }

  @Test
  void test_addPortsById(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_add_by_id"))
            .withDescription("Data product for add ports by ID test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table1 = createTestTable(ns, "add_by_id_input", domain);
    Table table2 = createTestTable(ns, "add_by_id_output", domain);

    // Add input port by ID
    SdkClients.adminClient()
        .dataProducts()
        .inputPorts(dataProduct.getId())
        .add(new BulkAssets().withAssets(List.of(table1.getEntityReference())));

    // Add table2 as data product asset first, then as output port by ID
    bulkAddAssets(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table2.getEntityReference())));
    SdkClients.adminClient()
        .dataProducts()
        .outputPorts(dataProduct.getId())
        .add(new BulkAssets().withAssets(List.of(table2.getEntityReference())));

    // Verify ports were added
    ResultList<Map<String, Object>> inputPorts = getInputPorts(dataProduct.getId(), 10, 0);
    ResultList<Map<String, Object>> outputPorts = getOutputPorts(dataProduct.getId(), 10, 0);

    assertEquals(1, inputPorts.getPaging().getTotal());
    assertEquals(1, outputPorts.getPaging().getTotal());
    assertEquals(table1.getId(), getEntityId(inputPorts.getData().get(0)));
    assertEquals(table2.getId(), getEntityId(outputPorts.getData().get(0)));
  }

  @Test
  void test_removePortsById(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_remove_by_id"))
            .withDescription("Data product for remove ports by ID test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table1 = createTestTable(ns, "remove_by_id_input1", domain);
    Table table2 = createTestTable(ns, "remove_by_id_input2", domain);
    Table table3 = createTestTable(ns, "remove_by_id_output1", domain);
    Table table4 = createTestTable(ns, "remove_by_id_output2", domain);

    // Add ports by name first
    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(List.of(table1.getEntityReference(), table2.getEntityReference())));
    bulkAddOutputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(List.of(table3.getEntityReference(), table4.getEntityReference())));

    assertEquals(2, getInputPorts(dataProduct.getId(), 10, 0).getPaging().getTotal());
    assertEquals(2, getOutputPorts(dataProduct.getId(), 10, 0).getPaging().getTotal());

    // Remove input port by ID
    SdkClients.adminClient()
        .dataProducts()
        .inputPorts(dataProduct.getId())
        .remove(new BulkAssets().withAssets(List.of(table1.getEntityReference())));

    // Remove output port by ID
    SdkClients.adminClient()
        .dataProducts()
        .outputPorts(dataProduct.getId())
        .remove(new BulkAssets().withAssets(List.of(table3.getEntityReference())));

    // Verify correct ports were removed
    ResultList<Map<String, Object>> inputPorts = getInputPorts(dataProduct.getId(), 10, 0);
    ResultList<Map<String, Object>> outputPorts = getOutputPorts(dataProduct.getId(), 10, 0);

    assertEquals(1, inputPorts.getPaging().getTotal());
    assertEquals(1, outputPorts.getPaging().getTotal());
    assertEquals(table2.getId(), getEntityId(inputPorts.getData().get(0)));
    assertEquals(table4.getId(), getEntityId(outputPorts.getData().get(0)));
  }

  @Test
  void test_portsViewById(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_portsview_by_id"))
            .withDescription("Data product for ports view by ID test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table1 = createTestTable(ns, "portsview_id_input", domain);
    Table table2 = createTestTable(ns, "portsview_id_output", domain);

    // Add table2 as data product asset (required for output port)
    bulkAddAssets(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table2.getEntityReference())));

    // Add ports using ID-based API
    SdkClients.adminClient()
        .dataProducts()
        .inputPorts(dataProduct.getId())
        .add(new BulkAssets().withAssets(List.of(table1.getEntityReference())));
    SdkClients.adminClient()
        .dataProducts()
        .outputPorts(dataProduct.getId())
        .add(new BulkAssets().withAssets(List.of(table2.getEntityReference())));

    // Get ports view by ID
    DataProductPortsView portsViewById =
        SdkClients.adminClient().dataProducts().portsView(dataProduct.getId()).get();

    assertEquals(1, portsViewById.getInputPorts().getPaging().getTotal());
    assertEquals(1, portsViewById.getOutputPorts().getPaging().getTotal());
    assertEquals(
        table1.getId(),
        getEntityId(portsViewById.getInputPorts().getData().get(0).getAdditionalProperties()));
    assertEquals(
        table2.getId(),
        getEntityId(portsViewById.getOutputPorts().getData().get(0).getAdditionalProperties()));

    // Get ports view by name and compare
    DataProductPortsView portsViewByName =
        SdkClients.adminClient()
            .dataProducts()
            .portsView(dataProduct.getFullyQualifiedName())
            .get();

    assertEquals(
        portsViewById.getInputPorts().getPaging().getTotal(),
        portsViewByName.getInputPorts().getPaging().getTotal());
    assertEquals(
        portsViewById.getOutputPorts().getPaging().getTotal(),
        portsViewByName.getOutputPorts().getPaging().getTotal());
  }

  @Test
  void test_portsWithFieldsParameter(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_ports_fields"))
            .withDescription("Data product for ports fields test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table1 = createTestTable(ns, "ports_fields_input", domain);
    Table table2 = createTestTable(ns, "ports_fields_output", domain);

    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table1.getEntityReference())));
    bulkAddOutputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table2.getEntityReference())));

    // Test without fields parameter - should not include owners/tags
    ResultList<Map<String, Object>> inputPortsNoFields = getInputPorts(dataProduct.getId(), 10, 0);
    assertEquals(1, inputPortsNoFields.getPaging().getTotal());
    Map<String, Object> portNoFields = inputPortsNoFields.getData().get(0);
    assertNotNull(portNoFields.get("id"));
    assertNotNull(portNoFields.get("name"));

    // Test with fields=owners - should include owners
    ResultList<Map<String, Object>> inputPortsWithOwners =
        getInputPorts(dataProduct.getId(), "owners", 10, 0);
    assertEquals(1, inputPortsWithOwners.getPaging().getTotal());
    Map<String, Object> portWithOwners = inputPortsWithOwners.getData().get(0);
    assertNotNull(portWithOwners.get("id"));

    // Test with fields=owners,tags - should include both
    ResultList<Map<String, Object>> inputPortsWithMultipleFields =
        getInputPorts(dataProduct.getId(), "owners,tags", 10, 0);
    assertEquals(1, inputPortsWithMultipleFields.getPaging().getTotal());

    // Test output ports with fields
    ResultList<Map<String, Object>> outputPortsWithFields =
        getOutputPorts(dataProduct.getId(), "owners,tags", 10, 0);
    assertEquals(1, outputPortsWithFields.getPaging().getTotal());

    // Test portsView with fields
    DataProductPortsView portsViewWithFields =
        getPortsView(dataProduct.getId(), "owners,tags", 10, 0, 10, 0);
    assertNotNull(portsViewWithFields.getInputPorts());
    assertEquals(1, portsViewWithFields.getInputPorts().getPaging().getTotal());
    assertNotNull(portsViewWithFields.getOutputPorts());
    assertEquals(1, portsViewWithFields.getOutputPorts().getPaging().getTotal());

    // Test portsView without fields
    DataProductPortsView portsViewNoFields = getPortsView(dataProduct.getId(), 10, 0, 10, 0);
    assertNotNull(portsViewNoFields.getInputPorts());
    assertEquals(1, portsViewNoFields.getInputPorts().getPaging().getTotal());
  }

  @Test
  void test_portsReturnEntityType(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_entity_type_test"))
            .withDescription("Data product to verify entityType is returned")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table inputTable = createTestTable(ns, "entity_type_input", domain);
    Table outputTable = createTestTable(ns, "entity_type_output", domain);

    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(inputTable.getEntityReference())));

    bulkAddOutputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(outputTable.getEntityReference())));

    // Verify entityType is returned in input ports response
    ResultList<Map<String, Object>> inputPorts = getInputPorts(dataProduct.getId(), 10, 0);
    assertEquals(1, inputPorts.getPaging().getTotal());
    Map<String, Object> inputPort = inputPorts.getData().get(0);
    assertNotNull(
        inputPort.get("entityType"), "entityType should be present in input port response");
    assertEquals(
        "table", inputPort.get("entityType"), "entityType should be 'table' for table entity");
    assertEquals(inputTable.getId(), getEntityId(inputPort));

    // Verify entityType is returned in output ports response
    ResultList<Map<String, Object>> outputPorts = getOutputPorts(dataProduct.getId(), 10, 0);
    assertEquals(1, outputPorts.getPaging().getTotal());
    Map<String, Object> outputPort = outputPorts.getData().get(0);
    assertNotNull(
        outputPort.get("entityType"), "entityType should be present in output port response");
    assertEquals(
        "table", outputPort.get("entityType"), "entityType should be 'table' for table entity");
    assertEquals(outputTable.getId(), getEntityId(outputPort));

    // Verify entityType is returned in portsView response
    DataProductPortsView portsView = getPortsView(dataProduct.getId(), 10, 0, 10, 0);
    assertNotNull(portsView.getInputPorts());
    assertEquals(1, portsView.getInputPorts().getData().size());
    Map<String, Object> portsViewInput =
        portsView.getInputPorts().getData().get(0).getAdditionalProperties();
    assertNotNull(
        portsViewInput.get("entityType"), "entityType should be present in portsView input");
    assertEquals("table", portsViewInput.get("entityType"));

    assertNotNull(portsView.getOutputPorts());
    assertEquals(1, portsView.getOutputPorts().getData().size());
    Map<String, Object> portsViewOutput =
        portsView.getOutputPorts().getData().get(0).getAdditionalProperties();
    assertNotNull(
        portsViewOutput.get("entityType"), "entityType should be present in portsView output");
    assertEquals("table", portsViewOutput.get("entityType"));
  }

  @Test
  void test_portsEntityTypeWithMultipleTables(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_multiple_tables_entity_type"))
            .withDescription("Data product to verify entityType with multiple tables")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table1 = createTestTable(ns, "multi_table_1", domain);
    Table table2 = createTestTable(ns, "multi_table_2", domain);
    Table table3 = createTestTable(ns, "multi_table_3", domain);

    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(
                List.of(
                    table1.getEntityReference(),
                    table2.getEntityReference(),
                    table3.getEntityReference())));

    // Verify all ports have entityType set correctly
    ResultList<Map<String, Object>> inputPorts = getInputPorts(dataProduct.getId(), 10, 0);
    assertEquals(3, inputPorts.getPaging().getTotal());

    for (Map<String, Object> port : inputPorts.getData()) {
      assertNotNull(port.get("entityType"), "Each port should have entityType");
      assertEquals("table", port.get("entityType"), "All ports should have entityType 'table'");
      assertNotNull(port.get("id"), "Each port should have id");
      assertNotNull(port.get("name"), "Each port should have name");
    }
  }

  @Test
  void test_portsEntityTypeAcrossDifferentEntityTypes(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_mixed_entity_types"))
            .withDescription("Data product to verify entityType across different entity types")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    // Create different entity types
    Table table = createTestTable(ns, "mixed_table", domain);
    Dashboard dashboard = createTestDashboard(ns, "mixed_dashboard", domain);
    Topic topic = createTestTopic(ns, "mixed_topic", domain);

    // Add table and dashboard as input ports
    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(List.of(table.getEntityReference(), dashboard.getEntityReference())));

    // Add topic as output port
    bulkAddOutputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(topic.getEntityReference())));

    // Verify input ports have correct entityType for each entity
    ResultList<Map<String, Object>> inputPorts = getInputPorts(dataProduct.getId(), 10, 0);
    assertEquals(2, inputPorts.getPaging().getTotal());

    boolean foundTable = false;
    boolean foundDashboard = false;

    for (Map<String, Object> port : inputPorts.getData()) {
      assertNotNull(port.get("entityType"), "Each port should have entityType");
      String entityType = (String) port.get("entityType");
      UUID portId = getEntityId(port);

      if (portId.equals(table.getId())) {
        assertEquals("table", entityType, "Table entity should have entityType 'table'");
        foundTable = true;
      } else if (portId.equals(dashboard.getId())) {
        assertEquals(
            "dashboard", entityType, "Dashboard entity should have entityType 'dashboard'");
        foundDashboard = true;
      }
    }

    assertTrue(foundTable, "Table should be found in input ports");
    assertTrue(foundDashboard, "Dashboard should be found in input ports");

    // Verify output ports have correct entityType for topic
    ResultList<Map<String, Object>> outputPorts = getOutputPorts(dataProduct.getId(), 10, 0);
    assertEquals(1, outputPorts.getPaging().getTotal());

    Map<String, Object> outputPort = outputPorts.getData().get(0);
    assertNotNull(outputPort.get("entityType"), "Output port should have entityType");
    assertEquals(
        "topic", outputPort.get("entityType"), "Topic entity should have entityType 'topic'");
    assertEquals(topic.getId(), getEntityId(outputPort));

    // Verify portsView also returns correct entityTypes
    DataProductPortsView portsView = getPortsView(dataProduct.getId(), 10, 0, 10, 0);

    // Verify input ports in portsView
    assertEquals(2, portsView.getInputPorts().getData().size());
    for (int i = 0; i < portsView.getInputPorts().getData().size(); i++) {
      Map<String, Object> port =
          portsView.getInputPorts().getData().get(i).getAdditionalProperties();
      assertNotNull(port.get("entityType"), "PortsView input should have entityType");
      String entityType = (String) port.get("entityType");
      assertTrue(
          entityType.equals("table") || entityType.equals("dashboard"),
          "EntityType should be 'table' or 'dashboard', got: " + entityType);
    }

    // Verify output ports in portsView
    assertEquals(1, portsView.getOutputPorts().getData().size());
    Map<String, Object> portsViewOutput =
        portsView.getOutputPorts().getData().get(0).getAdditionalProperties();
    assertNotNull(portsViewOutput.get("entityType"), "PortsView output should have entityType");
    assertEquals("topic", portsViewOutput.get("entityType"));
  }

  @Test
  void test_invalidFieldsValidation_inputPorts(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_invalid_fields_input"))
            .withDescription("Data product for invalid fields test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table = createTestTable(ns, "invalid_fields_table", domain);

    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table.getEntityReference())));

    InvalidRequestException exception =
        assertThrows(
            InvalidRequestException.class,
            () -> getInputPorts(dataProduct.getId(), "invalidField", 10, 0),
            "Should throw exception for invalid field");
    assertEquals(400, exception.getStatusCode(), "Should return 400 for invalid field");
    assertTrue(
        exception.getMessage().contains("Invalid field"),
        "Error message should mention invalid field");
  }

  @Test
  void test_invalidFieldsValidation_outputPorts(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_invalid_fields_output"))
            .withDescription("Data product for invalid fields test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table = createTestTable(ns, "invalid_fields_output_table", domain);

    bulkAddOutputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table.getEntityReference())));

    InvalidRequestException exception =
        assertThrows(
            InvalidRequestException.class,
            () -> getOutputPorts(dataProduct.getId(), "nonExistentField", 10, 0),
            "Should throw exception for invalid field");
    assertEquals(400, exception.getStatusCode(), "Should return 400 for invalid field");
    assertTrue(
        exception.getMessage().contains("Invalid field"),
        "Error message should mention invalid field");
  }

  @Test
  void test_invalidFieldsValidation_portsView(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_invalid_fields_portsview"))
            .withDescription("Data product for invalid fields test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    InvalidRequestException exception =
        assertThrows(
            InvalidRequestException.class,
            () -> getPortsView(dataProduct.getId(), "badField,anotherBadField", 10, 0, 10, 0),
            "Should throw exception for invalid fields");
    assertEquals(400, exception.getStatusCode(), "Should return 400 for invalid fields");
    assertTrue(
        exception.getMessage().contains("Invalid field"),
        "Error message should mention invalid field");
  }

  @Test
  void test_validFieldsAccepted(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_valid_fields"))
            .withDescription("Data product for valid fields test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table inputTable = createTestTable(ns, "valid_fields_input", domain);
    Table outputTable = createTestTable(ns, "valid_fields_output", domain);

    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(inputTable.getEntityReference())));
    bulkAddOutputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(outputTable.getEntityReference())));

    ResultList<Map<String, Object>> inputPorts =
        getInputPorts(dataProduct.getId(), "owners,tags,followers", 10, 0);
    assertEquals(1, inputPorts.getPaging().getTotal());

    ResultList<Map<String, Object>> outputPorts =
        getOutputPorts(dataProduct.getId(), "domains,votes,extension", 10, 0);
    assertEquals(1, outputPorts.getPaging().getTotal());

    DataProductPortsView portsView = getPortsView(dataProduct.getId(), "owners,tags", 10, 0, 10, 0);
    assertNotNull(portsView.getInputPorts());
    assertNotNull(portsView.getOutputPorts());
  }

  @Test
  void test_mixedValidInvalidFields(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_mixed_fields"))
            .withDescription("Data product for mixed fields test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    InvalidRequestException exception =
        assertThrows(
            InvalidRequestException.class,
            () -> getInputPorts(dataProduct.getId(), "owners,invalidField,tags", 10, 0),
            "Should throw exception when mix of valid and invalid fields");
    assertEquals(400, exception.getStatusCode(), "Should return 400 for invalid field");
    assertTrue(
        exception.getMessage().contains("invalidField"),
        "Error message should mention the invalid field name");
  }

  @Test
  void test_assetCannotBeBothInputAndOutputPort(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_port_exclusivity"))
            .withDescription("Data product for port exclusivity test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table1 = createTestTable(ns, "excl_1", domain);
    Table table2 = createTestTable(ns, "excl_2", domain);
    Table table3 = createTestTable(ns, "excl_3", domain);

    // Add table1 and table2 as input ports
    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(List.of(table1.getEntityReference(), table2.getEntityReference())));

    // Add table1 and table3 as data product assets (required for output ports)
    bulkAddAssets(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(List.of(table1.getEntityReference(), table3.getEntityReference())));

    // Try adding table1 (already input port) and table3 (new) as output ports via SDK directly
    BulkOperationResult result =
        SdkClients.adminClient()
            .dataProducts()
            .outputPorts(dataProduct.getFullyQualifiedName())
            .add(
                new BulkAssets()
                    .withAssets(List.of(table1.getEntityReference(), table3.getEntityReference())));

    // table1 should fail, table3 should succeed
    assertEquals(2, result.getNumberOfRowsProcessed());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertEquals(1, result.getNumberOfRowsFailed());
    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
    assertEquals(1, result.getSuccessRequest().size());
    assertEquals(
        table3.getId(),
        JsonUtils.convertValue(
                result.getSuccessRequest().get(0).getRequest(), EntityReference.class)
            .getId());
    assertEquals(1, result.getFailedRequest().size());
    assertEquals(
        table1.getId(),
        JsonUtils.convertValue(result.getFailedRequest().get(0).getRequest(), EntityReference.class)
            .getId());
    assertTrue(result.getFailedRequest().get(0).getMessage().contains("input ports"));

    // Verify output ports only contain table3
    ResultList<Map<String, Object>> outputPorts = getOutputPorts(dataProduct.getId(), 10, 0);
    assertEquals(1, outputPorts.getPaging().getTotal());
    assertEquals(table3.getId(), getEntityId(outputPorts.getData().get(0)));

    // Verify input ports unchanged
    ResultList<Map<String, Object>> inputPorts = getInputPorts(dataProduct.getId(), 10, 0);
    assertEquals(2, inputPorts.getPaging().getTotal());
  }

  @Test
  void test_assetCannotBeAddedToInputIfAlreadyOutputPort(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_port_excl_reverse"))
            .withDescription("Data product for reverse port exclusivity test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table = createTestTable(ns, "excl_rev_1", domain);

    // Add as output port (helper adds as data product asset first)
    bulkAddOutputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table.getEntityReference())));

    // Try adding same asset as input port — should fail with 400
    InvalidRequestException exception =
        assertThrows(
            InvalidRequestException.class,
            () ->
                SdkClients.adminClient()
                    .dataProducts()
                    .inputPorts(dataProduct.getFullyQualifiedName())
                    .add(new BulkAssets().withAssets(List.of(table.getEntityReference()))));
    BulkOperationResult result =
        JsonUtils.readValue(exception.getResponseBody(), BulkOperationResult.class);
    assertEquals(ApiStatus.FAILURE, result.getStatus());
    assertEquals(1, result.getNumberOfRowsFailed());
    assertEquals(0, result.getNumberOfRowsPassed());
    assertTrue(result.getFailedRequest().get(0).getMessage().contains("output ports"));
  }

  @Test
  void test_assetCanBeMovedBetweenPortsAfterRemoval(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_port_move"))
            .withDescription("Data product for port move test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table = createTestTable(ns, "move_1", domain);

    // Add as data product asset (required for output ports later)
    bulkAddAssets(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table.getEntityReference())));

    // Add as input port
    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table.getEntityReference())));

    // Remove from input ports
    SdkClients.adminClient()
        .dataProducts()
        .inputPorts(dataProduct.getFullyQualifiedName())
        .remove(new BulkAssets().withAssets(List.of(table.getEntityReference())));

    // Now adding as output port should succeed
    BulkOperationResult result =
        SdkClients.adminClient()
            .dataProducts()
            .outputPorts(dataProduct.getFullyQualifiedName())
            .add(new BulkAssets().withAssets(List.of(table.getEntityReference())));

    assertEquals(ApiStatus.SUCCESS, result.getStatus());
    assertEquals(1, result.getNumberOfRowsPassed());

    ResultList<Map<String, Object>> outputPorts = getOutputPorts(dataProduct.getId(), 10, 0);
    assertEquals(1, outputPorts.getPaging().getTotal());
    assertEquals(table.getId(), getEntityId(outputPorts.getData().get(0)));
  }

  @Test
  void test_outputPortRequiresAssetBelongsToDataProduct(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_output_asset_check"))
            .withDescription("Data product for output port asset validation")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table = createTestTable(ns, "not_dp_asset", domain);

    // Try adding as output port without being a data product asset — should fail with 400
    InvalidRequestException exception =
        assertThrows(
            InvalidRequestException.class,
            () ->
                SdkClients.adminClient()
                    .dataProducts()
                    .outputPorts(dataProduct.getFullyQualifiedName())
                    .add(new BulkAssets().withAssets(List.of(table.getEntityReference()))));
    BulkOperationResult result =
        JsonUtils.readValue(exception.getResponseBody(), BulkOperationResult.class);
    assertEquals(ApiStatus.FAILURE, result.getStatus());
    assertEquals(1, result.getNumberOfRowsFailed());
    assertEquals(0, result.getNumberOfRowsPassed());
    assertTrue(
        result.getFailedRequest().get(0).getMessage().contains("must belong to the data product"));
  }

  @Test
  void test_outputPortSucceedsAfterAddingAsDataProductAsset(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_output_after_asset"))
            .withDescription("Data product for output port after asset add")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table = createTestTable(ns, "will_be_asset", domain);

    // First fails — not a data product asset, returns 400
    InvalidRequestException failException =
        assertThrows(
            InvalidRequestException.class,
            () ->
                SdkClients.adminClient()
                    .dataProducts()
                    .outputPorts(dataProduct.getFullyQualifiedName())
                    .add(new BulkAssets().withAssets(List.of(table.getEntityReference()))));
    BulkOperationResult failResult =
        JsonUtils.readValue(failException.getResponseBody(), BulkOperationResult.class);
    assertEquals(ApiStatus.FAILURE, failResult.getStatus());

    // Add as data product asset
    bulkAddAssets(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table.getEntityReference())));

    // Now succeeds
    BulkOperationResult successResult =
        SdkClients.adminClient()
            .dataProducts()
            .outputPorts(dataProduct.getFullyQualifiedName())
            .add(new BulkAssets().withAssets(List.of(table.getEntityReference())));

    assertEquals(ApiStatus.SUCCESS, successResult.getStatus());
    assertEquals(1, successResult.getNumberOfRowsPassed());
  }

  @Test
  void test_inputPortDoesNotRequireDataProductAsset(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_input_no_asset_req"))
            .withDescription("Data product for input port no asset requirement")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table table = createTestTable(ns, "external_input", domain);

    // Input port should succeed without being a data product asset
    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(table.getEntityReference())));

    ResultList<Map<String, Object>> inputPorts = getInputPorts(dataProduct.getId(), 10, 0);
    assertEquals(1, inputPorts.getPaging().getTotal());
  }

  @Test
  void test_deletingAssetRemovesItFromPorts(TestNamespace ns) throws Exception {
    Domain domain = getOrCreateDomain(ns);

    CreateDataProduct create =
        new CreateDataProduct()
            .withName(ns.prefix("dp_delete_asset_port"))
            .withDescription("Data product for asset deletion port cleanup test")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DataProduct dataProduct = createEntity(create);

    Table inputTable = createTestTable(ns, "del_input", domain);
    Table outputTable = createTestTable(ns, "del_output", domain);
    Table survivingTable = createTestTable(ns, "del_surviving", domain);

    // Add input ports
    bulkAddInputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets()
            .withAssets(
                List.of(inputTable.getEntityReference(), survivingTable.getEntityReference())));

    // Add output port
    bulkAddOutputPorts(
        dataProduct.getFullyQualifiedName(),
        new BulkAssets().withAssets(List.of(outputTable.getEntityReference())));

    // Verify ports before deletion
    assertEquals(2, getInputPorts(dataProduct.getId(), 10, 0).getPaging().getTotal());
    assertEquals(1, getOutputPorts(dataProduct.getId(), 10, 0).getPaging().getTotal());

    // Hard delete the input table asset
    Map<String, String> hardDeleteParams = Map.of("hardDelete", "true");
    SdkClients.adminClient().tables().delete(inputTable.getId().toString(), hardDeleteParams);

    // Verify input port is cleaned up
    ResultList<Map<String, Object>> inputPorts = getInputPorts(dataProduct.getId(), 10, 0);
    assertEquals(1, inputPorts.getPaging().getTotal());
    assertEquals(survivingTable.getId(), getEntityId(inputPorts.getData().get(0)));

    // Hard delete the output table asset
    SdkClients.adminClient().tables().delete(outputTable.getId().toString(), hardDeleteParams);

    // Verify output port is cleaned up
    ResultList<Map<String, Object>> outputPorts = getOutputPorts(dataProduct.getId(), 10, 0);
    assertEquals(0, outputPorts.getPaging().getTotal());
  }
}
