package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.util.FreshReadScope;

@Isolated("Counts SQL while resolving query creation owners")
@ExtendWith(TestNamespaceExtension.class)
class QueryOwnershipPolicyIT {
  @Test
  void tableOwnerReadsAreBatchedAndReusedAcrossPolicyConditions(final TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts the embedded server's SQL statements");
    final var owner = UserTestFactory.createUser(ns, "query_owner").getEntityReference();
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    schema.setOwners(List.of(owner));
    SdkClients.adminClient().databaseSchemas().update(schema.getId(), schema);
    final var tables =
        IntStream.range(0, 24)
            .mapToObj(
                index ->
                    TableTestFactory.createWithName(
                            ns, schema.getFullyQualifiedName(), "table" + index)
                        .getEntityReference())
            .toList();
    final var query = new Query().withService(schema.getService());
    final int singleReads = ownershipReads(query.withQueryUsedIn(tables.subList(0, 1)), owner);
    final int batchReads = ownershipReads(query.withQueryUsedIn(tables), owner);

    assertTrue(singleReads > 0, "The counter must observe persisted table ownership reads");
    assertEquals(singleReads, batchReads, "Ownership reads must not grow once per table");
  }

  private static int ownershipReads(final Query query, final EntityReference owner) {
    try (var fresh = FreshReadScope.enter();
        var bypass = EntityCacheBypass.skip();
        var counter = new SqlQueryCounter(Entity.getJdbi(), "select")) {
      final var context = new CreateResourceContext<>(Entity.QUERY, query);
      final int parentReads = counter.count();
      final var owners = context.getOwners();
      assertTrue(owners.stream().anyMatch(actual -> owner.getId().equals(actual.getId())));
      final int reads = counter.count();
      assertEquals(owners, context.getOwners());
      assertEquals(reads, counter.count(), "Repeated policy conditions must reuse table owners");
      return reads - parentReads;
    }
  }
}
