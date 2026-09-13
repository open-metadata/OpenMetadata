package org.openmetadata.service.entity.policy;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Clock;
import java.util.Set;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityMutationPolicyTest {
  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void absentLifecycleStatusStartsUnprocessed(final boolean update) {
    final Table entity = new Table().withEntityStatus(null);

    policy().setDefaultStatus(entity, update);

    assertEquals(EntityStatus.UNPROCESSED, entity.getEntityStatus());
  }

  @ParameterizedTest
  @EnumSource(EntityStatus.class)
  void explicitLifecycleStatusIsRetained(final EntityStatus status) {
    final Table entity = new Table().withEntityStatus(status);

    policy().setDefaultStatus(entity, false);

    assertEquals(status, entity.getEntityStatus());
  }

  private static FlatPolicy policy() {
    final var context =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>("/tables", "table", Table.class, null),
            new EntityPolicyContext.WriteFields("", "", Set.of()),
            new EntityModuleDependencies(null, null, null, null, Clock.systemUTC()));
    final var policy = new FlatPolicy(context);
    context.bind(policy);
    return policy;
  }

  private record FlatPolicy(EntityPolicyContext<Table> context) implements EntityPolicy<Table> {
    @Override
    public void setFields(Table entity, Fields fields, RelationIncludes includes) {}

    @Override
    public void clearFields(Table entity, Fields fields) {}

    @Override
    public void prepare(Table entity, boolean update) {}

    @Override
    public void storeEntity(Table entity, boolean update) {}

    @Override
    public void storeRelationships(Table entity) {}
  }
}
