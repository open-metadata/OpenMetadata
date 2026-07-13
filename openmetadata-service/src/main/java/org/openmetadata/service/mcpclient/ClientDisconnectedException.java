/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service.mcpclient;

import java.io.IOException;

/**
 * Raised when writing to the SSE output stream fails, indicating the client has disconnected. The
 * chat loop uses this to stop issuing further (billable) LLM calls and to skip writes to the now
 * broken stream.
 */
public class ClientDisconnectedException extends RuntimeException {
  public ClientDisconnectedException(String message, IOException cause) {
    super(message, cause);
  }
}
