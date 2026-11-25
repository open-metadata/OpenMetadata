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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import jakarta.ws.rs.core.Response;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EventType;

class RestUtilPendingChangeHeaderTest {
  @Test
  void patchResponseCarriesPendingChangeHeader() {
    UUID id = UUID.randomUUID();
    Response response =
        new RestUtil.PatchResponse<>(Response.Status.OK, null, EventType.ENTITY_NO_CHANGE, id)
            .toResponse();
    assertEquals(id.toString(), response.getHeaderString(RestUtil.PENDING_CHANGE_HEADER));
    assertEquals(
        EventType.ENTITY_NO_CHANGE.value(),
        response.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER));
  }

  @Test
  void ordinaryPatchResponseHasNoPendingHeader() {
    Response response =
        new RestUtil.PatchResponse<>(Response.Status.OK, null, EventType.ENTITY_UPDATED)
            .toResponse();
    assertNull(response.getHeaderString(RestUtil.PENDING_CHANGE_HEADER));
  }

  @Test
  void putResponseCarriesPendingChangeHeader() {
    UUID id = UUID.randomUUID();
    Response response =
        new RestUtil.PutResponse<>(Response.Status.OK, "entity", EventType.ENTITY_NO_CHANGE)
            .withPendingChangeRequestId(id)
            .toResponse();
    assertEquals(id.toString(), response.getHeaderString(RestUtil.PENDING_CHANGE_HEADER));
  }
}
