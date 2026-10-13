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

package org.openmetadata.service.apps.bundles.changeEvent;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * What one event's delivery came to: how many channels delivered it and, for each channel that
 * failed, the destination it failed on and why. A channel that could not try, or found nobody to
 * send to, failed, and its reason says it was not attempted. Counting it and recording the failure
 * belong to the caller.
 */
public record Delivery(int delivered, List<Failure> failures) {

  public record Failure(UUID destinationId, String reason) {}

  public Delivery {
    failures = List.copyOf(failures);
  }

  public boolean anyFailed() {
    return !failures.isEmpty();
  }

  /** Every failure's reason, in the order the channels were sent through. */
  public String reasons() {
    return failures.stream().map(Failure::reason).collect(Collectors.joining("; "));
  }
}
