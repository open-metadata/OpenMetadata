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

package org.openmetadata.service.config.source;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/** The units of a setting grouped by what reconciling them did. */
public final class MergeReport {
  private final Map<MergeOutcome, List<MergeUnit>> unitsByOutcome =
      new EnumMap<>(MergeOutcome.class);
  private boolean identityProviderReplaced;

  void record(MergeOutcome outcome, MergeUnit unit) {
    unitsByOutcome.computeIfAbsent(outcome, ignored -> new ArrayList<>()).add(unit);
  }

  void markIdentityProviderReplaced() {
    identityProviderReplaced = true;
  }

  public List<MergeUnit> units(MergeOutcome outcome) {
    return List.copyOf(unitsByOutcome.getOrDefault(outcome, List.of()));
  }

  public boolean has(MergeOutcome outcome) {
    return !units(outcome).isEmpty();
  }

  public boolean isIdentityProviderReplaced() {
    return identityProviderReplaced;
  }
}
