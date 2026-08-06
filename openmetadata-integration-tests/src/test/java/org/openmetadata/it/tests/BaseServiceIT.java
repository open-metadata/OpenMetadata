package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.TestUtils;

/**
 * Base class for Service entity integration tests.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests and adds service-specific tests. Services
 * typically don't support patch operations.
 *
 * @param <T> The service entity type (e.g., DatabaseService, DashboardService)
 * @param <K> The create request type (e.g., CreateDatabaseService)
 */
public abstract class BaseServiceIT<T extends EntityInterface, K extends CreateEntity>
    extends BaseEntityIT<T, K> {

  // Services typically don't support patch, don't have search indices, and don't need tag testing
  {
    supportsPatch = false;
    supportsSearchIndex = false;
    supportsDomains = false; // Services don't support domains field directly
    supportsTags = false; // Skip tag tests for services to avoid deadlocks in parallel execution
  }

  @Override
  protected String getResourcePath() {
    return "/v1/services/" + TestUtils.plurializeEntityType(getEntityType()) + "/";
  }

  @Test
  void test_listWithDomainFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String typePrefix = getEntityType().replace("Service", "").toLowerCase();

    Domain domain1 =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix(typePrefix + "dom1"))
                    .withDescription("Test domain 1")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE));
    Domain domain2 =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix(typePrefix + "dom2"))
                    .withDescription("Test domain 2")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE));

    K c1 = createRequest(ns.prefix(typePrefix + "svc1"), ns);
    c1.setDomains(List.of(domain1.getFullyQualifiedName()));
    T s1 = createEntity(c1);

    K c2 = createRequest(ns.prefix(typePrefix + "svc2"), ns);
    c2.setDomains(List.of(domain1.getFullyQualifiedName()));
    T s2 = createEntity(c2);

    K c3 = createRequest(ns.prefix(typePrefix + "svc3"), ns);
    c3.setDomains(List.of(domain2.getFullyQualifiedName()));
    T s3 = createEntity(c3);

    K c4 = createRequest(ns.prefix(typePrefix + "svc4"), ns);
    c4.setDomains(List.of(domain2.getFullyQualifiedName()));
    T s4 = createEntity(c4);

    ListResponse<T> result =
        listEntities(new ListParams().withDomain(domain1.getFullyQualifiedName()).withLimit(1000));
    assertTrue(
        result.getData().stream().anyMatch(s -> s.getName().equals(s1.getName())),
        "Service s1 should be in domain1 results");
    assertTrue(
        result.getData().stream().anyMatch(s -> s.getName().equals(s2.getName())),
        "Service s2 should be in domain1 results");

    result =
        listEntities(new ListParams().withDomain(domain2.getFullyQualifiedName()).withLimit(1000));
    assertTrue(
        result.getData().stream().anyMatch(s -> s.getName().equals(s3.getName())),
        "Service s3 should be in domain2 results");
    assertTrue(
        result.getData().stream().anyMatch(s -> s.getName().equals(s4.getName())),
        "Service s4 should be in domain2 results");
  }

  /**
   * Test: Service name with dot should have properly quoted FQN.
   *
   * <p>When a service name contains a dot (e.g., "snowflake.prod"), the FQN should quote the
   * service name to distinguish it from the FQN separator.
   *
   * <p>This test validates issue #24401: Service names with dots should be properly handled in FQN
   * quoting.
   *
   * @see <a href="https://github.com/open-metadata/OpenMetadata/issues/24401">Issue #24401</a>
   */
  @Test
  void test_serviceNameWithDot_fqnQuoting(TestNamespace ns) {
    String typePrefix = getEntityType().replace("Service", "").toLowerCase();
    String serviceNameWithDot = ns.prefix(typePrefix + ".svc.name");

    K createRequest = createRequest(serviceNameWithDot, ns);
    T service = createEntity(createRequest);

    assertNotNull(service, "Service should be created");
    assertEquals(serviceNameWithDot, service.getName(), "Service name should match");

    String expectedFqn = FullyQualifiedName.quoteName(serviceNameWithDot);
    assertEquals(
        expectedFqn,
        service.getFullyQualifiedName(),
        "FQN should be quoted when service name contains dot");

    assertTrue(
        service.getFullyQualifiedName().startsWith("\""),
        "FQN should start with quote when service name contains dot");
    assertTrue(
        service.getFullyQualifiedName().endsWith("\""),
        "FQN should end with quote when service name contains dot");

    T fetchedByFqn = getEntityByName(service.getFullyQualifiedName());
    assertNotNull(fetchedByFqn, "Service should be retrievable by FQN");
    assertEquals(service.getId(), fetchedByFqn.getId(), "Fetched service should match created");

    T fetchedById = getEntity(service.getId().toString());
    assertNotNull(fetchedById, "Service should be retrievable by ID");
    assertEquals(
        service.getFullyQualifiedName(),
        fetchedById.getFullyQualifiedName(),
        "FQN should be consistent");
  }

  // ===================================================================
  // RECURSIVE HARD-DELETE REGRESSION (bulk subtree delete optimization)
  // ===================================================================

  /**
   * A descendant search doc to assert is removed by the ancestor cascade. {@code index} is the
   * search index alias (e.g. {@code table_search_index}) and {@code id} the doc id.
   */
  protected record SearchDoc(String index, String id) {}

  /**
   * A small CONTAINS/PARENT_OF subtree built under a freshly-created service of this type, used by
   * {@link #recursiveHardDelete_serviceSubtree_leavesNoOrphansAndSearchClean(TestNamespace)}.
   *
   * @param serviceId the root service id — deleted recursively
   * @param descendantIds ids of created descendants, checked for orphaned relationship rows
   * @param searchDocs descendant docs that must be searchable before and gone after the delete —
   *     include one per hierarchy level whose cascade coverage you want to guard (e.g. both the
   *     api_collection and api_endpoint docs); empty list skips the search-cleanliness assertion
   */
  protected record DeletableSubtree(
      String serviceId, List<String> descendantIds, List<SearchDoc> searchDocs) {}

  /**
   * Override in a service IT to build a small subtree (service + descendants) so the recursive
   * hard-delete regression below can run. Default returns {@code null} → the test is skipped for
   * service types that don't build an asset subtree. This guards the bulk-delete optimization
   * ({@code descendantsCoveredByAncestorCascade}): descendants must be removed from the DB, leave
   * no orphaned relationship rows, and be removed from the search index by the ancestor cascade.
   */
  protected DeletableSubtree createDeletableSubtree(TestNamespace ns) {
    return null;
  }

  protected String searchById(String index, String id) throws Exception {
    return SdkClients.adminClient().search().query("id:" + id).index(index).size(1).execute();
  }

  @Test
  void recursiveHardDelete_serviceSubtree_leavesNoOrphansAndSearchClean(TestNamespace ns) {
    DeletableSubtree subtree = createDeletableSubtree(ns);
    Assumptions.assumeTrue(
        subtree != null, "service type provides no deletable subtree builder; skipping");

    for (SearchDoc sd : subtree.searchDocs()) {
      // Secondary docs (e.g. column_search_index) are written on the async per-entity indexing lane
      // and can sit briefly behind a concurrent full-reindex alias swap, so allow the same
      // tolerance
      // as the post-delete checks rather than a tighter 60s that flakes under full IT load.
      Awaitility.await("descendant indexed in search before delete: " + sd.index())
          .atMost(Duration.ofSeconds(120))
          .pollInterval(Duration.ofSeconds(1))
          .ignoreExceptions()
          .untilAsserted(
              () ->
                  assertTrue(
                      searchById(sd.index(), sd.id()).contains(sd.id()),
                      sd.index() + " doc should be present in search before delete"));
    }

    // Recursive hard delete of the root service (hardDeleteEntity is recursive for services).
    hardDeleteEntity(subtree.serviceId());

    // (1) The whole subtree is hard-deleted (async — poll until the service is gone).
    Awaitility.await("service subtree hard-deleted")
        .atMost(Duration.ofSeconds(180))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(() -> assertThrows(Exception.class, () -> getEntity(subtree.serviceId())));

    // (2) No orphaned (parent, CONTAINS, child) entity_relationship rows survive for the subtree.
    List<CollectionDAO.EntityRelationshipObject> orphanRows =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findFromBatch(subtree.descendantIds(), Relationship.CONTAINS.ordinal());
    assertTrue(
        orphanRows.isEmpty(),
        "no CONTAINS entity_relationship rows must survive after recursive service delete — found "
            + orphanRows.size());

    // (3) Each descendant search doc is removed by the ancestor service.id cascade (the assertion
    // the search-skip optimization relies on — one per hierarchy level the subtree opts to guard).
    for (SearchDoc sd : subtree.searchDocs()) {
      Awaitility.await("descendant search doc removed: " + sd.index())
          .atMost(Duration.ofSeconds(90))
          .pollInterval(Duration.ofSeconds(1))
          .ignoreExceptions()
          .untilAsserted(
              () ->
                  assertFalse(
                      searchById(sd.index(), sd.id()).contains(sd.id()),
                      sd.index() + " doc must be gone after recursive service hard delete"));
    }
  }
}
