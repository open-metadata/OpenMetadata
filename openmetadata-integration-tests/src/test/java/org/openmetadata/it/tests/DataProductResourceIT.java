package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

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
  protected CreateDataProduct createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    Domain domain = getOrCreateDomain(ns, client);

    return new CreateDataProduct()
        .withName(ns.prefix("dataproduct"))
        .withDescription("Test data product created by integration test")
        .withDomains(List.of(domain.getFullyQualifiedName()));
  }

  @Override
  protected CreateDataProduct createRequest(
      String name, TestNamespace ns, OpenMetadataClient client) {
    Domain domain = getOrCreateDomain(ns, client);

    return new CreateDataProduct()
        .withName(name)
        .withDescription("Test data product")
        .withDomains(List.of(domain.getFullyQualifiedName()));
  }

  private Domain getOrCreateDomain(TestNamespace ns, OpenMetadataClient client) {
    String domainName = ns.prefix("domain");
    try {
      return client.domains().getByName(domainName);
    } catch (Exception e) {
      CreateDomain createDomain =
          new CreateDomain()
              .withName(domainName)
              .withDescription("Test domain for data products")
              .withDomainType(DomainType.AGGREGATE);
      return client.domains().create(createDomain);
    }
  }

  @Override
  protected DataProduct createEntity(CreateDataProduct createRequest, OpenMetadataClient client) {
    return client.dataProducts().create(createRequest);
  }

  @Override
  protected DataProduct getEntity(String id, OpenMetadataClient client) {
    return client.dataProducts().get(id);
  }

  @Override
  protected DataProduct getEntityByName(String fqn, OpenMetadataClient client) {
    return client.dataProducts().getByName(fqn);
  }

  @Override
  protected DataProduct patchEntity(String id, DataProduct entity, OpenMetadataClient client) {
    return client.dataProducts().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.dataProducts().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.dataProducts().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.dataProducts().delete(id, params);
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
  protected ListResponse<DataProduct> listEntities(ListParams params, OpenMetadataClient client) {
    return client.dataProducts().list(params);
  }

  @Override
  protected DataProduct getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.dataProducts().get(id, fields);
  }

  @Override
  protected DataProduct getEntityByNameWithFields(
      String fqn, String fields, OpenMetadataClient client) {
    return client.dataProducts().getByName(fqn, fields);
  }

  @Override
  protected DataProduct getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.dataProducts().get(id, "domains,owners,experts,assets,tags,followers", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.dataProducts().getVersionList(id);
  }

  @Override
  protected DataProduct getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.dataProducts().getVersion(id.toString(), version);
  }

  // ===================================================================
  // DATA PRODUCT-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_dataProductWithStyle_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain = getOrCreateDomain(ns, client);

    CreateDataProduct request =
        new CreateDataProduct()
            .withName(ns.prefix("dp_style"))
            .withDescription("Data product with style")
            .withDomains(List.of(domain.getFullyQualifiedName()))
            .withStyle(new Style().withColor("#40E0D0").withIconURL("https://icon.example.com"));

    DataProduct dataProduct = createEntity(request, client);
    assertNotNull(dataProduct);
    assertNotNull(dataProduct.getStyle());
    assertEquals("#40E0D0", dataProduct.getStyle().getColor());
  }

  @Test
  void put_dataProductDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain = getOrCreateDomain(ns, client);

    CreateDataProduct request =
        new CreateDataProduct()
            .withName(ns.prefix("dp_update_desc"))
            .withDescription("Initial description")
            .withDomains(List.of(domain.getFullyQualifiedName()));

    DataProduct dataProduct = createEntity(request, client);
    assertEquals("Initial description", dataProduct.getDescription());

    // Update description
    dataProduct.setDescription("Updated description");
    DataProduct updated = patchEntity(dataProduct.getId().toString(), dataProduct, client);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_dataProductNameUniquenessWithinDomain(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Domain domain = getOrCreateDomain(ns, client);

    // Create first data product
    String dpName = ns.prefix("unique_dp");
    CreateDataProduct request1 =
        new CreateDataProduct()
            .withName(dpName)
            .withDescription("First data product")
            .withDomains(List.of(domain.getFullyQualifiedName()));

    DataProduct dp1 = createEntity(request1, client);
    assertNotNull(dp1);

    // Attempt to create duplicate within same domain
    CreateDataProduct request2 =
        new CreateDataProduct()
            .withName(dpName)
            .withDescription("Duplicate data product")
            .withDomains(List.of(domain.getFullyQualifiedName()));

    assertThrows(
        Exception.class,
        () -> createEntity(request2, client),
        "Creating duplicate data product in same domain should fail");
  }
}
