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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** Compares what requests cost with a credential token and with a control token. */
final class PerRequestCost {
  private PerRequestCost() {}

  /**
   * Asserts the credential requests cost less than one unit per ten requests more than the control
   * requests. A cost paid on every request exceeds that ten times over. A cache refresh, or a
   * server-wide call, that lands during a credential request instead of a control request stays
   * inside the margin, so the result does not depend on when those happen.
   */
  static void assertNoPerRequestCost(
      String unit, int requests, long control, long credential, String detail) {
    assertTrue(
        (credential - control) * 10 < requests,
        "%s over %d requests: control %d, credential %d. A cost on every request adds about %d. %s"
            .formatted(unit, requests, control, credential, requests, detail));
  }
}
