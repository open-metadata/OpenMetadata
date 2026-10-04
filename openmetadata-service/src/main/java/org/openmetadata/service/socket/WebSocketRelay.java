/*
 *  Copyright 2026 Collate.
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

/**
 * Cross-pod transport for {@link WebSocketManager} delivery.
 *
 * <p>A background job can run on a pod that does not hold the target socket, so a node-local send
 * alone drops the frame on multi-pod deployments. A relay carries the frame to the peer pods, each of
 * which delivers it to its own local sockets. Delivery is broadcast (not claim/lease): a socket is
 * single-homed per pod, so every pod delivering to its own locals yields exactly-once per socket.
 *
 * <p>Generic by design so one transport (and, for the DB backend, one table) serves every delivery
 * pattern via a {@code scope} + {@code target}:
 *
 * <ul>
 *   <li>{@link #SCOPE_USER} + a userId → {@code sendToOne} (targeted)
 *   <li>{@link #SCOPE_ALL} + {@code null} → {@code broadCastMessageToAll} (every connected user)
 * </ul>
 *
 * New scopes (e.g. a team or role fan-out) can be added later without a schema or interface change —
 * publish a new scope value and handle it in {@link WebSocketManager#deliverRelayedFrame}.
 */
public interface WebSocketRelay {

  String SCOPE_USER = "USER";
  String SCOPE_ALL = "ALL";

  /**
   * Publish a frame to peer pods so they deliver it to their local sockets. Implementations receive
   * their own and peers' frames and hand them to {@link WebSocketManager#deliverRelayedFrame},
   * skipping frames they themselves sent so the sender does not double-deliver.
   *
   * @param scope delivery scope — {@link #SCOPE_USER}, {@link #SCOPE_ALL}, or a future value
   * @param target recipient id for a scoped delivery (a userId for {@link #SCOPE_USER}); null for
   *     {@link #SCOPE_ALL}
   */
  void publish(String scope, String target, String event, String message);

  /** Targeted delivery to one user's sockets (the {@code sendToOne} path). */
  default void publishToUser(UUID userId, String event, String message) {
    if (userId != null) {
      publish(SCOPE_USER, userId.toString(), event, message);
    }
  }

  /** Fan-out to every connected user's sockets (the {@code broadCastMessageToAll} path). */
  default void publishToAll(String event, String message) {
    publish(SCOPE_ALL, null, event, message);
  }

  /** Start the transport (subscribe, spin up any dispatcher). No-op by default. */
  default void start() {}

  /** Stop the transport and release resources. No-op by default. */
  default void stop() {}
}
