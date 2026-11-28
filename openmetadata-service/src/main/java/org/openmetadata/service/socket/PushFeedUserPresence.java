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

package org.openmetadata.service.socket;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Whether the user behind a push-feed socket still exists, for the sweep that closes the sockets
 * of a deleted user on a server the delete never reached
 * (ADR:2026-11-26-a-push-feed-socket-without-a-session-ends-when-its-token-expires-or-its-user-is-deleted).
 */
@Slf4j
public final class PushFeedUserPresence {
  private PushFeedUserPresence() {}

  /**
   * True only when the user is hard or soft deleted. A lookup that fails for another reason is not
   * a deletion: the sockets stay, and the next sweep asks again.
   */
  public static boolean isGone(UUID userId) {
    boolean gone;
    try {
      Entity.getEntityReferenceById(Entity.USER, userId, Include.NON_DELETED);
      gone = false;
    } catch (EntityNotFoundException notFound) {
      gone = true;
    } catch (RuntimeException lookupFailure) {
      LOG.warn(
          "Could not check whether user {} still exists; keeping their push-feed sockets until the"
              + " next sweep",
          userId,
          lookupFailure);
      gone = false;
    }
    return gone;
  }
}
