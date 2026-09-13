package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.PIPELINE;
import static org.openmetadata.service.util.EntityUtil.objectMatch;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityChangeRecordingTest {

  @Test
  void unchangedJsonValuesDoNotSerialize() {
    final var updater = new TestRepository().updater();
    final var reads = new AtomicInteger();
    assertFalse(
        updater.recordChange(
            FIELD_DESCRIPTION,
            new TrackedValue("same", reads),
            new TrackedValue("same", reads),
            true,
            (left, right) -> left.value.equals(right.value)));
    assertEquals(0, reads.get());
    assertFalse(updater.isEntityChanged());
    assertFalse(updater.fieldsChanged());
  }

  @Test
  void changedJsonValuesAreSerializedOnceEach() {
    final var updater = new TestRepository().updater();
    final var reads = new AtomicInteger();
    assertTrue(
        updater.recordChange(
            FIELD_DESCRIPTION,
            new TrackedValue("before", reads),
            new TrackedValue("after", reads),
            true,
            (left, right) -> left.value.equals(right.value)));
    assertEquals(2, reads.get());
    final var change = updater.getChangeDescription().getFieldsUpdated().getFirst();
    assertEquals("{\"value\":\"before\"}", change.getOldValue());
    assertEquals("{\"value\":\"after\"}", change.getNewValue());
    assertTrue(updater.isEntityChanged());
  }

  @Test
  void unversionedChangesDoNotSerializeValuesTheyDoNotRecord() {
    final var updater = new TestRepository().updater();
    final var reads = new AtomicInteger();
    assertTrue(
        updater.recordChange(
            FIELD_DESCRIPTION,
            new TrackedValue("before", reads),
            new TrackedValue("after", reads),
            true,
            (left, right) -> left.value.equals(right.value),
            false));
    assertEquals(0, reads.get());
    assertTrue(updater.isEntityChanged());
    assertFalse(updater.fieldsChanged());
  }

  @Test
  void excludedFieldsAndAlreadyChangedUnversionedValuesRemainNoOps() {
    final var updater = new TestRepository().updater();
    updater.setPatchedFields(Set.of("owners"));
    assertFalse(updater.recordChange(FIELD_DESCRIPTION, "before", "after"));
    assertFalse(updater.isEntityChanged());
    updater.setPatchedFields(null);
    assertTrue(updater.recordChange(FIELD_DESCRIPTION, "before", "after"));
    assertFalse(updater.recordChange("lifeCycle", 1, 2, true, objectMatch, false));
    assertEquals(1, updater.getChangeDescription().getFieldsUpdated().size());
  }

  @Test
  void scalarAdditionsDeletionsAndNullsKeepTheirRepresentation() {
    final var updater = new TestRepository().updater();
    assertFalse(updater.recordChange("empty", null, null));
    assertTrue(updater.recordChange("added", null, 7));
    assertTrue(updater.recordChange("deleted", 8, null));
    assertEquals(7, updater.getChangeDescription().getFieldsAdded().getFirst().getNewValue());
    assertEquals(8, updater.getChangeDescription().getFieldsDeleted().getFirst().getOldValue());
  }

  @Test
  void customEqualitySuppressesChanges() {
    final var updater = new TestRepository().updater();
    assertFalse(updater.recordChange(FIELD_DESCRIPTION, "A", "a", false, String::equalsIgnoreCase));
    assertFalse(updater.fieldsChanged());
    assertFalse(updater.isEntityChanged());
  }

  @Test
  void listChangesPreserveDuplicatesAndInputOrder() {
    final var updater = new TestRepository().updater();
    final List<String> added = new ArrayList<>();
    final List<String> deleted = new ArrayList<>();
    assertTrue(
        updater.recordListChange(
            "owners",
            List.of("keep", "old", "old"),
            List.of("new", "keep", "new"),
            added,
            deleted,
            String::equals));
    assertEquals(List.of("new", "new"), added);
    assertEquals(List.of("old", "old"), deleted);
    assertEquals(
        "[\"new\",\"new\"]",
        updater.getChangeDescription().getFieldsAdded().getFirst().getNewValue());
    assertEquals(
        "[\"old\",\"old\"]",
        updater.getChangeDescription().getFieldsDeleted().getFirst().getOldValue());
    assertFalse(updater.isEntityChanged());
  }

  @Test
  void listComparisonPreservesCallerAccumulatorsAndNullInputs() {
    final var updater = new TestRepository().updater();
    final List<String> added = new ArrayList<>(List.of("existing"));
    final List<String> deleted = new ArrayList<>();
    assertTrue(updater.recordListChange("owners", null, null, added, deleted, String::equals));
    assertEquals(List.of("existing"), added);
    assertTrue(deleted.isEmpty());
    assertEquals(
        "[\"existing\"]", updater.getChangeDescription().getFieldsAdded().getFirst().getNewValue());
  }

  private static final class TrackedValue {

    private final String value;

    private final AtomicInteger reads;

    private TrackedValue(String value, AtomicInteger reads) {
      this.value = value;
      this.reads = reads;
    }

    @JsonProperty("value")
    public String value() {
      reads.incrementAndGet();
      return value;
    }
  }

  @Repository()
  private static final class TestRepository implements EntityPolicy<Pipeline> {

    private TestRepository() {
      this.entityContext =
          new EntityPolicyContext<>(
              new EntityPolicyContext.Schema<>(
                  "pipelines", PIPELINE, Pipeline.class, mock(CollectionDAO.PipelineDAO.class)),
              new EntityPolicyContext.WriteFields(FIELD_DESCRIPTION, FIELD_DESCRIPTION, Set.of()),
              EntityModuleDependencies.standard());
      EntityModuleFactory.initialize(this, false);
    }

    private EntityUpdater<Pipeline> updater() {
      final var updater =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(
                  new Pipeline().withId(UUID.randomUUID()).withVersion(1.0),
                  new Pipeline().withUpdatedBy("admin"),
                  EntityOperation.PUT,
                  null,
                  false));
      updater.setChangeDescription(new ChangeDescription());
      return updater;
    }

    @Override
    public void setFields(Pipeline entity, Fields fields, RelationIncludes includes) {}

    @Override
    public void clearFields(Pipeline entity, Fields fields) {}

    @Override
    public void prepare(Pipeline entity, boolean update) {}

    @Override
    public void storeEntity(Pipeline entity, boolean update) {}

    @Override
    public void storeRelationships(Pipeline entity) {}

    private final EntityPolicyContext<Pipeline> entityContext;

    @Override
    public final EntityPolicyContext<Pipeline> context() {
      return entityContext;
    }
  }
}
