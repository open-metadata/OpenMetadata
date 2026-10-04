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

/**
 * Default relay for single-pod deployments (and any deployment without a cross-pod transport
 * configured). Publishing is a no-op, so {@link WebSocketManager} delivers only to local sockets —
 * the pre-relay behavior, which is correct when every socket is on this one pod.
 */
public class NoopWebSocketRelay implements WebSocketRelay {

  @Override
  public void publish(String scope, String target, String event, String message) {
    // Single-pod: the local send in WebSocketManager already reaches every socket.
  }
}
