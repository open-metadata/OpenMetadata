package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.bootstrap.SharedEntities.*;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.EntityRulesUtil;
import org.openmetadata.it.util.EntityValidation;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
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
  // DataProduct domains cannot be changed via PATCH after creation
  // DataProduct API doesn't expose include parameter for soft delete operations
  {
    supportsDataProducts = false;
    supportsPatchDomains = false;
    supportsSoftDelete = false;
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
    BulkOperationResult failResult =
        bulkAddAssetsWithResult(dataProduct.getName(), nonMatchingAssetsRequest);

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

    ResultList<EntityReference> assets = getAssets(dataProduct.getId(), 10, 0);
    assertEquals(1, assets.getPaging().getTotal(), "Should have 1 asset before rename");

    String oldName = dataProduct.getName();
    String newName = "renamed-" + oldName;

    dataProduct.setName(newName);
    DataProduct renamed = patchEntity(dataProduct.getId().toString(), dataProduct);
    assertEquals(newName, renamed.getName());

    assets = getAssets(renamed.getId(), 10, 0);
    assertEquals(1, assets.getPaging().getTotal(), "Should still have 1 asset after rename");
    assertEquals(table.getId(), assets.getData().get(0).getId());
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

    ResultList<EntityReference> assets = getAssets(dataProduct.getId(), 10, 0);
    assertEquals(1, assets.getPaging().getTotal(), "Should have 1 asset before rename");

    String oldName = dataProduct.getName();
    String newName = "renamed-" + oldName;
    dataProduct.setName(newName);
    DataProduct renamed = patchEntity(dataProduct.getId().toString(), dataProduct);
    assertEquals(newName, renamed.getName());

    assets = getAssets(renamed.getId(), 10, 0);
    assertEquals(1, assets.getPaging().getTotal(), "Should have 1 asset after rename");

    renamed.setDescription("Updated description after rename");
    DataProduct afterDescUpdate = patchEntity(renamed.getId().toString(), renamed);
    assertEquals("Updated description after rename", afterDescUpdate.getDescription());

    assets = getAssets(afterDescUpdate.getId(), 10, 0);
    assertEquals(
        1,
        assets.getPaging().getTotal(),
        "CRITICAL: Assets should still be present after rename + description update consolidation");
    assertEquals(
        table.getId(),
        assets.getData().get(0).getId(),
        "Asset should be the same table after consolidation");

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

    ResultList<EntityReference> assets = getAssets(dataProduct.getId(), 10, 0);
    assertEquals(1, assets.getPaging().getTotal());

    String[] names = {"renamed-first", "renamed-second", "renamed-third"};

    for (int i = 0; i < names.length; i++) {
      String newName = names[i] + "-" + UUID.randomUUID().toString().substring(0, 8);

      dataProduct.setName(newName);
      dataProduct = patchEntity(dataProduct.getId().toString(), dataProduct);
      assertEquals(newName, dataProduct.getName());

      assets = getAssets(dataProduct.getId(), 10, 0);
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
}
