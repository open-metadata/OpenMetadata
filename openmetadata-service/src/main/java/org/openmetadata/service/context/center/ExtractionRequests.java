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

package org.openmetadata.service.context.center;

import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.context.ExtractionAvailability;
import org.openmetadata.service.context.center.ContextProcessingEngine.ConditionalUpdateExhaustedException;

/**
 * What an Extract or Retry of one file or article answers when it cannot start, the same for both:
 * a 409 before anything is written, or a 503 once the queue refused its run, recorded as Failed
 * unless contention outlasts every budget
 * (ADR:2026-11-09-a-documents-owner-or-an-admin-starts-or-retries-its-extraction).
 */
@Slf4j
final class ExtractionRequests {
  static final String UNAVAILABLE = "Memory extraction is unavailable: %s";
  static final String ALREADY_REQUESTED =
      "This document's memories are already queued or being extracted.";
  static final String NOT_EXTRACTABLE =
      "Only a document that failed or whose memories were never extracted can be extracted.";
  static final String CHANGED =
      "The document changed while its extraction was being requested. Please retry.";
  // No retry promise: a document whose failure was not recorded answers 409 until recovered.
  static final String QUEUE_FAILED = "Memory extraction could not be queued.";

  /** Full conditional-write budgets a refused run gets to be recorded: no job is left to do it. */
  static final int FAILURE_RECORD_ROUNDS = 3;

  private ExtractionRequests() {}

  /** Refuses a request whose run the queue would not take, after trying to leave it Failed. */
  static ServiceUnavailableException queueRefused(
      String entityType, UUID id, String reason, Runnable recordFailure) {
    recordFailure(entityType, id, recordFailure);
    return new ServiceUnavailableException(reason);
  }

  /**
   * Leaves a document whose run could not be queued Failed, so the next Extract can retry it. One
   * that loses every round keeps its in-progress status, refusing Extract until it is recovered.
   */
  static void recordFailure(String entityType, UUID id, Runnable recordFailure) {
    boolean recorded = false;
    for (int round = 1; round <= FAILURE_RECORD_ROUNDS && !recorded; round++) {
      recorded = recordedDespiteContention(recordFailure);
    }
    if (!recorded) {
      LOG.error(
          "{} {} could not be marked Failed after its run could not be queued", entityType, id);
    }
  }

  private static boolean recordedDespiteContention(Runnable recordFailure) {
    boolean recorded = true;
    try {
      recordFailure.run();
    } catch (ConditionalUpdateExhaustedException e) {
      LOG.warn("Recording a run the queue refused lost to concurrent updates: {}", e.getMessage());
      recorded = false;
    }
    return recorded;
  }

  /** Refuses a request the provider cannot serve now, naming why. */
  static void requireAvailable(ExtractionAvailability availability) {
    if (!AiProviderHolder.isAvailable(availability)) {
      throw conflict(String.format(UNAVAILABLE, availability.getReason()));
    }
  }

  static WebApplicationException alreadyRequested() {
    return conflict(ALREADY_REQUESTED);
  }

  static WebApplicationException notExtractable() {
    return conflict(NOT_EXTRACTABLE);
  }

  static WebApplicationException changedWhileRequested() {
    return conflict(CHANGED);
  }

  private static WebApplicationException conflict(String message) {
    return new WebApplicationException(message, Response.Status.CONFLICT);
  }
}
