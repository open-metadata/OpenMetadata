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
package org.openmetadata.it.util;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicLong;

/** Shared time control for SQL lease, retry and RDF recovery tests; never sleeps the test thread. */
public final class MutableClock extends Clock {
  private final AtomicLong now;
  private final ZoneId zone;

  public MutableClock() {
    this(new AtomicLong(System.currentTimeMillis()), ZoneOffset.UTC);
  }

  private MutableClock(final AtomicLong now, final ZoneId zone) {
    this.now = now;
    this.zone = zone;
  }

  public void advance(final Duration duration) {
    advance(duration.toMillis());
  }

  public void advance(final long millis) {
    now.addAndGet(millis);
  }

  @Override
  public ZoneId getZone() {
    return zone;
  }

  @Override
  public Clock withZone(final ZoneId zone) {
    return new MutableClock(now, zone);
  }

  @Override
  public Instant instant() {
    return Instant.ofEpochMilli(millis());
  }

  @Override
  public long millis() {
    return now.get();
  }
}
