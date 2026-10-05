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
 * Cross-pod transport behind {@link WebSocketManager}: carries a frame to the pod holding the target
 * socket (a background job may run on a different pod than the one holding it). Delivery is broadcast,
 * not claim/lease — a socket is single-homed, so each pod delivering to its own sockets is
 * exactly-once. {@code scope}+{@code target} let one transport serve USER (sendToOne) and ALL
 * (broadcast) delivery; new scopes only need a branch in {@link WebSocketManager#deliverRelayedFrame}.
 */
public interface WebSocketRelay {

  String SCOPE_USER = "USER";
  String SCOPE_ALL = "ALL";

  /** Publish a frame to peer pods; each delivers it to its own sockets. {@code target} is null for ALL. */
  void publish(String scope, String target, String event, String message);

  default void publishToUser(UUID userId, String event, String message) {
    if (userId != null) {
      publish(SCOPE_USER, userId.toString(), event, message);
    }
  }

  default void publishToAll(String event, String message) {
    publish(SCOPE_ALL, null, event, message);
  }

  default void start() {}

  default void stop() {}
}
