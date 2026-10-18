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

import java.lang.reflect.Method;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import org.jdbi.v3.sqlobject.Handler;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionWithIdAndSchemaObject;

/** Captures extension-only changes, including custom properties, revisions and destructive cleanup. */
public final class ExtensionMutationCapture implements CaptureDecorator {
  private final ProjectionJournal journal;
  private final ExtensionSnapshotStore snapshots;

  public ExtensionMutationCapture(
      final ProjectionJournal journal, final ExtensionSnapshotStore snapshots) {
    this.journal = Objects.requireNonNull(journal);
    this.snapshots = Objects.requireNonNull(snapshots);
  }

  @Override
  public Handler decorateHandler(final Handler base, final Class<?> type, final Method method) {
    if (!EntityExtensionDAO.class.isAssignableFrom(type) || method.isDefault()) {
      return base;
    }
    if (method.getDeclaringClass() != EntityExtensionDAO.class) {
      return CaptureWritePolicy.unsupportedWriteOrRead(base, method);
    }
    return switch (method.getName()) {
        // One statement applies all or nothing, and its capture only buffers facts.
      case "insert", "delete", "deleteAll" -> capture(
          base, CaptureTransaction::executeBuffered, arguments -> List.of((UUID) arguments[0]));
      case "deleteAllBatchInternal", "deleteByJsonSchemaBatchInternal" -> capture(
          base, CaptureTransaction::executeBuffered, arguments -> owners((List<?>) arguments[0]));
        // A JDBC batch can fail after some of its statements applied; its savepoint undoes them.
      case "insertMany" -> capture(
          base, CaptureTransaction::execute, ExtensionMutationCapture::insertedOwners);
      case "incrementRevisions" -> capture(
          base, CaptureTransaction::execute, arguments -> owners((List<?>) arguments[0]));
      case "bulkUpsertExtensionsInternal" -> capture(
          base, CaptureTransaction::execute, ExtensionMutationCapture::upsertedOwners);
      case "deleteExtension" -> deleteExtension();
      default -> CaptureWritePolicy.unsupportedWriteOrRead(base, method);
    };
  }

  private Handler capture(
      final Handler base,
      final CaptureTransaction.Boundary boundary,
      final Function<Object[], List<UUID>> owners) {
    return (target, arguments, supplier) ->
        boundary.run(
            supplier.getHandle(),
            handle -> {
              final Object result = base.invoke(target, arguments, supplier);
              journal.captureDeferred(
                  handle,
                  owners.apply(arguments).stream()
                      .distinct()
                      .map(id -> new ExtensionMutation(1, id))
                      .toList());
              return result;
            });
  }

  private Handler deleteExtension() {
    return (target, arguments, supplier) ->
        CaptureTransaction.execute(
            supplier.getHandle(),
            handle -> {
              snapshots.delete(handle, (String) arguments[0]);
              return null;
            });
  }

  private static List<UUID> insertedOwners(final Object[] arguments) {
    final List<?> ids = (List<?>) arguments[0];
    final int size =
        Math.min(
            ids.size(), Math.min(((List<?>) arguments[1]).size(), ((List<?>) arguments[3]).size()));
    return owners(ids.subList(0, size));
  }

  private static List<UUID> owners(final List<?> values) {
    return values.stream().map(value -> UUID.fromString(value.toString())).toList();
  }

  private static List<UUID> upsertedOwners(final Object[] arguments) {
    return ((List<?>) arguments[0])
        .stream()
            .map(ExtensionWithIdAndSchemaObject.class::cast)
            .map(extension -> UUID.fromString(extension.getId()))
            .toList();
  }
}
