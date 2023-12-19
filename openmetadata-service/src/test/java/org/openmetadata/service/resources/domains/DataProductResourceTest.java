package org.openmetadata.service.resources.domains;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.FIELD_ASSETS;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.TestUtils.*;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.REVERT;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.ws.rs.core.Response.Status;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.domains.DataProductResource.DataProductList;
import org.openmetadata.service.resources.topics.TopicResourceTest;
import org.openmetadata.service.util.JsonUtils;
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
    change = getChangeDescription(product, REVERT);
    product.withAssets(List.of(TEST_TABLE1.getEntityReference(), topic.getEntityReference()));
    product = patchEntityAndCheck(product, json, ADMIN_AUTH_HEADERS, REVERT, change);
    entityInDataProduct(topic, product, true); // topic is part of data product

    // Remove asset topic with PATCH
    // Changes from this PATCH is consolidated with the previous changes resulting in removal of
    // topic
    json = JsonUtils.pojoToJson(product);
    product.withAssets(List.of(TEST_TABLE1.getEntityReference()));
    change = getChangeDescription(product, REVERT);
    fieldDeleted(change, FIELD_ASSETS, listOf(topic.getEntityReference()));
    product = patchEntityAndCheck(product, json, ADMIN_AUTH_HEADERS, REVERT, change);
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
    change = getChangeDescription(product, REVERT);
    product.withExperts(List.of(USER1.getEntityReference(), USER2.getEntityReference()));
    product = patchEntityAndCheck(product, json, ADMIN_AUTH_HEADERS, REVERT, change);

    // Remove User2 as expert using PATCH
    // Changes from this PATCH is consolidated with the previous changes resulting in deletion of
    // USER2
    json = JsonUtils.pojoToJson(product);
    product.withExperts(List.of(USER1.getEntityReference()));
    change = getChangeDescription(product, REVERT);
    patchEntityAndCheck(product, json, ADMIN_AUTH_HEADERS, REVERT, change);
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

  private void entityInDataProduct(
      EntityInterface entity, EntityInterface product, boolean inDataProduct)
      throws HttpResponseException {
    // Only table or topic is expected to assets currently in the tests
    EntityResourceTest test =
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
    assertListNull(getDataProduct.getOwner(), getDataProduct.getExperts());
    String fields = "owner,domain,experts,assets";
    getDataProduct =
        byName
            ? getEntityByName(getDataProduct.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(getDataProduct.getId(), fields, ADMIN_AUTH_HEADERS);
    // Fields requested are received
    assertReference(dataProduct.getDomain(), getDataProduct.getDomain());
    assertEntityReferences(dataProduct.getExperts(), getDataProduct.getExperts());
    assertEntityReferences(dataProduct.getAssets(), getDataProduct.getAssets());

    // Checks for other owner, tags, and followers is done in the base class
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
