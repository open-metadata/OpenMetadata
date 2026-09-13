package org.openmetadata.service.entity.metadata;

import static org.mockito.Mockito.mock;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.mockito.invocation.InvocationOnMock;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

final class RelationshipStoreFixture {
  final List<EntityRelationshipObject> rows = new ArrayList<>();
  final List<EntityRelationshipObject> insertOrder = new ArrayList<>();
  final List<EntityRelationship> rdf = new ArrayList<>();
  final List<String> invalidated = new ArrayList<>();
  final List<Integer> deletionSizes = new ArrayList<>();
  final EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class, this::execute);
  int writes;
  RuntimeException failure;

  EntityRelationshipWriter writer() {
    return new EntityRelationshipWriter(
        () -> dao,
        new EntityRelationshipWriter.Effects(
            rdf::add, rdf::remove, (type, id) -> invalidated.add(type + ":" + id)));
  }

  private Object execute(final InvocationOnMock call) throws Throwable {
    if (call.getMethod().isDefault()) {
      return call.callRealMethod();
    }
    if (failure != null) {
      throw failure;
    }
    writes++;
    return switch (call.getMethod().getName()) {
      case "insert" -> insert(call);
      case "bulkInsertTo" -> insertMany(call.getArgument(0));
      case "delete" -> delete(call);
      case "deleteTo" -> deleteIncoming(call);
      case "deleteFrom" -> deleteOutgoing(call);
      case "deleteToMany" -> deleteMany(call, true);
      case "deleteFromMany" -> deleteMany(call, false);
      case "bulkRemoveTo" -> removeOutgoing(call);
      case "bulkRemoveFrom" -> removeIncoming(call);
      default -> throw new UnsupportedOperationException(call.getMethod().toString());
    };
  }

  private Object deleteMany(final InvocationOnMock call, final boolean incoming) {
    final List<String> ids = call.getArgument(0);
    deletionSizes.add(ids.size());
    rows.removeIf(
        row ->
            ids.contains(incoming ? row.getToId() : row.getFromId())
                && Objects.equals(
                    incoming ? row.getToEntity() : row.getFromEntity(), call.getArgument(1))
                && row.getRelation() == (int) call.getArgument(2)
                && (call.getArguments().length == 3
                    || Objects.equals(
                        incoming ? row.getFromEntity() : row.getToEntity(), call.getArgument(3))));
    return null;
  }

  private Object insert(final InvocationOnMock call) {
    add(
        EntityRelationshipObject.builder()
            .fromId(call.getArgument(0).toString())
            .toId(call.getArgument(1).toString())
            .fromEntity(call.getArgument(2))
            .toEntity(call.getArgument(3))
            .relation(call.getArgument(4))
            .relationType(call.getArgument(5))
            .json(call.getArgument(6))
            .build());
    return null;
  }

  private Object insertMany(final List<EntityRelationshipObject> batch) {
    batch.forEach(this::add);
    return null;
  }

  private void add(final EntityRelationshipObject row) {
    rows.removeIf(
        existing ->
            existing.getFromId().equals(row.getFromId())
                && existing.getToId().equals(row.getToId())
                && existing.getRelation() == row.getRelation()
                && Objects.equals(existing.getRelationType(), row.getRelationType()));
    rows.add(row);
    insertOrder.add(row);
  }

  private int delete(final InvocationOnMock call) {
    final int before = rows.size();
    rows.removeIf(
        row ->
            matchesFrom(row, call.getArgument(0), call.getArgument(1))
                && matchesTo(row, call.getArgument(2), call.getArgument(3))
                && row.getRelation() == (int) call.getArgument(4));
    return before - rows.size();
  }

  private Object deleteIncoming(final InvocationOnMock call) {
    rows.removeIf(
        row ->
            matchesTo(row, call.getArgument(0), call.getArgument(1))
                && row.getRelation() == (int) call.getArgument(2)
                && (call.getArguments().length == 3
                    || Objects.equals(row.getFromEntity(), call.getArgument(3))));
    return null;
  }

  private Object deleteOutgoing(final InvocationOnMock call) {
    rows.removeIf(
        row ->
            matchesFrom(row, call.getArgument(0), call.getArgument(1))
                && row.getRelation() == (int) call.getArgument(2)
                && Objects.equals(row.getToEntity(), call.getArgument(3)));
    return null;
  }

  private Object removeOutgoing(final InvocationOnMock call) {
    final List<String> ids = call.getArgument(1);
    rows.removeIf(
        row ->
            matchesFrom(row, call.getArgument(0), call.getArgument(2))
                && ids.contains(row.getToId())
                && Objects.equals(row.getToEntity(), call.getArgument(3))
                && row.getRelation() == (int) call.getArgument(4));
    return null;
  }

  private Object removeIncoming(final InvocationOnMock call) {
    final List<String> ids = call.getArgument(0);
    rows.removeIf(
        row ->
            ids.contains(row.getFromId())
                && Objects.equals(row.getFromEntity(), call.getArgument(2))
                && matchesTo(row, call.getArgument(1), call.getArgument(3))
                && row.getRelation() == (int) call.getArgument(4));
    return null;
  }

  private boolean matchesFrom(
      final EntityRelationshipObject row, final UUID id, final String type) {
    return row.getFromId().equals(id.toString()) && Objects.equals(row.getFromEntity(), type);
  }

  private boolean matchesTo(final EntityRelationshipObject row, final UUID id, final String type) {
    return row.getToId().equals(id.toString()) && Objects.equals(row.getToEntity(), type);
  }
}
