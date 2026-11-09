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

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.openmetadata.schema.api.context.ExtractionAvailability;

/**
 * What an Extract or Retry of one file or article answers when it cannot start, the same for both:
 * a 409, before anything is written.
 */
final class ExtractionRequests {
  static final String UNAVAILABLE = "Memory extraction is unavailable: %s";
  static final String ALREADY_REQUESTED =
      "This document's memories are already queued or being extracted.";
  static final String NOT_EXTRACTABLE =
      "Only a document that failed or whose memories were never extracted can be extracted.";
  static final String CHANGED =
      "The document changed while its extraction was being requested. Please retry.";
  static final String QUEUE_FAILED =
      "Unable to queue knowledge pill extraction. Please retry later.";

  private ExtractionRequests() {}

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
