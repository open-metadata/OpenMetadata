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

package org.openmetadata.it.tests.security.scale;

import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Tag;
import io.micrometer.core.instrument.Timer;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * Reads credential meters from a registry by name and tag, never through a class of the verifier,
 * so a benchmark that uses it compiles and runs against a server that has no verifier. Whether the
 * server has one is decided by class name, not by its meters, so a meter that is renamed or not yet
 * registered reads as zero and fails a proof check instead of passing as a build without one.
 *
 * <p>{@link #ofServer()} reads the global registry the in-process test server reports to.
 */
public final class CredentialMeters {
  private static final String VERIFIER_CLASS =
      "org.openmetadata.service.security.credentials.CredentialVerifier";

  private final MeterRegistry registry;

  public CredentialMeters(MeterRegistry registry) {
    this.registry = registry;
  }

  static CredentialMeters ofServer() {
    return new CredentialMeters(Metrics.globalRegistry);
  }

  /** True when the server build contains the verifier, whether or not it has checked a token. */
  public boolean verifierPresent() {
    boolean present = true;
    try {
      Class.forName(VERIFIER_CLASS, false, CredentialMeters.class.getClassLoader());
    } catch (ClassNotFoundException absent) {
      present = false;
    }
    return present;
  }

  /** Sum of the counters called {@code name} whose tags include every key and value pair given. */
  public double counterSum(String name, String... tags) {
    return registry.find(name).counters().stream()
        .filter(counter -> hasTags(counter, tags))
        .mapToDouble(counter -> counter.count())
        .sum();
  }

  Optional<Timer> timer(String name, String... tags) {
    return registry.find(name).timers().stream().filter(t -> hasTags(t, tags)).findFirst();
  }

  /** Count and total milliseconds summed over every timer called {@code name}. */
  TimerTotals timerTotals(String name) {
    List<Timer> timers = registry.find(name).timers().stream().toList();
    long count = timers.stream().mapToLong(Timer::count).sum();
    double millis = timers.stream().mapToDouble(t -> t.totalTime(TimeUnit.MILLISECONDS)).sum();
    return new TimerTotals(count, millis);
  }

  record TimerTotals(long count, double totalMillis) {}

  Optional<Double> gauge(String name) {
    return registry.find(name).gauges().stream().findFirst().map(gauge -> gauge.value());
  }

  private static boolean hasTags(Meter meter, String[] wanted) {
    boolean all = true;
    for (int i = 0; i < wanted.length; i += 2) {
      all &= hasTag(meter.getId().getTags(), wanted[i], wanted[i + 1]);
    }
    return all;
  }

  private static boolean hasTag(List<Tag> tags, String key, String value) {
    return tags.stream().anyMatch(tag -> tag.getKey().equals(key) && tag.getValue().equals(value));
  }
}
