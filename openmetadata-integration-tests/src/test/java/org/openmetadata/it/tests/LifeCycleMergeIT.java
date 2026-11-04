package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class LifeCycleMergeIT {
  @Test
  void putMergesSourceBoundsWithoutChangingCatalogAudit(TestNamespace ns) {
    var service = DatabaseServiceTestFactory.createPostgres(ns);
    var request =
        new CreateDatabase()
            .withName(ns.prefix("observed-db"))
            .withService(service.getFullyQualifiedName());
    var client = SdkClients.adminClient().databases();
    var original = client.create(request.withLifeCycle(observation(2000L, 3000L)));
    var earlier = put(request.withLifeCycle(observation(1000L, 4000L)));
    var later = put(request.withLifeCycle(observation(5000L, 2500L)));
    assertEquals(1000L, earlier.getLifeCycle().getCreated().getTimestamp());
    assertEquals(1000L, later.getLifeCycle().getCreated().getTimestamp());
    assertEquals("source-1000", later.getLifeCycle().getCreated().getAccessedByAProcess());
    assertEquals(4000L, later.getLifeCycle().getUpdated().getTimestamp());
    var missing = put(request.withLifeCycle(new LifeCycle()));
    assertEquals(later.getLifeCycle(), missing.getLifeCycle());
    assertEquals(original.getId(), missing.getId());
    assertEquals(original.getVersion(), missing.getVersion());
  }

  @Test
  void placeholderWritesCannotReplaceKnownSourceTimes(TestNamespace ns) {
    var service = DatabaseServiceTestFactory.createPostgres(ns);
    var request =
        new CreateDatabase()
            .withName(ns.prefix("placeholder-db"))
            .withService(service.getFullyQualifiedName());
    var client = SdkClients.adminClient().databases();
    var created = client.create(request.withLifeCycle(observation(-62135596800000L, -1L)));
    assertNull(created.getLifeCycle());
    var known = put(request.withLifeCycle(observation(1000L, 2000L)));
    var ignored = put(request.withLifeCycle(observation(-62135596800000L, -1L)));
    assertEquals(known.getLifeCycle(), ignored.getLifeCycle());
    var patched =
        client.patch(
            created.getId(),
            JsonUtils.readTree(
                "[{\"op\":\"replace\",\"path\":\"/lifeCycle\",\"value\":{\"created\":{\"timestamp\":-62135596800000}}}]"));
    assertEquals(known.getLifeCycle(), patched.getLifeCycle());
    assertEquals(known.getLifeCycle(), client.get(created.getId().toString()).getLifeCycle());
    assertEquals(created.getId(), patched.getId());
    assertEquals(created.getVersion(), patched.getVersion());
    var removed =
        client.patch(
            created.getId(), JsonUtils.readTree("[{\"op\":\"remove\",\"path\":\"/lifeCycle\"}]"));
    assertNull(removed.getLifeCycle());
  }

  private Database put(CreateDatabase request) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/databases", request, Database.class);
  }

  private LifeCycle observation(long created, long updated) {
    return new LifeCycle()
        .withCreated(
            new AccessDetails().withTimestamp(created).withAccessedByAProcess("source-" + created))
        .withUpdated(new AccessDetails().withTimestamp(updated));
  }
}
