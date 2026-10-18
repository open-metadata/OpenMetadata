/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.projection;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Update;
import org.jdbi.v3.sqlobject.Handler;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.FqnPrefixRewrite;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.EntityLocatorQuery.Source;
import org.openmetadata.service.util.JsonStorageUtils;

/**
 * Captures standard EntityDAO row writes on their actual SQL handle, including autocommit callers.
 * Registration is deliberately explicit until the remaining persistence families are covered.
 */
public final class EntityMutationCapture implements CaptureDecorator {
  private static final int CAPTURE_BATCH_SIZE = EntityLocatorQuery.PAGE_SIZE;
  private static final Map<String, Shape> SHAPES =
      Map.of(
          "insert",
          Shape.INSERT,
          "insertMany",
          Shape.INSERT_BATCH,
          "update",
          Shape.UPDATE,
          "updateMany",
          Shape.UPDATE_BATCH,
          "updateWithVersion",
          Shape.CONDITIONAL_UPDATE,
          "updateIfMatches",
          Shape.CONDITIONAL_UPDATE,
          "delete",
          Shape.DELETE,
          "deleteByIds",
          Shape.DELETE_BATCH);
  private static final String SAME_NAME_PREDICATE = " AND <nameHashColumn> = :nameHashColumnValue";
  private final ProjectionJournal journal;
  private final EntityLocatorQuery locators;
  private final ConnectionType dialect;
  private final Function<Class<?>, String> entityTypes;

  public EntityMutationCapture(
      final ProjectionJournal journal,
      final ConnectionType dialect,
      final Function<Class<?>, String> entityTypes) {
    this.journal = Objects.requireNonNull(journal);
    this.dialect = Objects.requireNonNull(dialect);
    this.entityTypes = Objects.requireNonNull(entityTypes);
    this.locators = new EntityLocatorQuery(dialect);
  }

  @Override
  public Handler decorateHandler(final Handler base, final Class<?> type, final Method method) {
    if (!EntityDAO.class.isAssignableFrom(type) || method.isDefault()) {
      return base;
    }
    if (method.getDeclaringClass() != EntityDAO.class) {
      return CaptureWritePolicy.unsupportedWriteOrRead(base, method);
    }
    if (method.getName().equals("updateFqnInternal")) {
      return captureFqnRewrite(base);
    }
    final Shape shape = SHAPES.get(method.getName());
    if (shape == null) {
      return CaptureWritePolicy.unsupportedWriteOrRead(base, method);
    }
    return switch (shape) {
      case UPDATE, CONDITIONAL_UPDATE -> pointUpdate(base, method);
        // One statement applies all or nothing, so these need no savepoint of their own.
      case INSERT, DELETE -> capture(base, shape, CaptureTransaction::executeBuffered);
        // A batch can fail after some of its statements applied; its savepoint undoes them.
      case INSERT_BATCH, UPDATE_BATCH, DELETE_BATCH -> capture(
          base, shape, CaptureTransaction::execute);
    };
  }

  private Handler capture(
      final Handler base, final Shape shape, final CaptureTransaction.Boundary boundary) {
    return (target, arguments, supplier) ->
        boundary.run(
            supplier.getHandle(),
            handle -> {
              final List<EntityMutation> facts =
                  prepare(handle, (EntityDAO<?>) target, shape, arguments);
              final Object result = base.invoke(target, arguments, supplier);
              captureInPages(handle, facts);
              return result;
            });
  }

  /**
   * Most updates keep the entity's name. Adding the unchanged name hash to the statement's own
   * predicate proves that without reading the row first. Only a rename, a missing row or a failed
   * compare-and-swap falls back to the locked before-image read and the original statement.
   */
  private Handler pointUpdate(final Handler base, final Method method) {
    final String sameNameSql = declaredSql(method) + SAME_NAME_PREDICATE;
    final SqlObjectBindings bindings = new SqlObjectBindings(method);
    return (target, arguments, supplier) ->
        CaptureTransaction.executeBuffered(
            supplier.getHandle(),
            handle -> {
              final Source source = source((EntityDAO<?>) target);
              final Upsert upsert = upsert(arguments[3], arguments[4]);
              if (updatedWithSameName(handle, bindings, sameNameSql, arguments)) {
                journal.captureDeferred(
                    handle,
                    facts(source, List.of(upsert), Map.of(upsert.storageId(), upsert.fqn())));
                return method.getReturnType() == void.class ? null : 1;
              }
              final List<EntityMutation> facts =
                  prepareUpserts(handle, source, List.of(upsert), true);
              final Object result = base.invoke(target, arguments, supplier);
              if (!Integer.valueOf(0).equals(result)) {
                journal.captureDeferred(handle, facts);
              }
              return result;
            });
  }

  private static boolean updatedWithSameName(
      final Handle handle,
      final SqlObjectBindings bindings,
      final String sql,
      final Object[] arguments) {
    final Update update = handle.createUpdate(sql);
    bindings.apply(update, arguments);
    return update.execute() > 0;
  }

  private String declaredSql(final Method method) {
    return Arrays.stream(method.getAnnotationsByType(ConnectionAwareSqlUpdate.class))
        .filter(annotation -> annotation.connectionType() == dialect)
        .map(ConnectionAwareSqlUpdate::value)
        .findFirst()
        .orElseThrow(
            () -> new IllegalStateException("No " + dialect + " statement declared for " + method));
  }

  private void captureInPages(final Handle handle, final List<EntityMutation> facts) {
    for (int offset = 0; offset < facts.size(); offset += CAPTURE_BATCH_SIZE) {
      journal.captureDeferred(
          handle, facts.subList(offset, Math.min(facts.size(), offset + CAPTURE_BATCH_SIZE)));
    }
  }

  private Source source(final EntityDAO<?> dao) {
    return new Source(dao.getTableName(), entityTypes.apply(dao.getEntityClass()));
  }

  /**
   * Runs the DAO's own single-statement rewrite and records one prefix fact. Every row the statement
   * changes is under the new prefix at commit, so expansion enumerates them from committed state;
   * the request transaction does no per-descendant work beyond the uncaptured baseline.
   */
  private Handler captureFqnRewrite(final Handler base) {
    return (target, arguments, supplier) -> {
      final EntityDAO<?> dao = (EntityDAO<?>) target;
      if (!dao.getTableName().equals(arguments[0])) {
        throw new IllegalArgumentException("FQN rewrite table does not match its entity DAO");
      }
      final FqnPrefixRewrite rewrite = (FqnPrefixRewrite) arguments[1];
      final EntityPrefixMutation fact =
          new EntityPrefixMutation(
              1, entityTypes.apply(dao.getEntityClass()), rewrite.oldPrefix(), rewrite.newPrefix());
      return CaptureTransaction.execute(
          supplier.getHandle(),
          handle -> {
            final Object result = base.invoke(target, arguments, supplier);
            journal.captureDeferred(handle, List.of(fact));
            return result;
          });
    };
  }

  private List<EntityMutation> prepare(
      final Handle handle, final EntityDAO<?> dao, final Shape shape, final Object[] arguments) {
    final Source source = source(dao);
    return switch (shape) {
      case INSERT -> prepareUpserts(handle, source, List.of(upsert(null, arguments[3])), false);
      case UPDATE, CONDITIONAL_UPDATE -> prepareUpserts(
          handle, source, List.of(upsert(arguments[3], arguments[4])), true);
      case INSERT_BATCH -> prepareBatch(handle, source, (List<?>) arguments[3], null);
      case UPDATE_BATCH -> prepareBatch(
          handle, source, (List<?>) arguments[4], (List<?>) arguments[3]);
      case DELETE -> prepareDeletes(handle, source, List.of(arguments[1].toString()));
      case DELETE_BATCH -> prepareDeletes(
          handle, source, ((List<?>) arguments[1]).stream().map(Object::toString).toList());
    };
  }

  private List<EntityMutation> prepareBatch(
      final Handle handle, final Source source, final List<?> json, final List<?> ids) {
    final List<EntityMutation> facts = new ArrayList<>();
    for (int offset = 0; offset < json.size(); offset += CAPTURE_BATCH_SIZE) {
      final List<Upsert> page = new ArrayList<>();
      for (int i = offset; i < Math.min(json.size(), offset + CAPTURE_BATCH_SIZE); i++) {
        page.add(upsert(ids == null ? null : ids.get(i), json.get(i)));
      }
      facts.addAll(prepareUpserts(handle, source, page, ids != null));
    }
    return facts;
  }

  private static Upsert upsert(final Object id, final Object json) {
    final Locator entity =
        JsonUtils.readValue(JsonStorageUtils.sanitizeNulCharacters((String) json), Locator.class);
    final String fqn =
        entity.fullyQualifiedName() == null ? entity.name() : entity.fullyQualifiedName();
    return new Upsert(id == null ? entity.id() : UUID.fromString(id.toString()), entity.id(), fqn);
  }

  private List<EntityMutation> prepareUpserts(
      final Handle handle, final Source source, final List<Upsert> upserts, final boolean update) {
    final Map<UUID, String> before =
        update
            ? loadBefore(
                handle,
                source,
                upserts.stream().map(upsert -> upsert.storageId().toString()).toList())
            : Map.of();
    return facts(source, upserts, before);
  }

  private static List<EntityMutation> facts(
      final Source source, final List<Upsert> upserts, final Map<UUID, String> before) {
    final List<EntityMutation> facts = new ArrayList<>();
    for (final Upsert upsert : upserts) {
      facts.add(
          new EntityMutation(
              1,
              source.type(),
              upsert.storageId(),
              EntityMutation.Operation.UPSERT,
              before.get(upsert.storageId()),
              upsert.fqn()));
      if (!upsert.storageId().equals(upsert.payloadId())) {
        facts.add(
            new EntityMutation(
                1,
                source.type(),
                upsert.payloadId(),
                EntityMutation.Operation.UPSERT,
                null,
                upsert.fqn()));
      }
    }
    return facts;
  }

  private List<EntityMutation> prepareDeletes(
      final Handle handle, final Source source, final List<String> ids) {
    final List<EntityMutation> facts = new ArrayList<>();
    for (int offset = 0; offset < ids.size(); offset += CAPTURE_BATCH_SIZE) {
      final List<String> page =
          ids.subList(offset, Math.min(ids.size(), offset + CAPTURE_BATCH_SIZE));
      final Map<UUID, String> before = loadBefore(handle, source, page);
      // At READ COMMITTED, a missing row can be inserted between this read and the delete.
      // Retain every requested identity even when the preimage read found no row to lock.
      final List<EntityMutation> pageFacts =
          page.stream()
              .map(UUID::fromString)
              .distinct()
              .map(
                  id ->
                      new EntityMutation(
                          1,
                          source.type(),
                          id,
                          EntityMutation.Operation.DELETE,
                          before.get(id),
                          null))
              .toList();
      facts.addAll(pageFacts);
    }
    return facts;
  }

  private Map<UUID, String> loadBefore(
      final Handle handle, final Source source, final List<String> ids) {
    // Serialize the preimage read with the mutation. A concurrent rename must not erase a locator.
    return locators.readIds(handle, source, ids, true);
  }

  private enum Shape {
    INSERT,
    UPDATE,
    CONDITIONAL_UPDATE,
    DELETE,
    INSERT_BATCH,
    UPDATE_BATCH,
    DELETE_BATCH
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record Locator(UUID id, String name, String fullyQualifiedName) {}

  private record Upsert(UUID storageId, UUID payloadId, String fqn) {}
}
