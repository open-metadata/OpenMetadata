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
 * Cross-pod transport for {@link WebSocketManager#sendToOne} delivery.
 *
 * <p>A background job can run on a pod that does not hold the target user's Socket.IO session, so a
 * node-local send alone drops the frame on multi-pod deployments. A relay carries the frame to the
 * peer pods, each of which delivers it to its own local sockets for that user. Delivery is broadcast
 * (not claim/lease): a user's socket is single-homed per pod, so every pod delivering to its own
 * locals yields exactly-once per socket.
 *
 * <p>The producing pod delivers to its local sockets directly and calls {@link #publish} for the
 * peers; implementations skip their own messages on receive so the sender does not double-deliver.
 */
public interface WebSocketRelay {

  /**
   * Publish an event to peer pods so they deliver it to their local sockets for {@code userId}.
   * Implementations receive their own and peers' messages and call
   * {@link WebSocketManager#sendToOneLocal} for delivery, skipping messages they themselves sent.
   */
  void publish(UUID userId, String event, String message);

  /** Start the transport (subscribe, spin up any dispatcher). No-op by default. */
  default void start() {}

  /** Stop the transport and release resources. No-op by default. */
  default void stop() {}
}
