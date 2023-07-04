package org.openmetadata.service.resources.domains;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertEntityReferenceNames;
import static org.openmetadata.service.util.TestUtils.assertListNull;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.domains.DataProductResource.DataProductList;
import org.openmetadata.service.util.JsonUtils;

public class DataProductResourceTest extends EntityResourceTest<DataProduct, CreateDataProduct> {
  public DataProductResourceTest() {
    super(Entity.DATA_PRODUCT, DataProduct.class, DataProductList.class, "dataProducts", DataProductResource.FIELDS);
    supportsFieldsQueryParam = false; // TODO
    supportsEmptyDescription = false;
  }

  public void setupDataProducts(TestInfo test) throws HttpResponseException {
    DOMAIN_DATA_PRODUCT = createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);
    SUB_DOMAIN_DATA_PRODUCT =
        createEntity(
            createRequest(getEntityName(test, 1)).withDomain(SUB_DOMAIN.getFullyQualifiedName()), ADMIN_AUTH_HEADERS);
  }

  @Override
  public CreateDataProduct createRequest(String name) {
    return new CreateDataProduct()
        .withName(name)
        .withDescription(name)
        .withDomain(DOMAIN.getFullyQualifiedName())
        .withExperts(listOf(USER1.getFullyQualifiedName()));
  }

  @Override
  public void validateCreatedEntity(
      DataProduct createdEntity, CreateDataProduct request, Map<String, String> authHeaders) {
    // Entity specific validation
    assertEquals(request.getDomain(), createdEntity.getDomain().getFullyQualifiedName());
    assertEntityReferenceNames(request.getExperts(), createdEntity.getExperts());
  }

  @Override
  public void compareEntities(DataProduct expected, DataProduct updated, Map<String, String> authHeaders) {
    // Entity specific validation
    assertReference(expected.getDomain(), updated.getDomain());
    assertEntityReferences(expected.getExperts(), updated.getExperts());
  }

  @Override
  public DataProduct validateGetWithDifferentFields(DataProduct dataProduct, boolean byName)
      throws HttpResponseException {
    DataProduct getDataProduct =
        byName
            ? getEntityByName(dataProduct.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(dataProduct.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNull(getDataProduct.getOwner(), getDataProduct.getExperts());
    String fields = "owner,domain,experts";
    getDataProduct =
        byName
            ? getEntityByName(getDataProduct.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(getDataProduct.getId(), fields, ADMIN_AUTH_HEADERS);
    // Fields requested are received
    assertReference(dataProduct.getDomain(), getDataProduct.getDomain());
    assertEntityReferences(dataProduct.getExperts(), getDataProduct.getExperts());

    // Checks for other owner, tags, and followers is done in the base class
    return getDataProduct;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.startsWith("domain")) {
      EntityReference expectedRef = (EntityReference) expected;
      EntityReference actualRef = JsonUtils.readValue(actual.toString(), EntityReference.class);
      assertEquals(expectedRef.getId(), actualRef.getId());
    } else if (fieldName.startsWith("experts")) {
      @SuppressWarnings("unchecked")
      List<EntityReference> expectedRefs = (List<EntityReference>) expected;
      List<EntityReference> actualRefs = JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertEntityReferences(expectedRefs, actualRefs);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
