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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;

class RecipientsTest {
  private static final Recipient ALICE = new EmailRecipient("alice@corp.com", "alice");
  private static final Recipient BOB = new EmailRecipient("bob@corp.com", "bob");

  @Test
  void aFailureNeverCostsWhatWasFound() {
    Recipients reached =
        Stream.of(Recipients.of(ALICE), Recipients.failed("team A: no answer"), Recipients.of(BOB))
            .collect(Recipients.combined());

    assertEquals(Set.of(ALICE, BOB), reached.found());
    assertEquals(List.of("team A: no answer"), reached.failures());
  }

  @Test
  void aLookupReachesWhatItFoundAndNothingElse() {
    assertEquals(Set.of(ALICE), Recipients.from(new Lookup.Found<>(ALICE), Recipients::of).found());
    assertTrue(Recipients.from(new Lookup.Absent<Recipient>(), Recipients::of).found().isEmpty());
    assertEquals(
        List.of("team A: no answer"),
        Recipients.from(
                new Lookup.Failed<Recipient>("team A: no answer", new IllegalStateException()),
                Recipients::of)
            .failures());
  }

  @Test
  void aUserWithNoAddressReachesNobody() {
    assertTrue(Recipients.of((Recipient) null).found().isEmpty());
  }
}
