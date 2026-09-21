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

import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Tells a lookup that found nothing from one that failed. A user, team or entity that does not
 * exist, or an entity of a type that has no owners or followers, reaches nobody, and that is an
 * answer. A database that did not answer is not: the destination must read as failed, never as
 * one that simply had nobody to notify.
 */
public final class RecipientLookups {
  /** Thrown for a lookup that failed, with the cause's message as its own. */
  public static final class LookupFailedException extends RuntimeException {
    private LookupFailedException(Exception cause) {
      super(String.valueOf(cause.getMessage()), cause);
    }
  }

  private RecipientLookups() {}

  public static void rethrowUnlessAbsent(Exception e) {
    boolean nothingThere =
        e instanceof EntityNotFoundException || e instanceof IllegalArgumentException;
    if (e instanceof LookupFailedException alreadyTold) {
      throw alreadyTold;
    }
    if (!nothingThere) {
      throw new LookupFailedException(e);
    }
  }
}
