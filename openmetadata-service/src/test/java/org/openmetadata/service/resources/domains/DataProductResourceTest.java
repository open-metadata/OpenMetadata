package org.openmetadata.service.resources.domains;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.FIELD_ASSETS;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.TestUtils.*;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;

import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.domains.DataProductResource.DataProductList;
import org.openmetadata.service.resources.topics.TopicResourceTest;
import org.openmetadata.service.util.TestUtils;

public class DataProductResourceTest extends EntityResourceTest<DataProduct, CreateDataProduct> {
  public DataProductResourceTest() {
    super(
        Entity.DATA_PRODUCT,
        DataProduct.class,
        DataProductList.class,
        "dataProducts",
        DataProductResource.FIELDS);
  }

  public void setupDataProducts(TestInfo test) throws HttpResponseException {
    DOMAIN_DATA_PRODUCT = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);
    SUB_DOMAIN_DATA_PRODUCT =
        createEntity(
            createRequest(getEntityName(test, 1)).withDomain(SUB_DOMAIN.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
  }

  @Test
  void testDataProductAssets(TestInfo test) throws IOException {
    // Create Data product with Table1 as the asset
    CreateDataProduct create =
        createRequest(getEntityName(test)).withAssets(List.of(TEST_TABLE1.getEntityReference()));
    DataProduct product = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    entityInDataProduct(TEST_TABLE1, product, true); // Table1 is part of data product

    TopicResourceTest topicTest = new TopicResourceTest();
    Topic topic =
        topicTest.createEntity(topicTest.createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);

    // Version 0.2 - Add asset topic with PUT
    create.withAssets(List.of(TEST_TABLE1.getEntityReference(), topic.getEntityReference()));
    ChangeDescription change = getChangeDescription(product, MINOR_UPDATE);
    fieldAdded(change, FIELD_ASSETS, listOf(topic.getEntityReference()));
    product = updateAndCheckEntity(create, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    entityInDataProduct(topic, product, true); // topic is part of data product

    // Version 0.3 - Remove asset topic with PUT
    create.withAssets(List.of(TEST_TABLE1.getEntityReference()));
    change = getChangeDescription(product, MINOR_UPDATE);
    fieldDeleted(change, FIELD_ASSETS, listOf(topic.getEntityReference()));
    product = updateAndCheckEntity(create, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    entityInDataProduct(topic, product, false); // topic is not part of data product

    // Add topic asset with PATCH.
    // Version 0.2 - Changes from this PATCH is consolidated with the previous changes resulting in
    // no change
    String json = JsonUtils.pojoToJson(product);
    change = getChangeDescription(product, MINOR_UPDATE);
    fieldAdded(change, FIELD_ASSETS, listOf(topic.getEntityReference()));
    product.withAssets(List.of(TEST_TABLE1.getEntityReference(), topic.getEntityReference()));
    product = patchEntityAndCheck(product, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    entityInDataProduct(topic, product, true); // topic is part of data product

    // Remove asset topic with PATCH
    // Changes from this PATCH is consolidated with the previous changes resulting in removal of
    // topic
    json = JsonUtils.pojoToJson(product);
    product.withAssets(List.of(TEST_TABLE1.getEntityReference()));
    change = getChangeDescription(product, MINOR_UPDATE);
    fieldDeleted(change, FIELD_ASSETS, listOf(topic.getEntityReference()));
    product = patchEntityAndCheck(product, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    entityInDataProduct(topic, product, false); // topic is not part of data product
  }

  @Test
  void testDataProductAssetsPatchBug(TestInfo test) throws IOException {
    // Reproduce and fix the bug where only first and last assets are persisted when patching 4 assets
    
    // Create additional test tables for this test
    TableResourceTest tableTest = new TableResourceTest();
    org.openmetadata.schema.entity.data.Table table2 = 
        tableTest.createEntity(tableTest.createRequest(getEntityName(test, 2)), ADMIN_AUTH_HEADERS);
    org.openmetadata.schema.entity.data.Table table3 = 
        tableTest.createEntity(tableTest.createRequest(getEntityName(test, 3)), ADMIN_AUTH_HEADERS);
    org.openmetadata.schema.entity.data.Table table4 = 
        tableTest.createEntity(tableTest.createRequest(getEntityName(test, 4)), ADMIN_AUTH_HEADERS);
    
    // Create a data product with one asset initially
    CreateDataProduct create = createRequest(getEntityName(test))
        .withAssets(List.of(TEST_TABLE1.getEntityReference()));
    DataProduct product = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    
    // Patch to replace with 4 assets - this should preserve all assets after the fix
    String json = JsonUtils.pojoToJson(product);
    List<EntityReference> fourAssets = List.of(
        TEST_TABLE1.getEntityReference(),
        table2.getEntityReference(),
        table3.getEntityReference(),
        table4.getEntityReference()
    );
    product.withAssets(fourAssets);
    
    // Apply the patch operation
    ChangeDescription change = getChangeDescription(product, MINOR_UPDATE);
    fieldAdded(change, FIELD_ASSETS, listOf(table2.getEntityReference(), table3.getEntityReference(), table4.getEntityReference()));
    product = patchEntityAndCheck(product, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    
    // Verify all 4 assets are present (this should pass after the fix)
    assertEquals(4, product.getAssets().size(), "Expected 4 assets but got " + product.getAssets().size());
    
    // Verify each specific asset is present by checking their IDs
    List<UUID> assetIds = product.getAssets().stream()
        .map(EntityReference::getId)
        .collect(java.util.stream.Collectors.toList());
    assertTrue(assetIds.contains(TEST_TABLE1.getId()), "Missing TEST_TABLE1");
    assertTrue(assetIds.contains(table2.getId()), "Missing table2");
    assertTrue(assetIds.contains(table3.getId()), "Missing table3"); 
    assertTrue(assetIds.contains(table4.getId()), "Missing table4");
    
    // Verify that all assets show this data product in their dataProducts field
    entityInDataProduct(TEST_TABLE1, product, true);
    entityInDataProduct(table2, product, true);
    entityInDataProduct(table3, product, true);
    entityInDataProduct(table4, product, true);
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
    DataProduct p1 = createEntity(createRequest(test, 1).withDomain(domain1), ADMIN_AUTH_HEADERS);
    DataProduct p2 = createEntity(createRequest(test, 2).withDomain(domain1), ADMIN_AUTH_HEADERS);
    DataProduct p3 = createEntity(createRequest(test, 3).withDomain(domain2), ADMIN_AUTH_HEADERS);
    DataProduct p4 = createEntity(createRequest(test, 4).withDomain(domain2), ADMIN_AUTH_HEADERS);

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
            .withDomain(parentDomain.getFullyQualifiedName());
    DataProduct dataProduct = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    assertOwners(dataProduct.getOwners(), parentDomain.getOwners());
    assertEntityReferences(dataProduct.getExperts(), parentDomain.getExperts());

    // Create subdomain with no owners and experts
    CreateDomain subDomainReq =
        domainResourceTest
            .createRequestWithoutOwnersExperts(getEntityName(test, 2))
            .withDomain(parentDomain.getFullyQualifiedName());
    Domain subDomain = domainResourceTest.createEntity(subDomainReq, ADMIN_AUTH_HEADERS);
    subDomain = domainResourceTest.getEntity(subDomain.getId(), "*", ADMIN_AUTH_HEADERS);

    // Create data product corresponding to subdomain
    CreateDataProduct subDomainDataProductCreate =
        createRequestWithoutExpertsOwners(getEntityName(test, 2))
            .withDomain(subDomain.getFullyQualifiedName());
    DataProduct subDomainDataProduct =
        createAndCheckEntity(subDomainDataProductCreate, ADMIN_AUTH_HEADERS);

    // Subdomain and its data product should inherit owners and experts from parent domain
    assertOwners(subDomain.getOwners(), parentDomain.getOwners());
    assertEntityReferences(subDomain.getExperts(), parentDomain.getExperts());
    assertOwners(subDomainDataProduct.getOwners(), parentDomain.getOwners());
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
    assertOwners(subDomainDataProduct.getOwners(), subDomain.getOwners());
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
        .withDomain(DOMAIN.getFullyQualifiedName())
        .withStyle(new Style().withColor("#40E0D0").withIconURL("https://dataProductIcon"))
        .withExperts(listOf(USER1.getFullyQualifiedName()))
        .withAssets(TEST_TABLE1 != null ? listOf(TEST_TABLE1.getEntityReference()) : null);
  }

  public CreateDataProduct createRequestWithoutExpertsOwners(String name) {
    return new CreateDataProduct()
        .withName(name)
        .withDescription(name)
        .withDomain(DOMAIN.getFullyQualifiedName())
        .withStyle(new Style().withColor("#40E0D0").withIconURL("https://dataProductIcon"))
        .withAssets(TEST_TABLE1 != null ? listOf(TEST_TABLE1.getEntityReference()) : null);
  }

  @Override
  public void validateCreatedEntity(
      DataProduct createdEntity, CreateDataProduct request, Map<String, String> authHeaders) {
    // Entity specific validation
    assertEquals(request.getDomain(), createdEntity.getDomain().getFullyQualifiedName());
    assertEntityReferenceNames(request.getExperts(), createdEntity.getExperts());
    assertEntityReferences(request.getAssets(), createdEntity.getAssets());
    assertStyle(request.getStyle(), createdEntity.getStyle());
  }

  @Override
  public void compareEntities(
      DataProduct expected, DataProduct updated, Map<String, String> authHeaders) {
    // Entity specific validation
    assertReference(expected.getDomain(), updated.getDomain());
    assertEntityReferences(expected.getExperts(), updated.getExperts());
    assertEntityReferences(expected.getAssets(), updated.getAssets());
  }

  @Override
  public DataProduct validateGetWithDifferentFields(DataProduct dataProduct, boolean byName)
      throws HttpResponseException {
    DataProduct getDataProduct =
        byName
            ? getEntityByName(dataProduct.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(dataProduct.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(getDataProduct.getOwners(), getDataProduct.getExperts());
    String fields = "owners,domain,experts,assets,tags,followers";
    getDataProduct =
        byName
            ? getEntityByName(getDataProduct.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(getDataProduct.getId(), fields, ADMIN_AUTH_HEADERS);
    // Fields requested are received
    assertReference(dataProduct.getDomain(), getDataProduct.getDomain());
    assertEntityReferences(dataProduct.getExperts(), getDataProduct.getExperts());
    assertEntityReferences(dataProduct.getAssets(), getDataProduct.getAssets());

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
}
