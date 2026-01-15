/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Domain entity operations.
 *
 * <p>Extends BaseEntityIT to inherit all common entity tests. Adds domain-specific tests for
 * hierarchy, experts, domain types, and parent-child relationships.
 *
 * <p>Migrated from: org.openmetadata.service.resources.domains.DomainResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class DomainResourceIT extends BaseEntityIT<Domain, CreateDomain> {

  public DomainResourceIT() {
    supportsFollowers = false;
    supportsTags = false;
    supportsDomains = false;
    supportsDataProducts = false;
    supportsSoftDelete = false;
    supportsPatch = true;
    supportsOwners = true;
  }

  @Override
  protected CreateDomain createMinimalRequest(TestNamespace ns) {
    return new CreateDomain()
        .withName(ns.prefix("domain"))
        .withDomainType(DomainType.AGGREGATE)
        .withDescription("Test domain created by integration test");
  }

  @Override
  protected CreateDomain createRequest(String name, TestNamespace ns) {
    return new CreateDomain()
        .withName(name)
        .withDomainType(DomainType.AGGREGATE)
        .withDescription("Test domain");
  }

  @Override
  protected Domain createEntity(CreateDomain createRequest) {
    return SdkClients.adminClient().domains().create(createRequest);
  }

  @Override
  protected Domain getEntity(String id) {
    return SdkClients.adminClient().domains().get(id);
  }

  @Override
  protected Domain getEntityByName(String fqn) {
    return SdkClients.adminClient().domains().getByName(fqn);
  }

  @Override
  protected Domain patchEntity(String id, Domain entity) {
    return SdkClients.adminClient().domains().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().domains().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().domains().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    SdkClients.adminClient()
        .domains()
        .delete(id, java.util.Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "domain";
  }

  @Override
  protected void validateCreatedEntity(Domain entity, CreateDomain createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getDomainType(), entity.getDomainType());
    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected Domain getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().domains().get(id, fields);
  }

  @Override
  protected Domain getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().domains().getByName(fqn, fields);
  }

  @Override
  protected Domain getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().domains().get(id, null, "deleted");
  }

  @Override
  protected ListResponse<Domain> listEntities(ListParams params) {
    return SdkClients.adminClient().domains().list(params);
  }

  // ===================================================================
  // DOMAIN-SPECIFIC TESTS
  // ===================================================================

  @Test
  void test_createDomainWithDifferentTypes(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    DomainType[] types = {
      DomainType.AGGREGATE, DomainType.SOURCE_ALIGNED, DomainType.CONSUMER_ALIGNED
    };

    for (DomainType type : types) {
      CreateDomain create =
          new CreateDomain()
              .withName(ns.prefix("domain_" + type.value()))
              .withDomainType(type)
              .withDescription("Domain of type " + type.value());

      Domain domain = createEntity(create);
      assertEquals(type, domain.getDomainType());
    }
  }

  @Test
  void test_createSubDomain(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDomain createParent =
        new CreateDomain()
            .withName(ns.prefix("parentDomain"))
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Parent domain");

    Domain parent = createEntity(createParent);

    CreateDomain createChild =
        new CreateDomain()
            .withName(ns.prefix("subDomain"))
            .withDomainType(DomainType.SOURCE_ALIGNED)
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Sub domain");

    Domain child = createEntity(createChild);
    assertNotNull(child.getParent());
    assertEquals(parent.getId(), child.getParent().getId());
  }

  @Test
  void test_createDomainWithExperts(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String expertFqn = testUser1().getFullyQualifiedName();

    CreateDomain create =
        new CreateDomain()
            .withName(ns.prefix("expertDomain"))
            .withDomainType(DomainType.AGGREGATE)
            .withExperts(List.of(expertFqn))
            .withDescription("Domain with experts");

    Domain domain = createEntity(create);

    Domain fetched = client.domains().get(domain.getId().toString(), "experts");
    assertNotNull(fetched.getExperts());
    assertFalse(fetched.getExperts().isEmpty());
  }

  @Test
  void test_createDomainWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    EntityReference ownerRef = testUser1().getEntityReference();

    CreateDomain create =
        new CreateDomain()
            .withName(ns.prefix("ownedDomain"))
            .withDomainType(DomainType.AGGREGATE)
            .withOwners(List.of(ownerRef))
            .withDescription("Domain with owner");

    Domain domain = createEntity(create);

    Domain fetched = client.domains().get(domain.getId().toString(), "owners");
    assertNotNull(fetched.getOwners());
    assertFalse(fetched.getOwners().isEmpty());
  }

  @Test
  void test_updateDomainType(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDomain create =
        new CreateDomain()
            .withName(ns.prefix("updateTypeDomain"))
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Domain for type update");

    Domain domain = createEntity(create);
    assertEquals(DomainType.AGGREGATE, domain.getDomainType());

    domain.setDomainType(DomainType.SOURCE_ALIGNED);
    Domain updated = patchEntity(domain.getId().toString(), domain);

    assertEquals(DomainType.SOURCE_ALIGNED, updated.getDomainType());
  }

  @Test
  void test_updateDomainDescription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDomain create = createMinimalRequest(ns);
    Domain domain = createEntity(create);

    domain.setDescription("Updated domain description");
    Domain updated = patchEntity(domain.getId().toString(), domain);

    assertEquals("Updated domain description", updated.getDescription());
  }

  @Test
  void test_updateDomainDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDomain create = createMinimalRequest(ns);
    Domain domain = createEntity(create);

    domain.setDisplayName("My Updated Domain");
    Domain updated = patchEntity(domain.getId().toString(), domain);

    assertEquals("My Updated Domain", updated.getDisplayName());
  }

  @Test
  void test_addExpertsToDomain(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDomain create = createMinimalRequest(ns);
    Domain domain = createEntity(create);

    Domain fetched = client.domains().get(domain.getId().toString(), "experts");
    EntityReference expertRef = testUser1().getEntityReference();
    fetched.setExperts(List.of(expertRef));

    Domain updated = patchEntity(fetched.getId().toString(), fetched);

    Domain verify = client.domains().get(updated.getId().toString(), "experts");
    assertNotNull(verify.getExperts());
    assertTrue(verify.getExperts().stream().anyMatch(e -> e.getId().equals(expertRef.getId())));
  }

  @Test
  void test_hardDeleteDomain(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDomain create = createMinimalRequest(ns);
    Domain domain = createEntity(create);
    String domainId = domain.getId().toString();

    hardDeleteEntity(domainId);

    assertThrows(
        Exception.class, () -> getEntity(domainId), "Deleted domain should not be retrievable");
  }

  @Test
  void test_domainVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDomain create = createMinimalRequest(ns);
    Domain domain = createEntity(create);
    assertEquals(0.1, domain.getVersion(), 0.001);

    domain.setDescription("Updated description v1");
    Domain v2 = patchEntity(domain.getId().toString(), domain);
    assertEquals(0.2, v2.getVersion(), 0.001);

    var history = client.domains().getVersionList(domain.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void test_listDomains(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 3; i++) {
      CreateDomain create =
          new CreateDomain()
              .withName(ns.prefix("listDomain" + i))
              .withDomainType(DomainType.AGGREGATE)
              .withDescription("Domain for list test");
      createEntity(create);
    }

    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Domain> response = listEntities(params);

    assertNotNull(response);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void test_getDomainWithChildren(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDomain createParent =
        new CreateDomain()
            .withName(ns.prefix("parentForChildren"))
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Parent domain");

    Domain parent = createEntity(createParent);

    CreateDomain createChild1 =
        new CreateDomain()
            .withName(ns.prefix("child1"))
            .withDomainType(DomainType.SOURCE_ALIGNED)
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child domain 1");

    Domain child1 = createEntity(createChild1);

    CreateDomain createChild2 =
        new CreateDomain()
            .withName(ns.prefix("child2"))
            .withDomainType(DomainType.CONSUMER_ALIGNED)
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child domain 2");

    Domain child2 = createEntity(createChild2);

    Domain fetchedParent = client.domains().get(parent.getId().toString(), "children");
    assertNotNull(fetchedParent.getChildren());
    assertEquals(2, fetchedParent.getChildren().size());
  }

  @Test
  void test_deleteDomainWithChildren(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDomain createParent =
        new CreateDomain()
            .withName(ns.prefix("parentToDelete"))
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Parent domain to delete");

    Domain parent = createEntity(createParent);

    CreateDomain createChild =
        new CreateDomain()
            .withName(ns.prefix("childToDelete"))
            .withDomainType(DomainType.SOURCE_ALIGNED)
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child domain to delete");

    Domain child = createEntity(createChild);

    hardDeleteEntity(parent.getId().toString());

    String parentId = parent.getId().toString();
    assertThrows(Exception.class, () -> getEntity(parentId), "Parent domain should be deleted");

    String childId = child.getId().toString();
    assertThrows(
        Exception.class, () -> getEntity(childId), "Child domain should be cascade deleted");
  }

  // ===================================================================
  // VERSION HISTORY SUPPORT
  // ===================================================================

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().domains().getVersionList(id);
  }

  @Override
  protected Domain getVersion(UUID id, Double version) {
    return SdkClients.adminClient().domains().getVersion(id.toString(), version);
  }

  // ===================================================================
  // DOMAIN RENAME TESTS
  // Tests that verify domain rename works correctly including:
  // 1. Basic domain rename
  // 2. Domain rename with data products
  // 3. Domain rename with subdomains (cascading FQN updates)
  // 4. Rename + consolidation scenarios
  // ===================================================================

  @Test
  void test_renameDomain(TestNamespace ns) {
    // Use simple name for rename test (avoid regex metacharacters in REGEXP_REPLACE)
    String domainName = "domain_" + ns.shortPrefix();
    CreateDomain create =
        new CreateDomain()
            .withName(domainName)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Domain for rename test");
    Domain domain = createEntity(create);

    String oldName = domain.getName();
    String oldFqn = domain.getFullyQualifiedName();
    String newName = "renamed_" + oldName;

    domain.setName(newName);
    Domain renamed = patchEntity(domain.getId().toString(), domain);

    assertEquals(newName, renamed.getName());
    assertNotEquals(oldFqn, renamed.getFullyQualifiedName());

    // Verify we can get by new FQN
    Domain fetched = getEntityByName(renamed.getFullyQualifiedName());
    assertEquals(newName, fetched.getName());

    // Old FQN should not work
    assertThrows(Exception.class, () -> getEntityByName(oldFqn));
  }

  @Test
  void test_renameDomainWithDataProducts(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Use simple name for rename test
    String domainName = "domain_dp_" + ns.shortPrefix();
    CreateDomain create =
        new CreateDomain()
            .withName(domainName)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Domain for rename with data products test");
    Domain domain = createEntity(create);

    // Create a data product under this domain
    org.openmetadata.schema.api.domains.CreateDataProduct createDp =
        new org.openmetadata.schema.api.domains.CreateDataProduct()
            .withName("dp_under_" + domainName)
            .withDescription("Data product under domain")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    org.openmetadata.schema.entity.domains.DataProduct dataProduct =
        client.dataProducts().create(createDp);

    String oldDpFqn = dataProduct.getFullyQualifiedName();

    // Rename the domain
    String oldName = domain.getName();
    String newName = "renamed_dp_" + oldName;
    domain.setName(newName);
    Domain renamed = patchEntity(domain.getId().toString(), domain);
    assertEquals(newName, renamed.getName());

    // Data product should still be accessible after domain rename
    org.openmetadata.schema.entity.domains.DataProduct fetchedDp =
        client.dataProducts().get(dataProduct.getId().toString());
    assertNotNull(fetchedDp);
  }

  @Test
  void test_renameDomainWithSubdomains(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Use simple names to avoid REGEXP_REPLACE issues with special characters
    String parentName = "parent_" + ns.shortPrefix();
    CreateDomain createParent =
        new CreateDomain()
            .withName(parentName)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Parent domain for subdomain rename test");
    Domain parent = createEntity(createParent);

    // Create child subdomains
    String child1Name = "child1_" + parentName;
    CreateDomain createChild1 =
        new CreateDomain()
            .withName(child1Name)
            .withDomainType(DomainType.SOURCE_ALIGNED)
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child domain 1");
    Domain child1 = createEntity(createChild1);

    String child2Name = "child2_" + parentName;
    CreateDomain createChild2 =
        new CreateDomain()
            .withName(child2Name)
            .withDomainType(DomainType.CONSUMER_ALIGNED)
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child domain 2");
    Domain child2 = createEntity(createChild2);

    String oldChild1Fqn = child1.getFullyQualifiedName();
    String oldChild2Fqn = child2.getFullyQualifiedName();

    // Rename the parent domain
    String newParentName = "renamed_" + parentName;
    parent.setName(newParentName);
    Domain renamedParent = patchEntity(parent.getId().toString(), parent);

    assertEquals(newParentName, renamedParent.getName());
    assertEquals(newParentName, renamedParent.getFullyQualifiedName());

    // Verify child domains' FQNs are updated
    Domain updatedChild1 = getEntity(child1.getId().toString());
    Domain updatedChild2 = getEntity(child2.getId().toString());

    assertTrue(
        updatedChild1.getFullyQualifiedName().startsWith(newParentName + "."),
        "Child1 FQN should start with new parent name");
    assertTrue(
        updatedChild2.getFullyQualifiedName().startsWith(newParentName + "."),
        "Child2 FQN should start with new parent name");
    assertNotEquals(oldChild1Fqn, updatedChild1.getFullyQualifiedName());
    assertNotEquals(oldChild2Fqn, updatedChild2.getFullyQualifiedName());

    // Verify we can access children by their new FQNs
    Domain fetchedChild1 = getEntityByName(updatedChild1.getFullyQualifiedName());
    assertEquals(child1.getId(), fetchedChild1.getId());

    // Old FQNs should not work
    assertThrows(Exception.class, () -> getEntityByName(oldChild1Fqn));
    assertThrows(Exception.class, () -> getEntityByName(oldChild2Fqn));
  }

  @Test
  void test_renameDomainWithNestedSubdomains(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a 3-level hierarchy: grandparent -> parent -> child
    String gpName = "gp_" + ns.shortPrefix();
    CreateDomain createGp =
        new CreateDomain()
            .withName(gpName)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Grandparent domain");
    Domain grandparent = createEntity(createGp);

    String parentName = "parent_" + gpName;
    CreateDomain createParent =
        new CreateDomain()
            .withName(parentName)
            .withDomainType(DomainType.SOURCE_ALIGNED)
            .withParent(grandparent.getFullyQualifiedName())
            .withDescription("Parent domain");
    Domain parent = createEntity(createParent);

    String childName = "child_" + gpName;
    CreateDomain createChild =
        new CreateDomain()
            .withName(childName)
            .withDomainType(DomainType.CONSUMER_ALIGNED)
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child domain");
    Domain child = createEntity(createChild);

    String oldGpFqn = grandparent.getFullyQualifiedName();
    String oldParentFqn = parent.getFullyQualifiedName();
    String oldChildFqn = child.getFullyQualifiedName();

    // Rename the grandparent domain
    String newGpName = "renamed_" + gpName;
    grandparent.setName(newGpName);
    Domain renamedGp = patchEntity(grandparent.getId().toString(), grandparent);

    assertEquals(newGpName, renamedGp.getFullyQualifiedName());

    // Verify all levels' FQNs are updated
    Domain updatedParent = getEntity(parent.getId().toString());
    Domain updatedChild = getEntity(child.getId().toString());

    assertTrue(
        updatedParent.getFullyQualifiedName().startsWith(newGpName + "."),
        "Parent FQN should start with new grandparent name");
    assertTrue(
        updatedChild.getFullyQualifiedName().startsWith(newGpName + "."),
        "Child FQN should start with new grandparent name");

    // Old FQNs should not work
    assertThrows(Exception.class, () -> getEntityByName(oldGpFqn));
    assertThrows(Exception.class, () -> getEntityByName(oldParentFqn));
    assertThrows(Exception.class, () -> getEntityByName(oldChildFqn));
  }

  /**
   * Test that reproduces the consolidation bug when:
   * 1. Domain is renamed
   * 2. Another field (description) is updated within the same session
   *
   * The consolidation logic would revert to the previous version which has the OLD name/FQN,
   * potentially causing subdomain FQNs to become inconsistent.
   *
   * Fix: Skip consolidation when name has changed.
   */
  @Test
  void test_renameAndUpdateDescriptionConsolidation(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Use simple name for rename test
    String domainName = "domain_consolidate_" + ns.shortPrefix();
    CreateDomain create =
        new CreateDomain()
            .withName(domainName)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Initial description");
    Domain domain = createEntity(create);

    String oldName = domain.getName();
    String newName = "renamed_consolidate_" + oldName;

    // Rename the domain
    domain.setName(newName);
    Domain renamed = patchEntity(domain.getId().toString(), domain);
    assertEquals(newName, renamed.getName());

    // Update description within the same session (triggers consolidation)
    renamed.setDescription("Updated description after rename");
    Domain afterDescUpdate = patchEntity(renamed.getId().toString(), renamed);
    assertEquals("Updated description after rename", afterDescUpdate.getDescription());

    // Name should still be the new name after consolidation
    assertEquals(newName, afterDescUpdate.getName());
    assertTrue(
        afterDescUpdate.getFullyQualifiedName().equals(newName),
        "FQN should match new name after consolidation");

    // Verify we can still fetch by new FQN
    Domain fetched = getEntityByName(afterDescUpdate.getFullyQualifiedName());
    assertEquals(newName, fetched.getName());
  }

  /**
   * Test multiple renames followed by updates within the same session.
   * This is a more complex scenario that tests the robustness of the consolidation fix.
   */
  @Test
  void test_multipleRenamesWithUpdatesConsolidation(TestNamespace ns) {
    // Use simple name for rename test
    String domainName = "domain_multi_" + ns.shortPrefix();
    CreateDomain create =
        new CreateDomain()
            .withName(domainName)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Initial description");
    Domain domain = createEntity(create);

    String[] names = {"renamed_first", "renamed_second", "renamed_third"};

    for (int i = 0; i < names.length; i++) {
      String newName = names[i] + "_" + UUID.randomUUID().toString().substring(0, 8);

      domain.setName(newName);
      domain = patchEntity(domain.getId().toString(), domain);
      assertEquals(newName, domain.getName(), "Name should match after rename " + (i + 1));

      domain.setDescription("Description after rename " + (i + 1));
      domain = patchEntity(domain.getId().toString(), domain);
      assertEquals(
          newName, domain.getName(), "Name should still match after description update " + (i + 1));

      // Verify we can fetch by FQN
      Domain fetched = getEntityByName(domain.getFullyQualifiedName());
      assertEquals(newName, fetched.getName());
    }
  }

  @Test
  void test_renameDomainWithSamePrefixDataProduct(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String domainName = "analytics_" + ns.shortPrefix();
    CreateDomain createDomain =
        new CreateDomain()
            .withName(domainName)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Domain for testing rename with same prefix data product");
    Domain domain = createEntity(createDomain);

    String subdomainName = "marketing";
    CreateDomain createSubdomain =
        new CreateDomain()
            .withName(subdomainName)
            .withDomainType(DomainType.SOURCE_ALIGNED)
            .withParent(domain.getFullyQualifiedName())
            .withDescription("Subdomain under analytics");
    Domain subdomain = createEntity(createSubdomain);

    String dataProductName = "analytics_product_" + ns.shortPrefix();
    org.openmetadata.schema.api.domains.CreateDataProduct createDp =
        new org.openmetadata.schema.api.domains.CreateDataProduct()
            .withName(dataProductName)
            .withDescription("Data product with same prefix as domain")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    org.openmetadata.schema.entity.domains.DataProduct dataProduct =
        client.dataProducts().create(createDp);

    String oldDomainFqn = domain.getFullyQualifiedName();
    String oldSubdomainFqn = subdomain.getFullyQualifiedName();
    String oldDataProductFqn = dataProduct.getFullyQualifiedName();

    String newDomainName = "insights_" + ns.shortPrefix();
    domain.setName(newDomainName);
    Domain renamedDomain = patchEntity(domain.getId().toString(), domain);

    assertEquals(newDomainName, renamedDomain.getName());
    assertEquals(newDomainName, renamedDomain.getFullyQualifiedName());

    Domain fetchedSubdomain = getEntity(subdomain.getId().toString());
    String expectedSubdomainFqn = newDomainName + "." + subdomainName;
    assertEquals(expectedSubdomainFqn, fetchedSubdomain.getFullyQualifiedName());

    org.openmetadata.schema.entity.domains.DataProduct fetchedDataProduct =
        client.dataProducts().get(dataProduct.getId().toString());
    assertEquals(
        oldDataProductFqn,
        fetchedDataProduct.getFullyQualifiedName(),
        "Data product FQN should NOT change when domain is renamed");
  }
}
