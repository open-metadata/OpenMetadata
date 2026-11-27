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

package org.openmetadata.service.context.review;

import jakarta.json.Json;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonException;
import jakarta.json.JsonPatch;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.util.EntityETag;
import org.openmetadata.service.util.RestUtil.PatchResponse;

/** A memory write the server makes on its own behalf, refused when the memory changed since read. */
final class GuardedMemoryPatch {

  /** Who writes and why; {@code refusal} is the message a concurrent edit fails the write with. */
  record Writer(String user, ChangeSource source, String impersonatedBy, String refusal) {}

  private GuardedMemoryPatch() {}

  /**
   * Guarded on the version and the update time read, so a concurrent edit fails the write instead
   * of being overwritten: consecutive edits by one user can keep the version.
   */
  static void apply(MemoryChange change, Writer writer) {
    ContextMemory before = change.before();
    JsonArrayBuilder operations =
        Json.createArrayBuilder()
            .add(
                Json.createObjectBuilder()
                    .add("op", "test")
                    .add("path", "/updatedAt")
                    .add("value", before.getUpdatedAt()));
    diff(change).toJsonArray().forEach(operations::add);
    PatchResponse<ContextMemory> response;
    try {
      response =
          memoryRepository()
              .patch(
                  null,
                  before.getId(),
                  writer.user(),
                  Json.createPatch(operations.build()),
                  writer.source(),
                  EntityETag.generateWeakETag(before),
                  writer.impersonatedBy());
    } catch (JsonException changedSinceRead) {
      throw new PreconditionFailedException(writer.refusal());
    }
    memoryRepository()
        .storeChangeEventForAsyncOperation(
            response.entity(), response.changeType(), false, writer.user());
  }

  static JsonPatch diff(MemoryChange change) {
    return JsonUtils.getJsonPatch(change.before(), change.after());
  }

  private static ContextMemoryRepository memoryRepository() {
    return (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
  }
}
