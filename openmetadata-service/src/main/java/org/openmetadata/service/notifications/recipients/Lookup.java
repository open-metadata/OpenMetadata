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

package org.openmetadata.service.notifications.recipients;

import java.util.function.Supplier;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * What one read answered: a value, nothing there, or a failure to find out. Nothing there is an
 * answer: a user who was deleted, an entity with no owners. A failed read is not, and whoever asked
 * must be able to tell the two apart.
 */
public sealed interface Lookup<T> {

  record Found<T>(T value) implements Lookup<T> {}

  record Absent<T>() implements Lookup<T> {}

  record Failed<T>(String reason, RuntimeException cause) implements Lookup<T> {}

  /**
   * The one place a read is classified. A null answer, a missing entity and an argument that names
   * nothing, such as a field the type does not have, are absent; any other error is a failure.
   */
  static <T> Lookup<T> of(String what, Supplier<T> read) {
    Lookup<T> answer;
    try {
      T value = read.get();
      answer = value == null ? new Absent<>() : new Found<>(value);
    } catch (EntityNotFoundException | IllegalArgumentException nothingThere) {
      log().debug("Nothing found for {}: {}", what, nothingThere.getMessage());
      answer = new Absent<>();
    } catch (RuntimeException e) {
      log().warn("Could not look up {}", what, e);
      answer = new Failed<>(what + ": " + e.getMessage(), e);
    }
    return answer;
  }

  private static Logger log() {
    return LoggerFactory.getLogger(Lookup.class);
  }
}
