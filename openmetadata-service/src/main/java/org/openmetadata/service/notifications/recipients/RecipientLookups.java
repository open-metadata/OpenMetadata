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

package org.openmetadata.service.notifications.recipients;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Tells a lookup that found nothing from one that failed. A user, team or entity that does not
 * exist, or an entity of a type that has no owners or followers, reaches nobody, and that is an
 * answer. A database that did not answer is not: the destination must read as failed, never as
 * one that simply had nobody to notify. A caller that resolves many recipients collects the
 * failures instead, so one recipient that cannot be looked up never costs the others their message.
 */
public final class RecipientLookups {
  private static final ThreadLocal<List<String>> COLLECTED = new ThreadLocal<>();

  /** Thrown for a lookup that failed, with the cause's message as its own. */
  public static final class LookupFailedException extends RuntimeException {
    private LookupFailedException(Exception cause) {
      super(String.valueOf(cause.getMessage()), cause);
    }
  }

  /** What a lookup found, and why the parts it skipped could not be looked up. */
  public record Collected<T>(T found, List<String> failures) {}

  private RecipientLookups() {}

  /** Runs a lookup whose failed parts are skipped and reported back instead of thrown. */
  public static <T> Collected<T> collecting(Supplier<T> lookup) {
    List<String> outer = COLLECTED.get();
    List<String> failures = new ArrayList<>();
    COLLECTED.set(failures);
    try {
      return new Collected<>(lookup.get(), List.copyOf(failures));
    } finally {
      restore(outer);
    }
  }

  /**
   * Returns when the lookup found nothing, or when the caller collects failures, which then skips
   * this one recipient. Otherwise throws.
   */
  public static void reportUnlessAbsent(Exception e) {
    boolean nothingThere =
        e instanceof EntityNotFoundException || e instanceof IllegalArgumentException;
    if (!nothingThere) {
      LookupFailedException failed =
          e instanceof LookupFailedException told ? told : new LookupFailedException(e);
      List<String> collected = COLLECTED.get();
      if (collected == null) {
        throw failed;
      }
      collected.add(failed.getMessage());
    }
  }

  private static void restore(List<String> outer) {
    if (outer == null) {
      COLLECTED.remove();
    } else {
      COLLECTED.set(outer);
    }
  }
}
