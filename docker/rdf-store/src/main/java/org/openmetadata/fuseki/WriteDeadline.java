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
package org.openmetadata.fuseki;

import java.time.Duration;
import java.util.concurrent.TimeoutException;
import java.util.function.LongSupplier;

final class WriteDeadline {
  private final long expiresAt;
  private final LongSupplier clock;

  WriteDeadline(final Duration timeout, final LongSupplier clock) {
    this.clock = clock;
    this.expiresAt = clock.getAsLong() + timeout.toNanos();
  }

  long remainingNanos() throws TimeoutException {
    final long remaining = expiresAt - clock.getAsLong();
    if (remaining <= 0 || Thread.currentThread().isInterrupted()) {
      throw new TimeoutException("Graph Store write deadline exceeded");
    }
    return remaining;
  }

  void check() {
    try {
      remainingNanos();
    } catch (TimeoutException exception) {
      throw new Expired(exception);
    }
  }

  static final class Expired extends RuntimeException {
    Expired(final TimeoutException cause) {
      super(cause.getMessage(), cause);
    }
  }
}
