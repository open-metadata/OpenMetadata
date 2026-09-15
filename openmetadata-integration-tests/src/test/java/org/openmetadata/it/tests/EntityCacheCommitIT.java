package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.policies.accessControl.Rule.Effect;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.cache.EntityCacheKeys;
import org.openmetadata.service.entity.cache.EntityCaches;

/** Exercises a concurrent cache refill from the committed row while its replacement is uncommitted. */
@Isolated("Temporarily decorates the application's transaction handler")
@ExtendWith(TestNamespaceExtension.class)
class EntityCacheCommitIT {
  private static final String BEFORE = "before commit";
  private static final String AFTER = "after commit";

  @ParameterizedTest
  @CsvSource({"policy,false", "policy,true", "domain,false", "domain,true"})
  void indirectWritesPublishOnlyTheOwningCommit(String type, boolean rollback, TestNamespace ns) {
    final EntityInterface entity = create(type, rollback, ns);
    assertTransaction(() -> change(type, entity, rollback), rollback);
    assertCachedDescription(type, entity, rollback ? BEFORE : AFTER);
    final var repository = Entity.getEntityRepository(type);
    final EntityInterface stored = repository.lookup().byId(entity.getId(), Include.ALL, false);
    assertEquals(rollback ? BEFORE : AFTER, stored.getDescription());
  }

  private void change(String type, EntityInterface entity, boolean rollback) {
    final var repository = Entity.getEntityRepository(type);
    repository.executeInTransaction(
        () -> {
          final var dao = repository.getDao();
          final EntityInterface replacement =
              JsonUtils.readValue(
                  dao.findJsonByIdForUpdate(entity.getId(), Include.ALL),
                  repository.getEntityClass());
          replacement.setDescription(AFTER);
          dao.update(replacement);
          EntityCaches.invalidations()
              .referencesChanged(type, entity.getId(), entity.getFullyQualifiedName());
          CompletableFuture.runAsync(() -> assertCachedDescription(type, entity, BEFORE))
              .orTimeout(10, TimeUnit.SECONDS)
              .join();
          if (rollback) {
            throw new IllegalStateException("Discard the replacement");
          }
          return null;
        });
  }

  private void assertTransaction(Runnable mutation, boolean rollback) {
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      if (rollback) {
        assertThrows(IllegalStateException.class, mutation::run);
      } else {
        mutation.run();
      }
      assertEquals(rollback ? 0 : 1, transactions.commits());
      assertEquals(rollback ? 1 : 0, transactions.rollbacks());
    }
  }

  private void assertCachedDescription(String type, EntityInterface entity, String expected) {
    final String byId = EntityCaches.byId().getUnchecked(EntityCacheKeys.id(type, entity.getId()));
    final String byName =
        EntityCaches.byName()
            .getUnchecked(EntityCacheKeys.name(type, entity.getFullyQualifiedName()));
    assertEquals(expected, JsonUtils.readTree(byId).get(Entity.FIELD_DESCRIPTION).asText());
    assertEquals(expected, JsonUtils.readTree(byName).get(Entity.FIELD_DESCRIPTION).asText());
  }

  private EntityInterface create(String type, boolean rollback, TestNamespace ns) {
    return Entity.POLICY.equals(type)
        ? SdkClients.adminClient()
            .policies()
            .create(
                new CreatePolicy()
                    .withName(ns.prefix("commitPolicy" + rollback))
                    .withDescription(BEFORE)
                    .withRules(
                        List.of(
                            new Rule()
                                .withName("description")
                                .withResources(List.of("All"))
                                .withOperations(List.of(MetadataOperation.EDIT_DESCRIPTION))
                                .withEffect(Effect.ALLOW))))
        : SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("commitDomain" + rollback))
                    .withDescription(BEFORE)
                    .withDomainType(DomainType.AGGREGATE));
  }
}
