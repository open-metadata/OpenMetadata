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

package org.openmetadata.service.rdf.agent;

import java.util.Objects;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.schema.api.rdf.RdfProjectionState;

/** A failure of the agent SPARQL endpoint, carrying its stable wire code. */
public final class AgentSparqlException extends RuntimeException {
  private final AgentSparqlErrorCode code;
  private final String requestId;
  private final RdfProjectionState projectionState;

  public AgentSparqlException(final AgentSparqlErrorCode code, final String message) {
    this(code, message, null, null, null);
  }

  public AgentSparqlException(
      final AgentSparqlErrorCode code, final String message, final Throwable cause) {
    this(code, message, cause, null, null);
  }

  private AgentSparqlException(
      final AgentSparqlErrorCode code,
      final String message,
      final Throwable cause,
      final String requestId,
      final RdfProjectionState projectionState) {
    super(message, cause);
    this.code = Objects.requireNonNull(code);
    this.requestId = requestId;
    this.projectionState = projectionState;
  }

  /**
   * The projection is not {@code READY}. {@code state} is what the resolver reported, or {@code
   * null} when it could not be determined; callers use it to tell a rebuild that will finish from a
   * degraded projection that stays down until an administrator runs a full rebuild.
   */
  public static AgentSparqlException projectionNotReady(
      final RdfProjectionState state, final String message, final Throwable cause) {
    return new AgentSparqlException(
        AgentSparqlErrorCode.PROJECTION_NOT_READY, message, cause, null, state);
  }

  /** The same failure, attributed to the request whose audit event already logged it. */
  public AgentSparqlException forRequest(final String requestId) {
    return new AgentSparqlException(code, getMessage(), getCause(), requestId, projectionState);
  }

  public AgentSparqlErrorCode getCode() {
    return code;
  }

  /** The projection state behind a {@code PROJECTION_NOT_READY}, or {@code null} when unknown. */
  public RdfProjectionState getProjectionState() {
    return projectionState;
  }

  /** The request id already assigned to this failure, or {@code null} for pre-resource failures. */
  public String getRequestId() {
    return requestId;
  }
}
