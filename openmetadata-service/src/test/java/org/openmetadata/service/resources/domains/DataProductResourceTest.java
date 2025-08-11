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
        .withExperts(listOf(USER1.getFullyQualifiedName()))
        .withAssets(TEST_TABLE1 != null ? listOf(TEST_TABLE1.getEntityReference()) : null);
  }

  public CreateDataProduct createRequestWithoutExpertsOwners(String name) {
    return new CreateDataProduct()
        .withName(name)
        .withDescription(name)
        .withDomains(List.of(DOMAIN.getFullyQualifiedName()))
        .withStyle(new Style().withColor("#40E0D0").withIconURL("https://dataProductIcon"))
        .withAssets(TEST_TABLE1 != null ? listOf(TEST_TABLE1.getEntityReference()) : null);
  }

  @Override
  public void validateCreatedEntity(
      DataProduct createdEntity, CreateDataProduct request, Map<String, String> authHeaders) {
    // Entity specific validation
    assertEquals(
        request.getDomains().get(0), createdEntity.getDomains().get(0).getFullyQualifiedName());
    assertEntityReferenceNames(request.getExperts(), createdEntity.getExperts());
    assertEntityReferences(request.getAssets(), createdEntity.getAssets());
    assertStyle(request.getStyle(), createdEntity.getStyle());
  }

  @Override
  public void compareEntities(
      DataProduct expected, DataProduct updated, Map<String, String> authHeaders) {
    // Entity specific validation
    assertReference(expected.getDomains().get(0), updated.getDomains().get(0));
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
    String fields = "owners,domains,experts,assets,tags,followers";
    getDataProduct =
        byName
            ? getEntityByName(getDataProduct.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(getDataProduct.getId(), fields, ADMIN_AUTH_HEADERS);
    // Fields requested are received
    assertReference(dataProduct.getDomains().get(0), getDataProduct.getDomains().get(0));
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
