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

package org.openmetadata.mcp.tools;

/**
 * A graph read that failed for a transient reason the caller did not cause: the projection is
 * rebuilding, the store is unreachable, or the server is at its query capacity. Classified as
 * retryable rather than as a backend fault, so the client is not told that retrying will not help.
 */
final class RdfRetryLaterException extends RuntimeException {

  RdfRetryLaterException(final String message, final Throwable cause) {
    super(message, cause);
  }
}
