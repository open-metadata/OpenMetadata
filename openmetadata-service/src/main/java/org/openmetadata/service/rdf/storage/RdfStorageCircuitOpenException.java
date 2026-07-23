/*
 *  Copyright 2025 Collate
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
 * Thrown by an {@link RdfStorageInterface} implementation when its internal
 * circuit breaker is open and short-circuits a write. Callers that need to
 * differentiate this fast-fail from a real write failure should catch this
 * type explicitly — the previous implementation matched on the string
 * {@code "RDF circuit breaker is open"} in the exception message, which
 * coupled callers to a specific log phrasing.
 *
 * <p>Best-effort match: if the exception travels through a wrapper layer
 * (e.g. {@code RdfRepository.bulkCreateOrUpdate} catches and re-throws as a
 * generic {@code RuntimeException}), unwrap with {@code getCause()} before
 * deciding.
 */
public class RdfStorageCircuitOpenException extends RuntimeException {

  private static final long serialVersionUID = 1L;

  public RdfStorageCircuitOpenException(String operation) {
    super("RDF circuit breaker is open; skipping " + operation + " until storage recovers");
  }

  public RdfStorageCircuitOpenException(String operation, Throwable cause) {
    super("RDF circuit breaker is open; skipping " + operation + " until storage recovers", cause);
  }
}
