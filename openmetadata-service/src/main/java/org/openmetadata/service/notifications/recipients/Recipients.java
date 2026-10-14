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

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collector;
import java.util.stream.Collectors;
import org.openmetadata.service.notifications.recipients.context.Recipient;

/**
 * Who a destination reaches for one event, and why the parts that could not be looked up were
 * skipped. A failure never costs the recipients that were found their message.
 */
public record Recipients(Set<Recipient> found, List<String> failures) {

  public Recipients {
    found = Set.copyOf(found);
    failures = List.copyOf(failures);
  }

  public static Recipients none() {
    return new Recipients(Set.of(), List.of());
  }

  /** None for a user or team with no address on the destination's channel. */
  public static Recipients of(Recipient recipient) {
    return recipient == null ? none() : new Recipients(Set.of(recipient), List.of());
  }

  public static Recipients of(Collection<Recipient> recipients) {
    return new Recipients(new HashSet<>(recipients), List.of());
  }

  public static Recipients failed(String reason) {
    return new Recipients(Set.of(), List.of(reason));
  }

  /** Who the value a lookup found reaches; nobody when it found nothing; the failure when it failed. */
  public static <T> Recipients from(Lookup<T> lookup, Function<T, Recipients> reached) {
    return switch (lookup) {
      case Lookup.Found<T> found -> reached.apply(found.value());
      case Lookup.Absent<T> absent -> none();
      case Lookup.Failed<T> failed -> failed(failed.reason());
    };
  }

  public Recipients and(Recipients other) {
    Set<Recipient> bothFound = new HashSet<>(found);
    bothFound.addAll(other.found);
    List<String> bothFailures = new ArrayList<>(failures);
    bothFailures.addAll(other.failures);
    return new Recipients(bothFound, bothFailures);
  }

  public static Collector<Recipients, ?, Recipients> combined() {
    return Collectors.reducing(none(), Recipients::and);
  }
}
