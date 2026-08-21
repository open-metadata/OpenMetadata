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
package org.openmetadata.service.rdf.storage;

/**
 * Thrown when a write times out and its payload is large enough that retrying at the same size is
 * counterproductive: the client-side deadline does not cancel the server-side update, so each
 * same-size retry re-submits the full body and multiplies backend load while almost certainly
 * timing out again. Callers should split the batch (see {@code RdfBatchProcessor}'s bisect
 * fallback) instead of retrying. Small-payload timeouts stay retryable — they signal a transient
 * backend stall, not an oversized request.
 */
public class RdfPayloadTooLargeException extends RuntimeException {

  private static final long serialVersionUID = 1L;

  public RdfPayloadTooLargeException(String operation, Throwable cause) {
    super(
        "RDF write "
            + operation
            + " timed out with a large payload; not retrying at the same size — split the batch",
        cause);
  }
}
