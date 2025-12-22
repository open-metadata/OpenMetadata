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

import static org.junit.jupiter.api.Assertions.*;

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
  protected CreateDomain createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    return new CreateDomain()
        .withName(ns.prefix("domain"))
        .withDomainType(DomainType.AGGREGATE)
        .withDescription("Test domain created by integration test");
  }

  @Override
  protected CreateDomain createRequest(String name, TestNamespace ns, OpenMetadataClient client) {
    return new CreateDomain()
        .withName(name)
        .withDomainType(DomainType.AGGREGATE)
        .withDescription("Test domain");
  }

  @Override
  protected Domain createEntity(CreateDomain createRequest, OpenMetadataClient client) {
    return client.domains().create(createRequest);
  }

  @Override
  protected Domain getEntity(String id, OpenMetadataClient client) {
    return client.domains().get(id);
  }

  @Override
  protected Domain getEntityByName(String fqn, OpenMetadataClient client) {
    return client.domains().getByName(fqn);
  }

  @Override
  protected Domain patchEntity(String id, Domain entity, OpenMetadataClient client) {
    return client.domains().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.domains().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.domains().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    client.domains().delete(id, java.util.Map.of("hardDelete", "true", "recursive", "true"));
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
  protected Domain getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.domains().get(id, fields);
  }

  @Override
  protected Domain getEntityByNameWithFields(String fqn, String fields, OpenMetadataClient client) {
    return client.domains().getByName(fqn, fields);
  }

  @Override
  protected Domain getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.domains().get(id, null, "deleted");
  }

  @Override
  protected ListResponse<Domain> listEntities(ListParams params, OpenMetadataClient client) {
    return client.domains().list(params);
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

      Domain domain = createEntity(create, client);
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

    Domain parent = createEntity(createParent, client);

    CreateDomain createChild =
        new CreateDomain()
            .withName(ns.prefix("subDomain"))
            .withDomainType(DomainType.SOURCE_ALIGNED)
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Sub domain");

    Domain child = createEntity(createChild, client);
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

    Domain domain = createEntity(create, client);

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

    Domain domain = createEntity(create, client);

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

    Domain domain = createEntity(create, client);
    assertEquals(DomainType.AGGREGATE, domain.getDomainType());

    domain.setDomainType(DomainType.SOURCE_ALIGNED);
    Domain updated = patchEntity(domain.getId().toString(), domain, client);

    assertEquals(DomainType.SOURCE_ALIGNED, updated.getDomainType());
  }

  @Test
  void test_updateDomainDescription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDomain create = createMinimalRequest(ns, client);
    Domain domain = createEntity(create, client);

    domain.setDescription("Updated domain description");
    Domain updated = patchEntity(domain.getId().toString(), domain, client);

    assertEquals("Updated domain description", updated.getDescription());
  }

  @Test
  void test_updateDomainDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDomain create = createMinimalRequest(ns, client);
    Domain domain = createEntity(create, client);

    domain.setDisplayName("My Updated Domain");
    Domain updated = patchEntity(domain.getId().toString(), domain, client);

    assertEquals("My Updated Domain", updated.getDisplayName());
  }

  @Test
  void test_addExpertsToDomain(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDomain create = createMinimalRequest(ns, client);
    Domain domain = createEntity(create, client);

    Domain fetched = client.domains().get(domain.getId().toString(), "experts");
    EntityReference expertRef = testUser1().getEntityReference();
    fetched.setExperts(List.of(expertRef));

    Domain updated = patchEntity(fetched.getId().toString(), fetched, client);

    Domain verify = client.domains().get(updated.getId().toString(), "experts");
    assertNotNull(verify.getExperts());
    assertTrue(verify.getExperts().stream().anyMatch(e -> e.getId().equals(expertRef.getId())));
  }

  @Test
  void test_hardDeleteDomain(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDomain create = createMinimalRequest(ns, client);
    Domain domain = createEntity(create, client);
    String domainId = domain.getId().toString();

    hardDeleteEntity(domainId, client);

    assertThrows(
        Exception.class,
        () -> getEntity(domainId, client),
        "Deleted domain should not be retrievable");
  }

  @Test
  void test_domainVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateDomain create = createMinimalRequest(ns, client);
    Domain domain = createEntity(create, client);
    assertEquals(0.1, domain.getVersion(), 0.001);

    domain.setDescription("Updated description v1");
    Domain v2 = patchEntity(domain.getId().toString(), domain, client);
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
      createEntity(create, client);
    }

    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Domain> response = listEntities(params, client);

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

    Domain parent = createEntity(createParent, client);

    CreateDomain createChild1 =
        new CreateDomain()
            .withName(ns.prefix("child1"))
            .withDomainType(DomainType.SOURCE_ALIGNED)
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child domain 1");

    Domain child1 = createEntity(createChild1, client);

    CreateDomain createChild2 =
        new CreateDomain()
            .withName(ns.prefix("child2"))
            .withDomainType(DomainType.CONSUMER_ALIGNED)
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child domain 2");

    Domain child2 = createEntity(createChild2, client);

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

    Domain parent = createEntity(createParent, client);

    CreateDomain createChild =
        new CreateDomain()
            .withName(ns.prefix("childToDelete"))
            .withDomainType(DomainType.SOURCE_ALIGNED)
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child domain to delete");

    Domain child = createEntity(createChild, client);

    hardDeleteEntity(parent.getId().toString(), client);

    String parentId = parent.getId().toString();
    assertThrows(
        Exception.class, () -> getEntity(parentId, client), "Parent domain should be deleted");

    String childId = child.getId().toString();
    assertThrows(
        Exception.class,
        () -> getEntity(childId, client),
        "Child domain should be cascade deleted");
  }

  // ===================================================================
  // VERSION HISTORY SUPPORT
  // ===================================================================

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.domains().getVersionList(id);
  }

  @Override
  protected Domain getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.domains().getVersion(id.toString(), version);
  }
}
