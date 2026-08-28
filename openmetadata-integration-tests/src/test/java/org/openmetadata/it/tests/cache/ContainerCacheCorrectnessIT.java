package org.openmetadata.it.tests.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * End-to-end correctness tests for the Redis-backed container caches.
 *
 * <p>Verifies that {@link org.openmetadata.service.cache.AncestorsCache} hydrates display names
 * through the write-through per-entity reference cache (so a remote rename or display-name
 * edit shows up on the next breadcrumb call) and that
 * {@link org.openmetadata.service.cache.ChildrenPageCache} rotates its per-parent version on
 * any child mutation (so create / update / delete / move are reflected on the next
 * {@code /children} call).
 *
 * <p>Each test runs the same scenario twice: once cold against the DB to populate the cache,
 * once warm to confirm the cached path returns the correct (mutated) data. We assert on
 * observable API behavior, not Redis internals — the contract is "subsequent reads see the
 * latest write," not "this exact cache key was rotated."
 *
 * <p>Tests are skipped when the test suite is not configured with a Redis cache provider — the
 * caches are no-ops without one and there is nothing to assert.
 */
@ExtendWith(TestNamespaceExtension.class)
class ContainerCacheCorrectnessIT {

  @BeforeAll
  static void requireRedis() {
    Assumptions.assumeTrue(
        TestSuiteBootstrap.isRedisEnabled(),
        "Container cache correctness ITs require cacheProvider=redis (set by -Pcache-tests"
            + " or -Ppostgres-os-redis, or pass -DcacheProvider=redis directly)");
  }

  // -------------------------- Ancestors cache --------------------------

  @Test
  void ancestors_displayNameEditOnRemoteAncestorVisibleOnNextRead(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Build a 3-level chain: root → mid → leaf. We cache the leaf's ancestors first, then
    // edit `mid`'s displayName via PATCH and re-read the leaf's ancestors. The mid entry
    // in the chain must come back with the new displayName — that's the write-through
    // hybrid working.
    Container root = createChild(ns, "anc_root", service.getFullyQualifiedName(), null);
    Container mid = createChild(ns, "anc_mid", service.getFullyQualifiedName(), root);
    Container leaf = createChild(ns, "anc_leaf", service.getFullyQualifiedName(), mid);

    List<EntityReference> warmup = getAncestors(client, leaf.getFullyQualifiedName());
    assertEquals(2, warmup.size(), "leaf has root + mid as ancestors");

    String newDisplayName = "Mid Renamed " + System.currentTimeMillis();
    patchDisplayName(client, mid.getId().toString(), newDisplayName);

    List<EntityReference> after = getAncestors(client, leaf.getFullyQualifiedName());
    assertEquals(2, after.size(), "topology hasn't changed");
    assertEquals(mid.getId(), after.get(1).getId(), "mid is still the immediate parent of leaf");
    assertEquals(
        newDisplayName,
        after.get(1).getDisplayName(),
        "displayName edit on a cached ancestor must be visible on the next ancestors read — "
            + "confirms the cache stores topology only and rehydrates refs through the "
            + "write-through per-entity cache");
  }

  // -------------------------- Children-page cache --------------------------

  @Test
  void childrenPage_createReflectedOnNextRead(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container parent = createChild(ns, "kids_parent_create", service.getFullyQualifiedName(), null);

    ListResponse<Container> initial = getChildren(parent.getFullyQualifiedName());
    assertEquals(0, initial.getData().size(), "parent starts with no children");
    assertEquals(0, initial.getPaging().getTotal(), "paging total agrees with row count");

    // Warmth check — second read must return the same empty page (cached or not, has to match).
    ListResponse<Container> warm = getChildren(parent.getFullyQualifiedName());
    assertEquals(0, warm.getData().size(), "warm read agrees with cold read");

    // Now create a child and confirm the next children read sees it.
    Container child = createChild(ns, "kids_child_a", service.getFullyQualifiedName(), parent);

    ListResponse<Container> afterCreate = getChildren(parent.getFullyQualifiedName());
    assertEquals(
        1,
        afterCreate.getData().size(),
        "creating a child must rotate the parent's children-page version");
    assertEquals(child.getId(), afterCreate.getData().get(0).getId());
  }

  @Test
  void childrenPage_deleteReflectedOnNextRead(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container parent = createChild(ns, "kids_parent_delete", service.getFullyQualifiedName(), null);

    Container a = createChild(ns, "kids_child_del_a", service.getFullyQualifiedName(), parent);
    Container b = createChild(ns, "kids_child_del_b", service.getFullyQualifiedName(), parent);

    // Warm the cache.
    ListResponse<Container> warmup = getChildren(parent.getFullyQualifiedName());
    assertEquals(2, warmup.getData().size(), "parent has 2 children before delete");

    // Hard delete so the relationship row goes away. Soft-delete keeps the row and the
    // /children endpoint isn't include-filtered today, so the parent's child count would
    // still show 2 — that's a UX question, not a cache-correctness one.
    java.util.Map<String, String> hardDelete = new java.util.HashMap<>();
    hardDelete.put("hardDelete", "true");
    hardDelete.put("recursive", "true");
    SdkClients.adminClient().containers().delete(a.getId().toString(), hardDelete);

    ListResponse<Container> after = getChildren(parent.getFullyQualifiedName());
    assertEquals(
        1, after.getData().size(), "delete must invalidate the parent's children-page cache");
    assertEquals(
        b.getId(), after.getData().get(0).getId(), "the surviving child must still be present");
  }

  @Test
  void childrenPage_displayNameEditOnChildVisibleOnNextRead(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container parent = createChild(ns, "kids_parent_dnedit", service.getFullyQualifiedName(), null);
    Container child = createChild(ns, "kids_child_dn", service.getFullyQualifiedName(), parent);

    // Warm the cache.
    ListResponse<Container> warmup = getChildren(parent.getFullyQualifiedName());
    assertEquals(1, warmup.getData().size(), "parent has 1 child before edit");

    String newDisplayName = "Child Renamed " + System.currentTimeMillis();
    patchDisplayName(client, child.getId().toString(), newDisplayName);

    ListResponse<Container> after = getChildren(parent.getFullyQualifiedName());
    assertEquals(1, after.getData().size(), "displayName edit doesn't change the row count");
    assertEquals(
        newDisplayName,
        after.getData().get(0).getDisplayName(),
        "the child's PATCH triggers parent's children-page invalidation — the cached row "
            + "must not serve a stale displayName");
  }

  // Container parent re-parenting via PATCH is not currently supported by ContainerUpdater
  // (no /parent key in entitySpecificUpdate). When the platform adds it, an additional test
  // here should verify both old and new parent caches invalidate.

  // -------------------------- Helpers --------------------------

  private static Container createChild(
      TestNamespace ns, String suffix, String serviceFqn, Container parent) {
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix(suffix));
    request.setService(serviceFqn);
    if (parent != null) {
      request.setParent(
          new EntityReference()
              .withId(parent.getId())
              .withType("container")
              .withFullyQualifiedName(parent.getFullyQualifiedName()));
    }
    return SdkClients.adminClient().containers().create(request);
  }

  private static List<EntityReference> getAncestors(OpenMetadataClient client, String fqn)
      throws Exception {
    EntityReferenceList list =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + fqn + "/ancestors",
                null,
                EntityReferenceList.class);
    assertNotNull(list, "ancestors response must not be null");
    return list;
  }

  private static ListResponse<Container> getChildren(String parentFqn) throws Exception {
    return SdkClients.adminClient().containers().listChildren(parentFqn);
  }

  private static void patchDisplayName(OpenMetadataClient client, String id, String newDisplayName)
      throws Exception {
    String patch =
        "[{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":\"" + newDisplayName + "\"}]";
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/containers/" + id,
            patch,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
  }

  /** Typed deserialization target for the array response from /ancestors. */
  private static class EntityReferenceList extends ArrayList<EntityReference> {
    private static final long serialVersionUID = 1L;
  }
}
