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

package org.openmetadata.service.fernet.rotation;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * The places a sweep found, bounded by {@value #RETAINED} of each kind however many there are: a
 * report run before the rewrite finds an older-key place in nearly every row. The counts are exact.
 */
final class Problems {
  static final int RETAINED = 100;

  private final List<Problem> real = new ArrayList<>();
  private final List<Problem> olderKey = new ArrayList<>();
  private long realCount;
  private long olderKeyCount;

  void add(Problem problem) {
    if (problem.outcome() == Outcome.OLDER_KEY) {
      olderKeyCount++;
      if (olderKey.size() < RETAINED) {
        olderKey.add(problem);
      }
    } else {
      realCount++;
      if (real.size() < RETAINED) {
        real.add(problem);
      }
    }
  }

  /** These places with {@code other}'s, counted exactly and retained up to the bound. */
  Problems plus(Problems other) {
    Problems merged = new Problems();
    Stream.of(this, other)
        .forEach(
            source -> {
              Stream.concat(source.real.stream(), source.olderKey.stream()).forEach(merged::add);
              merged.realCount += source.realCount - source.real.size();
              merged.olderKeyCount += source.olderKeyCount - source.olderKey.size();
            });
    return merged;
  }

  /** At most {@value #RETAINED} places: every kept real problem first, older-key places after. */
  List<Problem> shown() {
    List<Problem> shown = new ArrayList<>(real);
    shown.addAll(olderKey.subList(0, Math.min(olderKey.size(), RETAINED - real.size())));
    return List.copyOf(shown);
  }

  /** Places that need more than an older key, or that cannot be vouched for. */
  long realCount() {
    return realCount;
  }

  long olderKeyCount() {
    return olderKeyCount;
  }
}
