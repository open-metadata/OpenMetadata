package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

class EntityOwnershipDifferenceTest {
  @Test
  void unchangedOwnerSetsReadEachInputIdOnlyOnce() {
    final Fixture fixture = new Fixture();
    fixture.writer.owners(fixture.table, fixture.references(0), fixture.references(0));
    assertEquals(0, fixture.stores);
    assertEquals(0, fixture.store.writes);
    assertTrue(fixture.idReads.get() <= 2_000, "ID reads: " + fixture.idReads.get());
  }

  @Test
  void changedOwnerSetsAvoidAnUnusedAddedReferenceListAndItsSecondScan() {
    final Fixture fixture = new Fixture();
    fixture.writer.owners(fixture.table, fixture.references(0), fixture.references(1));
    assertEquals(1, fixture.stores);
    assertEquals(1, fixture.store.writes);
    assertTrue(fixture.idReads.get() <= 3_001, "ID reads: " + fixture.idReads.get());
  }

  @Test
  void unchangedDomainsAlsoSkipTheRemovedReferenceScan() {
    final Fixture fixture = new Fixture();
    fixture.writer.domains(
        fixture.table, () -> fixture.table.getId(), fixture.references(0), fixture.references(0));
    assertEquals(0, fixture.stores);
    assertTrue(fixture.idReads.get() <= 2_000, "ID reads: " + fixture.idReads.get());
  }

  private static final class Fixture {
    private final AtomicInteger idReads = new AtomicInteger();
    private final Table table = new Table().withId(UUID.randomUUID());
    private final RelationshipStoreFixture store = new RelationshipStoreFixture();
    private int stores;
    private final EntityOwnershipWriter<Table> writer =
        new EntityOwnershipWriter<>(
            Entity.TABLE,
            () -> store.dao,
            store.writer(),
            new EntityOwnershipWriter.Writes<>(
                (entity, refs) -> stores++, (entity, refs) -> stores++, (id, domain) -> {}));

    private List<EntityReference> references(final int first) {
      return IntStream.range(first, first + 1_000)
          .mapToObj(id -> new CountingReference(new UUID(0, id), idReads).withType(Entity.USER))
          .toList();
    }
  }

  private static final class CountingReference extends EntityReference {
    private final AtomicInteger reads;

    private CountingReference(final UUID id, final AtomicInteger reads) {
      setId(id);
      this.reads = reads;
    }

    @Override
    public UUID getId() {
      reads.incrementAndGet();
      return super.getId();
    }
  }
}
