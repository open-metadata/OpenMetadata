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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for Domain entity operations.
 *
 * <p>
 * Extends BaseEntityIT to inherit all common entity tests. Adds domain-specific
 * tests for
 * hierarchy, experts, domain types, and parent-child relationships.
 *
 * <p>
 * Migrated from: org.openmetadata.service.resources.domains.DomainResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class DomainResourceIT extends BaseEntityIT<Domain, CreateDomain> {

  public DomainResourceIT() {
    supportsFollowers = false;
    supportsTags = true;
    supportsDomains = false;
    supportsDataProducts = false;
    supportsSoftDelete = false;
    supportsPatch = true;
    supportsOwners = true;
    supportsListHistoryByTimestamp = true;
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
  void test_subDomainInheritsOwnersExpertsAndChildrenCount(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    EntityReference ownerRef = testUser1().getEntityReference();
    String expertFqn = testUser2().getFullyQualifiedName();

    Domain parent =
        createEntity(
            new CreateDomain()
                .withName(ns.prefix("inheritParent"))
                .withDomainType(DomainType.AGGREGATE)
                .withOwners(List.of(ownerRef))
                .withExperts(List.of(expertFqn))
                .withDescription("Parent with owner and expert"));

    Domain child =
        createEntity(
            new CreateDomain()
                .withName(ns.prefix("inheritChild"))
                .withDomainType(DomainType.SOURCE_ALIGNED)
                .withParent(parent.getFullyQualifiedName())
                .withDescription("Subdomain with no owner or expert"));

    Domain grandChild =
        createEntity(
            new CreateDomain()
                .withName(ns.prefix("inheritGrandChild"))
                .withDomainType(DomainType.SOURCE_ALIGNED)
                .withParent(child.getFullyQualifiedName())
                .withDescription("Grand subdomain"));

    Domain fetchedChild = client.domains().get(child.getId().toString(), "owners,experts");
    assertFalse(fetchedChild.getOwners().isEmpty(), "subdomain must inherit owner from parent");
    assertEquals(ownerRef.getId(), fetchedChild.getOwners().get(0).getId());
    assertFalse(fetchedChild.getExperts().isEmpty(), "subdomain must inherit experts from parent");

    Domain fetchedGrandChild =
        client.domains().get(grandChild.getId().toString(), "owners,experts");
    assertFalse(
        fetchedGrandChild.getOwners().isEmpty(),
        "depth-2 subdomain must inherit owner from ancestor");

    Domain parentWithCount = client.domains().get(parent.getId().toString(), "childrenCount");
    assertEquals(2, parentWithCount.getChildrenCount().intValue());
    Domain childWithCount = client.domains().get(child.getId().toString(), "childrenCount");
    assertEquals(1, childWithCount.getChildrenCount().intValue());

    ListParams params =
        new ListParams().setFields("owners,experts,childrenCount").withLimit(1000000);
    Domain listedChild =
        listEntities(params).getData().stream()
            .filter(domain -> child.getId().equals(domain.getId()))
            .findFirst()
            .orElseThrow();
    assertFalse(listedChild.getOwners().isEmpty(), "bulk list must inherit owner on subdomain");
    assertEquals(1, listedChild.getChildrenCount().intValue());
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
  // SEARCH VERIFICATION HELPER METHODS
  // ===================================================================

  /**
   * Verify domain exists in search index with the expected FQN.
   * Queries by domain ID to avoid complex FQN queries that can exceed
   * Elasticsearch clause limits.
   */
  private void verifyDomainInSearch(String expectedFqn, String domainId) {
    OpenMetadataClient client = SdkClients.adminClient();

    Awaitility.await("Domain " + domainId + " should appear in search with FQN " + expectedFqn)
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              String searchResponse =
                  client
                      .search()
                      .query("id:" + domainId)
                      .index("domain_search_index")
                      .size(1)
                      .execute();

              assertTrue(
                  searchResponse.contains("\"id\":\"" + domainId + "\""),
                  "Search index should contain domain with ID: " + domainId);
              assertTrue(
                  searchResponse.contains("\"fullyQualifiedName\":\"" + expectedFqn + "\""),
                  "Search index should contain domain with FQN: " + expectedFqn);
            });
  }

  /**
   * Verify domain does NOT exist in search index with the given FQN.
   * Searches by partial FQN match to verify old FQN is not in the index.
   */
  private void verifyDomainNotInSearch(String fqn) {
    OpenMetadataClient client = SdkClients.adminClient();

    String domainName = fqn.contains(".") ? fqn.substring(fqn.lastIndexOf(".") + 1) : fqn;

    Awaitility.await("Old FQN " + fqn + " should disappear from search")
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              String searchResponse =
                  client
                      .search()
                      .query("name:" + domainName)
                      .index("domain_search_index")
                      .size(10)
                      .execute();

              assertFalse(
                  searchResponse.contains("\"fullyQualifiedName\":\"" + fqn + "\""),
                  "Search index should NOT contain domain with old FQN: " + fqn);
            });
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
    // Use simple name for rename test (avoid regex metacharacters in
    // REGEXP_REPLACE)
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

    // Verify child domains' FQNs are updated. Descendant FQN rewrite runs after the parent
    // PATCH commits, so poll until both children reflect the new parent prefix.
    Awaitility.await("Child domain FQNs must propagate after parent rename")
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              Domain probe1 = getEntity(child1.getId().toString());
              Domain probe2 = getEntity(child2.getId().toString());
              assertTrue(probe1.getFullyQualifiedName().startsWith(newParentName + "."));
              assertTrue(probe2.getFullyQualifiedName().startsWith(newParentName + "."));
            });
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

    // Verify all levels' FQNs are updated. Descendant FQN rewrite runs after the
    // grandparent PATCH commits, so poll until both descendants reflect the new prefix.
    Awaitility.await("Descendant domain FQNs must propagate after grandparent rename")
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              Domain probeParent = getEntity(parent.getId().toString());
              Domain probeChild = getEntity(child.getId().toString());
              assertTrue(probeParent.getFullyQualifiedName().startsWith(newGpName + "."));
              assertTrue(probeChild.getFullyQualifiedName().startsWith(newGpName + "."));
            });
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
   * The consolidation logic would revert to the previous version which has the
   * OLD name/FQN,
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
   * This is a more complex scenario that tests the robustness of the
   * consolidation fix.
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

    // Subdomain FQN rewrite runs after the parent PATCH commits, so poll for it.
    String expectedSubdomainFqn = newDomainName + "." + subdomainName;
    Awaitility.await("Subdomain FQN must propagate after parent rename")
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              Domain probe = getEntity(subdomain.getId().toString());
              assertEquals(expectedSubdomainFqn, probe.getFullyQualifiedName());
            });
    Domain fetchedSubdomain = getEntity(subdomain.getId().toString());
    assertEquals(expectedSubdomainFqn, fetchedSubdomain.getFullyQualifiedName());

    org.openmetadata.schema.entity.domains.DataProduct fetchedDataProduct =
        client.dataProducts().get(dataProduct.getId().toString());
    assertEquals(
        oldDataProductFqn,
        fetchedDataProduct.getFullyQualifiedName(),
        "Data product FQN should NOT change when domain is renamed");
  }

  @Test
  void test_renameDomainDoesNotMatchSimilarNames(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String analyticsName = "analytics_" + ns.shortPrefix();
    CreateDomain createAnalytics =
        new CreateDomain()
            .withName(analyticsName)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Analytics domain");
    Domain analytics = createEntity(createAnalytics);

    String analyticsV2Name = "anav2" + ns.shortPrefix();
    CreateDomain createAnalyticsV2 =
        new CreateDomain()
            .withName(analyticsV2Name)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Analytics V2 - unrelated domain with similar prefix");
    Domain analyticsV2 = createEntity(createAnalyticsV2);

    String childName = "subdomain";
    CreateDomain createChild =
        new CreateDomain()
            .withName(childName)
            .withDomainType(DomainType.SOURCE_ALIGNED)
            .withParent(analytics.getFullyQualifiedName())
            .withDescription("Child of analytics domain");
    Domain child = createEntity(createChild);

    String analyticsV2OldFqn = analyticsV2.getFullyQualifiedName();
    String childOldFqn = child.getFullyQualifiedName();

    Awaitility.await("Wait for initial indexing of child domain")
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              String searchResponse =
                  client
                      .search()
                      .query("id:" + child.getId())
                      .index("domain_search_index")
                      .size(1)
                      .execute();
              return searchResponse.contains("\"id\":\"" + child.getId() + "\"");
            });

    String newAnalyticsName = "insights_" + ns.shortPrefix();
    analytics.setName(newAnalyticsName);
    Domain renamedAnalytics = patchEntity(analytics.getId().toString(), analytics);

    assertEquals(newAnalyticsName, renamedAnalytics.getName());
    assertEquals(newAnalyticsName, renamedAnalytics.getFullyQualifiedName());

    // Verify database entities are correct. Descendant FQN rewrite runs after the
    // parent PATCH commits, so poll until the child reflects the new prefix.
    String expectedChildFqn = newAnalyticsName + "." + childName;
    Awaitility.await("Child domain FQN must propagate after parent rename")
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              Domain probe = getEntity(child.getId().toString());
              assertEquals(expectedChildFqn, probe.getFullyQualifiedName());
            });
    Domain updatedChild = getEntity(child.getId().toString());
    assertEquals(
        expectedChildFqn,
        updatedChild.getFullyQualifiedName(),
        "Child domain FQN should be updated to reflect parent rename");
    assertNotEquals(childOldFqn, updatedChild.getFullyQualifiedName());

    Domain unchangedV2 = getEntity(analyticsV2.getId().toString());
    assertEquals(
        analyticsV2OldFqn,
        unchangedV2.getFullyQualifiedName(),
        "Unrelated domain with similar prefix should NOT be updated - this verifies the fix for prefix matching bug");
    assertEquals(
        analyticsV2Name, unchangedV2.getName(), "Unrelated domain name should remain unchanged");

    // === SEARCH VERIFICATION ===
    // Verify renamed domain can be found by new FQN in search
    verifyDomainInSearch(newAnalyticsName, analytics.getId().toString());

    // Verify child domain can be found by new FQN in search
    verifyDomainInSearch(expectedChildFqn, child.getId().toString());

    // Verify analytics_v2 can still be found by its ORIGINAL FQN
    // This proves the bug fix works - without it, this would fail!
    verifyDomainInSearch(analyticsV2OldFqn, analyticsV2.getId().toString());

    // Verify old FQNs no longer work
    verifyDomainNotInSearch(analyticsName);
    verifyDomainNotInSearch(childOldFqn);
  }

  @Test
  void test_renameDomainWithTagsAndGlossaryTerms(TestNamespace ns) {
    String domainName = "data_domain_" + ns.shortPrefix();
    CreateDomain createDomain =
        new CreateDomain()
            .withName(domainName)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Domain for testing tags and glossary terms on rename");
    Domain domain = createEntity(createDomain);

    domain.setTags(List.of(piiSensitiveTagLabel(), personalDataTagLabel()));
    domain = patchEntity(domain.getId().toString(), domain);

    String subdomainName = "customer_data";
    CreateDomain createSubdomain =
        new CreateDomain()
            .withName(subdomainName)
            .withDomainType(DomainType.SOURCE_ALIGNED)
            .withParent(domain.getFullyQualifiedName())
            .withDescription("Subdomain with tags");
    Domain subdomain = createEntity(createSubdomain);

    subdomain.setTags(List.of(glossaryTermLabel()));
    subdomain = patchEntity(subdomain.getId().toString(), subdomain);

    String oldDomainFqn = domain.getFullyQualifiedName();
    String oldSubdomainFqn = subdomain.getFullyQualifiedName();

    Domain domainWithTags = getEntityWithFields(domain.getId().toString(), "tags");
    assertEquals(2, domainWithTags.getTags().size(), "Domain should have 2 tags before rename");

    Domain subdomainWithTags = getEntityWithFields(subdomain.getId().toString(), "tags");
    assertEquals(
        1, subdomainWithTags.getTags().size(), "Subdomain should have 1 tag before rename");

    String newDomainName = "analytics_domain_" + ns.shortPrefix();
    domain.setName(newDomainName);
    Domain renamedDomain = patchEntity(domain.getId().toString(), domain);

    assertEquals(newDomainName, renamedDomain.getName());
    assertEquals(newDomainName, renamedDomain.getFullyQualifiedName());

    Domain fetchedDomainAfterRename = getEntityWithFields(domain.getId().toString(), "tags");
    assertNotNull(
        fetchedDomainAfterRename.getTags(), "Domain tags should not be null after rename");
    assertEquals(
        2,
        fetchedDomainAfterRename.getTags().size(),
        "Domain should still have 2 tags after rename");
    assertTrue(
        fetchedDomainAfterRename.getTags().stream()
            .anyMatch(tag -> tag.getTagFQN().equals(piiSensitiveTagLabel().getTagFQN())),
        "Domain should still have PII.Sensitive tag after rename");
    assertTrue(
        fetchedDomainAfterRename.getTags().stream()
            .anyMatch(tag -> tag.getTagFQN().equals(personalDataTagLabel().getTagFQN())),
        "Domain should still have PersonalData.Personal tag after rename");

    // Subdomain FQN rewrite runs after the parent PATCH commits; poll for it, then
    // re-fetch with tags for the downstream tag assertions.
    String expectedSubdomainFqn = newDomainName + "." + subdomainName;
    String subdomainId = subdomain.getId().toString();
    Awaitility.await("Subdomain FQN must propagate after parent rename")
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              Domain probe = getEntity(subdomainId);
              assertEquals(expectedSubdomainFqn, probe.getFullyQualifiedName());
            });
    Domain fetchedSubdomainAfterRename = getEntityWithFields(subdomainId, "tags");
    assertEquals(expectedSubdomainFqn, fetchedSubdomainAfterRename.getFullyQualifiedName());
    assertNotNull(
        fetchedSubdomainAfterRename.getTags(), "Subdomain tags should not be null after rename");
    assertEquals(
        1,
        fetchedSubdomainAfterRename.getTags().size(),
        "Subdomain should still have 1 tag after rename");
    assertTrue(
        fetchedSubdomainAfterRename.getTags().stream()
            .anyMatch(tag -> tag.getTagFQN().equals(glossaryTermLabel().getTagFQN())),
        "Subdomain should still have glossary term tag after rename");
  }

  /**
   * Test that verifies the fix for the prefix matching bug where renaming a
   * domain
   * would incorrectly update unrelated domains with similar FQN prefixes.
   *
   * Bug scenario:
   * - Renaming domain "analytics" to "insights"
   * - Domain "analytics_v2" would incorrectly be matched because
   * "analytics_v2".startsWith("analytics")
   * - Result: "analytics_v2" would incorrectly become "insights_v2"
   *
   * This test verifies that:
   * 1. Renaming "analytics" to "insights" does NOT affect "analytics_v2"
   * 2. Renaming "analytics" to "insights" DOES correctly update child domain
   * "analytics.child" to "insights.child"
   * 3. Both database AND search index are correctly updated
   */
  @Test
  void test_renameDomainDoesNotAffectSimilarPrefixDomains(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create parent domain "analytics"
    String analyticsName = "analytics_" + ns.shortPrefix();
    CreateDomain createAnalytics =
        new CreateDomain()
            .withName(analyticsName)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Analytics domain for prefix bug test");
    Domain analytics = createEntity(createAnalytics);

    // Create a sibling domain with similar prefix "analytics_v2"
    String analyticsV2Name = analyticsName + "v2";
    CreateDomain createAnalyticsV2 =
        new CreateDomain()
            .withName(analyticsV2Name)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Analytics V2 domain - should NOT be affected by analytics rename");
    Domain analyticsV2 = createEntity(createAnalyticsV2);

    // Create another sibling with similar prefix "analytics_prod"
    String analyticsProdName = analyticsName + "pr";
    CreateDomain createAnalyticsProd =
        new CreateDomain()
            .withName(analyticsProdName)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Analytics Prod domain - should NOT be affected");
    Domain analyticsProd = createEntity(createAnalyticsProd);

    // Create a child domain under "analytics" - this SHOULD be updated
    String childName = "marketing";
    CreateDomain createChild =
        new CreateDomain()
            .withName(childName)
            .withDomainType(DomainType.SOURCE_ALIGNED)
            .withParent(analytics.getFullyQualifiedName())
            .withDescription("Child domain under analytics - SHOULD be updated");
    Domain child = createEntity(createChild);

    String oldAnalyticsFqn = analytics.getFullyQualifiedName();
    String oldAnalyticsV2Fqn = analyticsV2.getFullyQualifiedName();
    String oldAnalyticsProdFqn = analyticsProd.getFullyQualifiedName();
    String oldChildFqn = child.getFullyQualifiedName();

    Awaitility.await("Wait for initial indexing of child domain")
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              String searchResponse =
                  client
                      .search()
                      .query("id:" + child.getId())
                      .index("domain_search_index")
                      .size(1)
                      .execute();
              return searchResponse.contains("\"id\":\"" + child.getId() + "\"");
            });

    // Rename "analytics" to "insights"
    String newAnalyticsName = "insights_" + ns.shortPrefix();
    analytics.setName(newAnalyticsName);
    Domain renamedAnalytics = patchEntity(analytics.getId().toString(), analytics);

    assertEquals(newAnalyticsName, renamedAnalytics.getName());
    assertEquals(newAnalyticsName, renamedAnalytics.getFullyQualifiedName());

    // === DATABASE VERIFICATION ===
    // Verify "analytics_v2" FQN is UNCHANGED (bug fix verification)
    Domain fetchedAnalyticsV2 = getEntity(analyticsV2.getId().toString());
    assertEquals(
        oldAnalyticsV2Fqn,
        fetchedAnalyticsV2.getFullyQualifiedName(),
        "analytics_v2 FQN should NOT change when analytics is renamed");
    assertEquals(
        analyticsV2Name, fetchedAnalyticsV2.getName(), "analytics_v2 name should NOT change");

    // Verify "analytics_prod" FQN is UNCHANGED (bug fix verification)
    Domain fetchedAnalyticsProd = getEntity(analyticsProd.getId().toString());
    assertEquals(
        oldAnalyticsProdFqn,
        fetchedAnalyticsProd.getFullyQualifiedName(),
        "analytics_prod FQN should NOT change when analytics is renamed");
    assertEquals(
        analyticsProdName, fetchedAnalyticsProd.getName(), "analytics_prod name should NOT change");

    // Verify child domain FQN IS updated correctly
    Domain fetchedChild = getEntity(child.getId().toString());
    String expectedChildFqn = newAnalyticsName + "." + childName;
    assertEquals(
        expectedChildFqn,
        fetchedChild.getFullyQualifiedName(),
        "Child domain FQN should be updated to insights.marketing");
    assertEquals(childName, fetchedChild.getName(), "Child domain name should remain unchanged");

    // === SEARCH VERIFICATION ===

    // Verify renamed domain can be found by new FQN
    verifyDomainInSearch(newAnalyticsName, analytics.getId().toString());

    // Verify analytics_v2 can still be found by its ORIGINAL FQN
    verifyDomainInSearch(oldAnalyticsV2Fqn, analyticsV2.getId().toString());

    // Verify analytics_prod can still be found by its ORIGINAL FQN
    verifyDomainInSearch(oldAnalyticsProdFqn, analyticsProd.getId().toString());

    // Verify child domain can be found by new FQN
    verifyDomainInSearch(expectedChildFqn, child.getId().toString());

    // Verify old FQNs no longer work
    verifyDomainNotInSearch(oldAnalyticsFqn);
    verifyDomainNotInSearch(oldChildFqn);

    // Verify we can still access all domains by their correct FQNs
    Domain verifyAnalytics = getEntityByName(newAnalyticsName);
    assertEquals(analytics.getId(), verifyAnalytics.getId());

    Domain verifyAnalyticsV2 = getEntityByName(oldAnalyticsV2Fqn);
    assertEquals(analyticsV2.getId(), verifyAnalyticsV2.getId());

    Domain verifyAnalyticsProd = getEntityByName(oldAnalyticsProdFqn);
    assertEquals(analyticsProd.getId(), verifyAnalyticsProd.getId());

    Domain verifyChild = getEntityByName(expectedChildFqn);
    assertEquals(child.getId(), verifyChild.getId());

    // Verify old analytics FQN no longer works
    assertThrows(Exception.class, () -> getEntityByName(oldAnalyticsFqn));

    // Verify old child FQN no longer works
    assertThrows(Exception.class, () -> getEntityByName(oldChildFqn));
  }

  @Test
  void softDeletedExpert_notReturnedInSingleGet(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String userName = ns.shortPrefix("domain_expert");
    User expert =
        client
            .users()
            .create(
                new CreateUser()
                    .withName(userName)
                    .withEmail(userName + "@test.openmetadata.org")
                    .withDescription("Expert user for domain soft-delete test"));

    CreateDomain create =
        new CreateDomain()
            .withName(ns.prefix("domain_softdel"))
            .withDomainType(DomainType.AGGREGATE)
            .withExperts(List.of(expert.getFullyQualifiedName()))
            .withDescription("Domain for soft-delete expert test");
    Domain domain = createEntity(create);

    client.users().delete(expert.getId().toString());

    Domain byId = client.domains().get(domain.getId().toString(), "experts");
    assertTrue(
        byId.getExperts() == null || byId.getExperts().isEmpty(),
        "Soft-deleted expert must not appear in single GET by ID");

    Domain byName = client.domains().getByName(domain.getFullyQualifiedName(), "experts");
    assertTrue(
        byName.getExperts() == null || byName.getExperts().isEmpty(),
        "Soft-deleted expert must not appear in single GET by name");
  }

  @Test
  void softDeletedExpert_notReturnedInListEndpoint(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String userName = ns.shortPrefix("domain_expert_list");
    User expert =
        client
            .users()
            .create(
                new CreateUser()
                    .withName(userName)
                    .withEmail(userName + "@test.openmetadata.org")
                    .withDescription("Expert user for domain list soft-delete test"));

    CreateDomain create =
        new CreateDomain()
            .withName(ns.prefix("domain_softdel_list"))
            .withDomainType(DomainType.AGGREGATE)
            .withExperts(List.of(expert.getFullyQualifiedName()))
            .withDescription("Domain for soft-delete expert list test");
    Domain domain = createEntity(create);

    client.users().delete(expert.getId().toString());

    Domain listed = null;
    ListParams params = new ListParams().setFields("experts").withLimit(100);
    while (listed == null) {
      ListResponse<Domain> page = listEntities(params);
      listed =
          page.getData().stream()
              .filter(d -> d.getId().equals(domain.getId()))
              .findFirst()
              .orElse(null);
      String after = page.getPaging() != null ? page.getPaging().getAfter() : null;
      if (listed != null || after == null) break;
      params = new ListParams().setFields("experts").withLimit(100).setAfter(after);
    }
    assertNotNull(listed, "Domain not found in list");
    assertTrue(
        listed.getExperts() == null || listed.getExperts().isEmpty(),
        "Soft-deleted expert must not appear in list endpoint");
  }

  @Test
  void softDeletedExpert_notReturnedInListWithIncludeAll(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String userName = ns.shortPrefix("domain_expert_all");
    User expert =
        client
            .users()
            .create(
                new CreateUser()
                    .withName(userName)
                    .withEmail(userName + "@test.openmetadata.org")
                    .withDescription("Expert user for domain include-all soft-delete test"));

    CreateDomain create =
        new CreateDomain()
            .withName(ns.prefix("domain_softdel_all"))
            .withDomainType(DomainType.AGGREGATE)
            .withExperts(List.of(expert.getFullyQualifiedName()))
            .withDescription("Domain for include-all soft-delete expert test");
    Domain domain = createEntity(create);

    client.users().delete(expert.getId().toString());

    Domain listed = null;
    ListParams params =
        new ListParams().setFields("experts").withLimit(100).addFilter("include", "all");
    while (listed == null) {
      ListResponse<Domain> page = listEntities(params);
      listed =
          page.getData().stream()
              .filter(d -> d.getId().equals(domain.getId()))
              .findFirst()
              .orElse(null);
      String after = page.getPaging() != null ? page.getPaging().getAfter() : null;
      if (listed != null || after == null) break;
      params =
          new ListParams()
              .setFields("experts")
              .withLimit(100)
              .addFilter("include", "all")
              .setAfter(after);
    }
    assertNotNull(listed, "Domain not found in list with include=all");
    assertTrue(
        listed.getExperts() == null || listed.getExperts().isEmpty(),
        "Soft-deleted expert must not appear even when include=all (applies to top-level only)");
  }

  @Test
  void softDeletedFollower_notReturnedInListEndpoint(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String userName = ns.shortPrefix("follower_list");
    User follower =
        client
            .users()
            .create(
                new CreateUser().withName(userName).withEmail(userName + "@test.openmetadata.org"));

    Domain domain = createEntity(createRequest(ns.prefix("dom_follower"), ns));

    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/domains/" + domain.getId() + "/followers",
            follower.getId(),
            ChangeEvent.class);

    client.users().delete(follower.getId().toString());

    ListParams params = new ListParams().setFields("followers").withLimit(1000000);
    ListResponse<Domain> list = listEntities(params);
    Domain listed =
        list.getData().stream()
            .filter(d -> d.getId().equals(domain.getId()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Domain not found in list"));
    assertTrue(
        listed.getFollowers() == null || listed.getFollowers().isEmpty(),
        "Soft-deleted follower must not appear in list endpoint");
  }

  @Test
  void softDeletedVoter_notReturnedInListEndpoint(TestNamespace ns) {
    String userName = ns.shortPrefix("voter_list");
    String userEmail = userName + "@test.openmetadata.org";

    OpenMetadataClient adminClient = SdkClients.adminClient();
    User voter =
        adminClient.users().create(new CreateUser().withName(userName).withEmail(userEmail));

    Domain domain = createEntity(createRequest(ns.prefix("dom_voter"), ns));

    OpenMetadataClient voterClient = SdkClients.createClient(userEmail, userEmail, new String[] {});
    voterClient
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/domains/" + domain.getId() + "/vote",
            new VoteRequest().withUpdatedVoteType(VoteRequest.VoteType.VOTED_UP),
            ChangeEvent.class);

    adminClient.users().delete(voter.getId().toString());

    ListParams params = new ListParams().setFields("votes").withLimit(1000000);
    ListResponse<Domain> list = listEntities(params);
    Domain listed =
        list.getData().stream()
            .filter(d -> d.getId().equals(domain.getId()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Domain not found in list"));
    Votes votes = listed.getVotes();
    boolean voterInUpVotes =
        votes != null
            && votes.getUpVoters() != null
            && votes.getUpVoters().stream()
                .anyMatch(ref -> ref != null && voter.getId().equals(ref.getId()));
    assertFalse(voterInUpVotes, "Soft-deleted voter must not appear in list endpoint votes");
  }

  // ===================================================================
  // Issue #28696 (domain analogue): a prefix-extension rename — where the new
  // name keeps the old name as a prefix (e.g. "sales" -> "sales global") — must
  // keep every linked asset, subdomain, and the domain doc itself pointing at
  // the new FQN in search, and must NOT touch a sibling domain that merely
  // shares a textual prefix ("salesforce"). The domain FQN-prefix scripts are
  // boundary-aware (equals(oldFqn) || startsWith(oldFqn + '.')), so this is
  // idempotent and prefix-safe; this locks that contract in (the prior rename
  // tests only prepended "renamed_", never extending the name as a prefix).
  // ===================================================================
  @Test
  void test_renameDomainPrefixExtension_keepsAssetSubdomainAndSiblingFqnInSearch(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    ObjectMapper mapper = new ObjectMapper();

    // Dot-free names so FQNs stay unquoted and the new FQN literally startsWith the old one.
    String parentName = "dom_" + ns.shortPrefix();
    Domain parent =
        createEntity(
            new CreateDomain()
                .withName(parentName)
                .withDisplayName("Customer Domain")
                .withDomainType(DomainType.AGGREGATE)
                .withDescription("Parent domain for prefix-rename search regression (#28696)"));
    String oldParentFqn = parent.getFullyQualifiedName();

    Domain subdomain =
        createEntity(
            new CreateDomain()
                .withName("sub_" + ns.shortPrefix())
                .withDomainType(DomainType.SOURCE_ALIGNED)
                .withParent(oldParentFqn)
                .withDescription("Subdomain exercising the child-prefix branch"));
    String subName = subdomain.getName();

    // Sibling shares the parent's textual prefix WITHOUT a '.' boundary; it must never be
    // rewritten.
    Domain sibling =
        createEntity(
            new CreateDomain()
                .withName(parentName + "x")
                .withDomainType(DomainType.AGGREGATE)
                .withDescription("Sibling domain that only shares a textual prefix"));
    String siblingFqn = sibling.getFullyQualifiedName();

    Table asset = createTableInDomain(ns, "clv", oldParentFqn);
    String assetId = asset.getId().toString();

    awaitAssetDomainFqn(client, mapper, assetId, oldParentFqn);

    // Prefix-extension rename + displayName change (UI rename shape).
    parent.setName(parentName + " renamed");
    parent.setDisplayName("Customer Domain Renamed");
    Domain renamed = patchEntity(parent.getId().toString(), parent);
    String newParentFqn = renamed.getFullyQualifiedName();
    assertNotEquals(oldParentFqn, newParentFqn);
    assertTrue(
        newParentFqn.startsWith(oldParentFqn),
        "Reproduction requires the new FQN to extend the old FQN as a prefix: " + newParentFqn);

    // Domain doc, subdomain (child prefix), and the asset must all follow to the new FQN...
    verifyDomainInSearch(newParentFqn, parent.getId().toString());
    verifyDomainInSearch(newParentFqn + "." + subName, subdomain.getId().toString());
    awaitAssetDomainFqn(client, mapper, assetId, newParentFqn);

    // ...and the prefix-sharing sibling must stay exactly as it was (no double / no spillover).
    verifyDomainInSearch(siblingFqn, sibling.getId().toString());
  }

  private Table createTableInDomain(TestNamespace ns, String suffix, String domainFqn) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create()
            .name(ns.shortPrefix("dom_db_" + suffix))
            .in(service.getFullyQualifiedName())
            .execute();
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());
    CreateTable createTable =
        new CreateTable()
            .withName(ns.shortPrefix("dom_tbl_" + suffix))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
            .withDomains(List.of(domainFqn));
    return client.tables().create(createTable);
  }

  private void awaitAssetDomainFqn(
      OpenMetadataClient client, ObjectMapper mapper, String tableId, String expectedDomainFqn) {
    Awaitility.await("asset " + tableId + " carries domain FQN " + expectedDomainFqn + " in search")
        .atMost(Duration.ofSeconds(60))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              String response =
                  client
                      .search()
                      .query("id:" + tableId)
                      .index("table_search_index")
                      .size(1)
                      .execute();
              JsonNode hits = mapper.readTree(response).path("hits").path("hits");
              assertTrue(hits.isArray() && !hits.isEmpty(), "table should be indexed");
              List<String> domainFqns = new ArrayList<>();
              for (JsonNode domain : hits.get(0).path("_source").path("domains")) {
                domainFqns.add(domain.path("fullyQualifiedName").asText());
              }
              assertTrue(
                  domainFqns.contains(expectedDomainFqn),
                  "Expected asset domain FQN '"
                      + expectedDomainFqn
                      + "' on table search doc but found "
                      + domainFqns);
            });
  }

  @Test
  void test_domainAssetAdd_propagatesInheritedDomainToChildTablesInSearch(TestNamespace ns)
      throws Exception {
    Domain hr = createDomainForTest(ns, "dom_add_hr");
    Domain marketing = createDomainForTest(ns, "dom_add_marketing");

    // Schema not yet in any domain, with an inheriting child and an explicit-domain child.
    DatabaseSchema schema = createDomainTestSchema(ns, "add", null, null);
    Table inheritedChild = createDomainChildTable(ns, "add_t1", schema, null);
    Table explicitChild =
        createDomainChildTable(ns, "add_t2", schema, marketing.getFullyQualifiedName());

    addAssetsToDomain(hr.getFullyQualifiedName(), List.of(schema.getEntityReference()));

    Awaitility.await("Wait for domain-page asset add to propagate inherited domain in search")
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              assertSingleSearchDomain(
                  schema.getId(),
                  hr,
                  "database_schema_search_index",
                  "Schema added to HR should show HR in search");
              assertSingleSearchDomain(
                  inheritedChild.getId(),
                  hr,
                  "table_search_index",
                  "Child inheriting from the schema should follow to HR in search");
              assertSingleSearchDomain(
                  explicitChild.getId(),
                  marketing,
                  "table_search_index",
                  "Child with an explicit domain should keep it in search");
            });
  }

  @Test
  void test_domainAssetRemove_descendantReinheritsFromAncestryInSearch(TestNamespace ns)
      throws Exception {
    Domain finance = createDomainForTest(ns, "dom_rm_finance");
    Domain removeDomain = createDomainForTest(ns, "dom_rm_target");

    // Database in Finance; schema explicitly in removeDomain; child inherits removeDomain.
    DatabaseSchema schema =
        createDomainTestSchema(
            ns, "rm", finance.getFullyQualifiedName(), removeDomain.getFullyQualifiedName());
    Table inheritedChild = createDomainChildTable(ns, "rm_t1", schema, null);

    Awaitility.await("Wait for child to inherit removeDomain in search")
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertSingleSearchDomain(
                    inheritedChild.getId(),
                    removeDomain,
                    "table_search_index",
                    "Child should inherit removeDomain before removal"));

    removeAssetsFromDomain(
        removeDomain.getFullyQualifiedName(), List.of(schema.getEntityReference()));

    // After detaching removeDomain, the schema re-derives its domain from its database (Finance),
    // and its inheriting descendants must follow to Finance in search — not stay stale on
    // removeDomain and not be blanked out. Polled so the assertion holds across the full async
    // propagation window (guards against a regression that clears/mis-sets the child late).
    Awaitility.await("Wait for schema and inheriting child to re-inherit Finance after removal")
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              assertSingleSearchDomain(
                  schema.getId(),
                  finance,
                  "database_schema_search_index",
                  "Schema should re-inherit Finance from its database after removal");
              assertSingleSearchDomain(
                  inheritedChild.getId(),
                  finance,
                  "table_search_index",
                  "Inheriting child should re-inherit Finance from the schema's ancestry after removal, not stay on removeDomain or be cleared");
            });
  }

  private Domain createDomainForTest(TestNamespace ns, String suffix) {
    return createEntity(
        new CreateDomain()
            .withName(ns.prefix(suffix))
            .withDescription("Test domain " + suffix)
            .withDomainType(DomainType.AGGREGATE));
  }

  private DatabaseSchema createDomainTestSchema(
      TestNamespace ns, String suffix, String databaseDomainFqn, String schemaDomainFqn) {
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    org.openmetadata.schema.api.data.CreateDatabase createDb =
        new org.openmetadata.schema.api.data.CreateDatabase()
            .withName(ns.shortPrefix("dom_db_" + suffix))
            .withService(service.getFullyQualifiedName());
    if (databaseDomainFqn != null) {
      createDb.withDomains(List.of(databaseDomainFqn));
    }
    Database database = client.databases().create(createDb);
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName(ns.shortPrefix("dom_sc_" + suffix))
            .withDatabase(database.getFullyQualifiedName());
    if (schemaDomainFqn != null) {
      createSchema.withDomains(List.of(schemaDomainFqn));
    }
    return client.databaseSchemas().create(createSchema);
  }

  private Table createDomainChildTable(
      TestNamespace ns, String suffix, DatabaseSchema schema, String domainFqn) {
    CreateTable createTable =
        new CreateTable()
            .withName(ns.shortPrefix("dom_t_" + suffix))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));
    if (domainFqn != null) {
      createTable.withDomains(List.of(domainFqn));
    }
    return SdkClients.adminClient().tables().create(createTable);
  }

  // ===================================================================
  // LIST ENDPOINT SERVER-SIDE FILTERS (issue #29213)
  // ===================================================================

  private static Set<UUID> listedIds(ListResponse<Domain> response) {
    return response.getData().stream().map(Domain::getId).collect(Collectors.toSet());
  }

  private ListResponse<Domain> listDomainsWithFilter(String key, String value) {
    return listEntities(new ListParams().withLimit(1000000).addFilter(key, value));
  }

  private Domain createDomain(TestNamespace ns, String suffix, DomainType type) {
    return createEntity(
        new CreateDomain()
            .withName(ns.prefix(suffix))
            .withDomainType(type)
            .withDescription("filter test domain"));
  }

  @Test
  void test_listDomains_filterByDomainType(TestNamespace ns) {
    Domain aggregate = createDomain(ns, "ftype_agg", DomainType.AGGREGATE);
    Domain source = createDomain(ns, "ftype_src", DomainType.SOURCE_ALIGNED);
    Domain consumer = createDomain(ns, "ftype_con", DomainType.CONSUMER_ALIGNED);

    Set<UUID> single =
        listedIds(listDomainsWithFilter("domainType", DomainType.SOURCE_ALIGNED.value()));
    assertTrue(single.contains(source.getId()), "SOURCE_ALIGNED domain must be listed");
    assertFalse(single.contains(aggregate.getId()), "AGGREGATE domain must be filtered out");
    assertFalse(single.contains(consumer.getId()), "CONSUMER_ALIGNED domain must be filtered out");

    Set<UUID> multi =
        listedIds(
            listDomainsWithFilter(
                "domainType",
                DomainType.SOURCE_ALIGNED.value() + "," + DomainType.CONSUMER_ALIGNED.value()));
    assertTrue(multi.contains(source.getId()));
    assertTrue(multi.contains(consumer.getId()));
    assertFalse(
        multi.contains(aggregate.getId()), "AGGREGATE must be excluded by multi-value type");
  }

  @Test
  void test_listDomains_filterByOwner(TestNamespace ns) {
    User owner = testUser1();
    EntityReference ownerRef = new EntityReference().withId(owner.getId()).withType("user");
    Domain owned =
        createEntity(
            new CreateDomain()
                .withName(ns.prefix("fowner_owned"))
                .withDomainType(DomainType.AGGREGATE)
                .withOwners(List.of(ownerRef))
                .withDescription("filter test domain"));
    Domain notOwned = createDomain(ns, "fowner_not", DomainType.AGGREGATE);

    Set<UUID> ids = listedIds(listDomainsWithFilter("owners", owner.getFullyQualifiedName()));
    assertTrue(ids.contains(owned.getId()), "owned domain must be listed");
    assertFalse(ids.contains(notOwned.getId()), "un-owned domain must be filtered out");
  }

  @Test
  void test_listDomains_filterByUnknownOwnerReturnsNoMatches(TestNamespace ns) {
    User owner = testUser1();
    EntityReference ownerRef = new EntityReference().withId(owner.getId()).withType("user");
    Domain owned =
        createEntity(
            new CreateDomain()
                .withName(ns.prefix("fowner_unknown"))
                .withDomainType(DomainType.AGGREGATE)
                .withOwners(List.of(ownerRef))
                .withDescription("filter test domain"));

    // An owner that resolves to nothing must yield no matches, not the full domain list.
    Set<UUID> ids = listedIds(listDomainsWithFilter("owners", ns.prefix("no_such_owner")));
    assertFalse(ids.contains(owned.getId()), "unknown owner must not return owned domains");
  }

  @Test
  void test_listDomains_filterByClassificationTag(TestNamespace ns) {
    TagLabel pii = piiSensitiveTagLabel();
    Domain tagged =
        createEntity(
            new CreateDomain()
                .withName(ns.prefix("ftag_yes"))
                .withDomainType(DomainType.AGGREGATE)
                .withTags(List.of(pii))
                .withDescription("filter test domain"));
    Domain untagged = createDomain(ns, "ftag_no", DomainType.AGGREGATE);

    Set<UUID> ids = listedIds(listDomainsWithFilter("tags", pii.getTagFQN()));
    assertTrue(ids.contains(tagged.getId()), "tagged domain must be listed");
    assertFalse(ids.contains(untagged.getId()), "un-tagged domain must be filtered out");

    // A glossaryTerms filter must NOT match a classification tag (tag_usage.source separation)
    Set<UUID> asGlossary = listedIds(listDomainsWithFilter("glossaryTerms", pii.getTagFQN()));
    assertFalse(
        asGlossary.contains(tagged.getId()),
        "classification tag must not be matched by the glossaryTerms filter");
  }

  @Test
  void test_listDomains_filterByGlossaryTerm(TestNamespace ns) {
    TagLabel term = glossaryTermLabel();
    Domain tagged =
        createEntity(
            new CreateDomain()
                .withName(ns.prefix("fterm_yes"))
                .withDomainType(DomainType.AGGREGATE)
                .withTags(List.of(term))
                .withDescription("filter test domain"));
    Domain untagged = createDomain(ns, "fterm_no", DomainType.AGGREGATE);

    Set<UUID> ids = listedIds(listDomainsWithFilter("glossaryTerms", term.getTagFQN()));
    assertTrue(ids.contains(tagged.getId()), "domain tagged with the term must be listed");
    assertFalse(ids.contains(untagged.getId()), "un-tagged domain must be filtered out");

    // A tags filter must NOT match a glossary term (tag_usage.source separation)
    Set<UUID> asClassification = listedIds(listDomainsWithFilter("tags", term.getTagFQN()));
    assertFalse(
        asClassification.contains(tagged.getId()),
        "glossary term must not be matched by the classification tags filter");
  }

  @Test
  void test_listDomains_filtersApplyAcrossHierarchy(TestNamespace ns) {
    Domain parent = createDomain(ns, "fh_parent", DomainType.AGGREGATE);
    Domain sub =
        createEntity(
            new CreateDomain()
                .withName(ns.prefix("fh_sub"))
                .withDomainType(DomainType.SOURCE_ALIGNED)
                .withParent(parent.getFullyQualifiedName())
                .withTags(List.of(piiSensitiveTagLabel()))
                .withDescription("filter test sub-domain"));

    // Type filter must reach sub-domains, not just root-level domains
    Set<UUID> byType =
        listedIds(listDomainsWithFilter("domainType", DomainType.SOURCE_ALIGNED.value()));
    assertTrue(byType.contains(sub.getId()), "matching sub-domain must be returned by type filter");

    // Tag filter must also reach sub-domains
    Set<UUID> byTag = listedIds(listDomainsWithFilter("tags", piiSensitiveTagLabel().getTagFQN()));
    assertTrue(byTag.contains(sub.getId()), "matching sub-domain must be returned by tag filter");
  }

  @Test
  void test_listDomains_combinedFiltersAreAnded(TestNamespace ns) {
    User owner = testUser1();
    EntityReference ownerRef = new EntityReference().withId(owner.getId()).withType("user");
    Domain match =
        createEntity(
            new CreateDomain()
                .withName(ns.prefix("fc_match"))
                .withDomainType(DomainType.CONSUMER_ALIGNED)
                .withOwners(List.of(ownerRef))
                .withDescription("filter test domain"));
    Domain ownerOnly =
        createEntity(
            new CreateDomain()
                .withName(ns.prefix("fc_owneronly"))
                .withDomainType(DomainType.AGGREGATE)
                .withOwners(List.of(ownerRef))
                .withDescription("filter test domain"));
    Domain typeOnly = createDomain(ns, "fc_typeonly", DomainType.CONSUMER_ALIGNED);

    Set<UUID> ids =
        listedIds(
            listEntities(
                new ListParams()
                    .withLimit(1000000)
                    .addFilter("owners", owner.getFullyQualifiedName())
                    .addFilter("domainType", DomainType.CONSUMER_ALIGNED.value())));
    assertTrue(ids.contains(match.getId()), "domain matching both filters must be listed");
    assertFalse(
        ids.contains(ownerOnly.getId()), "owner-only match must be excluded (AND semantics)");
    assertFalse(ids.contains(typeOnly.getId()), "type-only match must be excluded (AND semantics)");
  }

  private void addAssetsToDomain(String domainFqn, List<EntityReference> assets) throws Exception {
    BulkAssets request = new BulkAssets().withAssets(assets).withDryRun(false);
    SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/domains/" + domainFqn + "/assets/add", request, Void.class);
  }

  private void removeAssetsFromDomain(String domainFqn, List<EntityReference> assets)
      throws Exception {
    BulkAssets request = new BulkAssets().withAssets(assets).withDryRun(false);
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT, "/v1/domains/" + domainFqn + "/assets/remove", request, Void.class);
  }

  private List<EntityReference> searchDomains(UUID entityId, String indexName) throws Exception {
    String searchResponse =
        SdkClients.adminClient().search().query("id:" + entityId).index(indexName).execute();
    JsonNode fieldNode =
        JsonUtils.readTree(searchResponse)
            .path("hits")
            .path("hits")
            .path(0)
            .path("_source")
            .path("domains");
    if (fieldNode.isMissingNode() || !fieldNode.isArray()) {
      return null;
    }
    return JsonUtils.readObjects(fieldNode.toString(), EntityReference.class);
  }

  private void assertSingleSearchDomain(
      UUID entityId, Domain expected, String indexName, String message) throws Exception {
    List<EntityReference> domains = searchDomains(entityId, indexName);
    assertNotNull(domains, message);
    assertEquals(1, domains.size(), message);
    assertEquals(expected.getId(), domains.get(0).getId(), message);
  }

  @Test
  void test_entityDomainChange_doesNotOverAppendToExplicitDescendantInSearch(TestNamespace ns)
      throws Exception {
    Domain a = createDomainForTest(ns, "ovr_a");
    Domain bDom = createDomainForTest(ns, "ovr_b");
    Domain cDom = createDomainForTest(ns, "ovr_c");

    // Schema explicitly in A, with an inheriting child and an explicit-domain (C) child.
    DatabaseSchema schema = createDomainTestSchema(ns, "ovr", null, a.getFullyQualifiedName());
    Table inheritedChild = createDomainChildTable(ns, "ovr_inh", schema, null);
    Table explicitChild =
        createDomainChildTable(ns, "ovr_expl", schema, cDom.getFullyQualifiedName());

    Awaitility.await("baseline domains in search")
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              assertSingleSearchDomain(
                  inheritedChild.getId(), a, "table_search_index", "inherited child starts in A");
              assertSingleSearchDomain(
                  explicitChild.getId(), cDom, "table_search_index", "explicit child starts in C");
            });

    // Change the schema's own domain A -> B (the entity-update path, recorded as delete+add).
    String patch =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/domains\",\"value\":[{\"id\":\"%s\",\"type\":\"domain\",\"fullyQualifiedName\":\"%s\"}]}]",
            bDom.getId(), bDom.getFullyQualifiedName());
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/databaseSchemas/" + schema.getId(),
            patch,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());

    Awaitility.await("after schema domain change A -> B")
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              // inherited child follows the parent to B
              assertSingleSearchDomain(
                  inheritedChild.getId(),
                  bDom,
                  "table_search_index",
                  "inheriting child should follow the schema to B in search");
              // explicit child keeps ONLY C — the parent's new domain must NOT be appended
              List<EntityReference> explDomains =
                  searchDomains(explicitChild.getId(), "table_search_index");
              assertNotNull(explDomains, "explicit child should be indexed");
              assertEquals(
                  1,
                  explDomains.size(),
                  "explicit-domain child must not get the parent's changed domain appended in search");
              assertEquals(
                  cDom.getId(),
                  explDomains.get(0).getId(),
                  "explicit-domain child keeps its own domain C");
            });
  }
}
