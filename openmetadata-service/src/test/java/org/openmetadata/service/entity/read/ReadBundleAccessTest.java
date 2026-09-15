package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.Entity;

class ReadBundleAccessTest {
  @Test
  void missingEntitiesDoNotReadTheBundleOrRecordFallbacks() {
    final ReadBundleAccess access =
        new ReadBundleAccess(
            Entity.TABLE,
            () -> {
              throw new AssertionError("unexpected bundle read");
            },
            (field, reason) -> {
              throw new AssertionError(reason);
            });
    assertTrue(access.relations(null, Entity.FIELD_OWNERS, ALL).isEmpty());
    assertTrue(access.relations(new Table(), Entity.FIELD_OWNERS, ALL).isEmpty());
    assertTrue(access.votes(null).isEmpty());
    assertTrue(access.votes(new Table()).isEmpty());
  }

  @Test
  void absentBundlesRecordTheExistingFieldSpecificReason() {
    final List<String> fallbacks = new ArrayList<>();
    final ReadBundleAccess access =
        new ReadBundleAccess(
            Entity.TABLE, () -> null, (field, reason) -> fallbacks.add(field + ":" + reason));
    final Table table = new Table().withId(UUID.randomUUID());
    assertTrue(access.relations(table, Entity.FIELD_OWNERS, ALL).isEmpty());
    assertTrue(access.votes(table).isEmpty());
    assertEquals(List.of("owners:no_bundle", "votes:no_bundle"), fallbacks);
  }

  @Test
  void loadedEmptyValuesAndNullIncludesKeepTheirCoverage() {
    final ReadBundle bundle = new ReadBundle();
    final Table table = new Table().withId(UUID.randomUUID());
    final Votes votes = new Votes().withUpVotes(2);
    bundle.putRelations(table.getId(), Entity.FIELD_OWNERS, ALL, null);
    bundle.putVotes(table.getId(), votes);
    final ReadBundleAccess access =
        new ReadBundleAccess(
            Entity.TABLE,
            () -> bundle,
            (field, reason) -> {
              throw new AssertionError(reason);
            });
    assertEquals(List.of(), access.relations(table, Entity.FIELD_OWNERS, null).orElseThrow());
    assertSame(votes, access.votes(table).orElseThrow());
  }

  @Test
  void includeMismatchesAndMissingFieldsHaveDistinctFallbackReasons() {
    final ReadBundle bundle = new ReadBundle();
    final Table table = new Table().withId(UUID.randomUUID());
    final List<String> fallbacks = new ArrayList<>();
    bundle.putRelations(
        table.getId(),
        Entity.FIELD_OWNERS,
        NON_DELETED,
        List.of(new EntityReference().withId(UUID.randomUUID())));
    final ReadBundleAccess access =
        new ReadBundleAccess(
            Entity.TABLE, () -> bundle, (field, reason) -> fallbacks.add(field + ":" + reason));
    assertTrue(access.relations(table, Entity.FIELD_OWNERS, ALL).isEmpty());
    assertTrue(access.relations(table, Entity.FIELD_DOMAINS, ALL).isEmpty());
    assertTrue(access.votes(table).isEmpty());
    assertEquals(
        List.of("owners:include_mismatch", "domains:not_loaded", "votes:not_loaded"), fallbacks);
  }
}
