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

import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;

/** The request may have committed remotely; automatically retrying or bisecting is unsafe. */
public final class RdfWriteOutcomeUnknownException extends RuntimeException {
  public RdfWriteOutcomeUnknownException(final String operation, final Throwable cause) {
    super(
        "RDF write outcome is unknown for " + operation + "; automatic replay is disabled", cause);
  }

  public static boolean isPresent(final Throwable error) {
    final Set<Throwable> visited = Collections.newSetFromMap(new IdentityHashMap<>());
    Throwable cause = error;
    while (cause != null && visited.add(cause)) {
      if (cause instanceof RdfWriteOutcomeUnknownException) {
        return true;
      }
      cause = cause.getCause();
    }
    return false;
  }
}
