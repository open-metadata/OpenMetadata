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

import java.util.List;
import java.util.Set;

/** The exit code a report earns, from what the read after any writes found. */
enum Verdict {
  /** Every token found opens with the primary key and every place was read. */
  CLEAN(0),
  /** A token still needs an older key, or a value cannot be vouched for. */
  NOT_SAFE(3),
  /** The only findings are tokens no configured key opens; they were unreadable before this run. */
  ONLY_UNREADABLE_VALUES(4);

  private static final Set<Outcome> BLOCKING =
      Set.of(Outcome.OLDER_KEY, Outcome.UNBOUND, Outcome.UNREWRITABLE, Outcome.CONTENDED);

  final int exitCode;

  Verdict(int exitCode) {
    this.exitCode = exitCode;
  }

  static Verdict of(List<StoreTally> stores) {
    Verdict verdict;
    if (stores.stream().anyMatch(Verdict::blocks)) {
      verdict = NOT_SAFE;
    } else if (stores.stream().anyMatch(store -> store.count(Outcome.NO_KEY) > 0)) {
      verdict = ONLY_UNREADABLE_VALUES;
    } else {
      verdict = CLEAN;
    }
    return verdict;
  }

  private static boolean blocks(StoreTally store) {
    return !store.readable() || BLOCKING.stream().anyMatch(outcome -> store.count(outcome) > 0);
  }
}
