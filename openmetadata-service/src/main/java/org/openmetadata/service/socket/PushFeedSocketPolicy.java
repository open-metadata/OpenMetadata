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

import java.time.Clock;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;

/**
 * What {@link WebSocketManager} judges an open socket against.
 *
 * @param appliedProvider the provider the handshake filter validates under. A reload publishes its
 *     configuration before it initializes the new authenticator and rolls back if that fails, so
 *     this follows the filter, which only a reload that succeeded replaces
 * @param clock what a socket's token expiry is compared with
 * @param isUserGone whether a socket's user was deleted; asked by the sweep
 * @param notifyPeersAccessEnded tells the other servers to close a deleted user's sockets
 */
public record PushFeedSocketPolicy(
    Supplier<AuthProvider> appliedProvider,
    Clock clock,
    Predicate<UUID> isUserGone,
    Consumer<UUID> notifyPeersAccessEnded) {

  /** Judges sockets against {@code appliedProvider} only: no user is gone and no peer is told. */
  public static PushFeedSocketPolicy validatingUnder(Supplier<AuthProvider> appliedProvider) {
    return new PushFeedSocketPolicy(
        appliedProvider, Clock.systemUTC(), userId -> false, userId -> {});
  }
}
