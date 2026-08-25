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

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Response shape for an async restore request. Returned with HTTP 202 when a client passes
 * {@code async=true} to the restore endpoint. The {@code jobId} can be used to correlate
 * subsequent WebSocket notifications on
 * {@link org.openmetadata.service.socket.WebSocketManager#RESTORE_ENTITY_CHANNEL}.
 */
@NoArgsConstructor
public class RestoreEntityResponse {
  @Getter @Setter private String jobId;
  @Getter @Setter private String message;

  public RestoreEntityResponse(String jobId, String message) {
    this.jobId = jobId;
    this.message = message;
  }
}
