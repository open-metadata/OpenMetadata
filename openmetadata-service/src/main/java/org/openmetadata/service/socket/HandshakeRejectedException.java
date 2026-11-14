/*
 *  Copyright 2021 Collate
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
 * A push-feed handshake that did not present a verifiable credential, or whose presented
 * credentials do not agree. The HTTP status the handshake must be answered with travels with it:
 * the servlet dispatch answers its response, and the WebSocket upgrade creator, which the servlet
 * filter chain never reaches, answers the upgrade itself.
 */
public final class HandshakeRejectedException extends RuntimeException {
  private final int status;

  public HandshakeRejectedException(int status, String message) {
    super(message);
    this.status = status;
  }

  public int getStatus() {
    return status;
  }
}
