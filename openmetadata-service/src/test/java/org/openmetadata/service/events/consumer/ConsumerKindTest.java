/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.events.consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.alerting.AlertPublisher;
import org.openmetadata.service.util.DIContainer;

/**
 * An alert's consumer kind is declared by its class, and its provider declares it too, so it is
 * known without building one.
 */
class ConsumerKindTest {

  @Test
  void aConsumerIsTheKindItsClassDeclares() {
    assertEquals(ConsumerKind.EVENT, ConsumerKind.of(AlertPublisher.class));
    assertEquals(ConsumerKind.BATCH, ConsumerKind.of(Batch.class));
    assertEquals(ConsumerKind.SELF_DRIVEN, ConsumerKind.of(SelfDriven.class));
  }

  @Test
  void aConsumerDeclaringTwoKindsIsRefused() {
    assertThrows(IllegalArgumentException.class, () -> ConsumerKind.of(Both.class));
  }

  @Test
  void onlyASelfDrivenConsumerReadsNoChangeEvents() {
    assertTrue(ConsumerKind.EVENT.readsChangeEvents());
    assertTrue(ConsumerKind.BATCH.readsChangeEvents());
    assertFalse(ConsumerKind.SELF_DRIVEN.readsChangeEvents());
  }

  /** Reading the kind builds nothing: this consumer's constructor would fail. */
  @Test
  void anAlertsKindIsReadWithoutBuildingItsConsumer() {
    ConsumerProvider neverBuilt = mock(ConsumerProvider.class);
    when(neverBuilt.type()).thenReturn(ConsumerKind.SELF_DRIVEN);
    when(neverBuilt.create(any())).thenThrow(new IllegalStateException("never built"));
    try (MockedStatic<Consumers> consumers = mockStatic(Consumers.class)) {
      consumers.when(() -> Consumers.find("test.selfDriven")).thenReturn(Optional.of(neverBuilt));

      assertEquals(
          ConsumerKind.SELF_DRIVEN,
          ConsumerKind.of(new EventSubscription().withClassName("test.selfDriven")));
    }
  }

  @Test
  void anAlertWithoutAConsumerOrNamingOneNothingAnswersToIsAnEventAlert() {
    assertEquals(ConsumerKind.EVENT, ConsumerKind.of(new EventSubscription()));
    assertEquals(
        ConsumerKind.EVENT,
        ConsumerKind.of(new EventSubscription().withClassName("org.openmetadata.NoSuchConsumer")));
  }

  static class Batch extends AlertPublisher implements BatchConsumer {
    Batch(DIContainer dependencies) {
      super(dependencies);
    }
  }

  static class SelfDriven extends AlertPublisher implements SelfDrivenConsumer {
    SelfDriven(DIContainer dependencies) {
      super(dependencies);
      throw new IllegalStateException("never built to learn its kind");
    }
  }

  static class Both extends AlertPublisher implements BatchConsumer, SelfDrivenConsumer {
    Both(DIContainer dependencies) {
      super(dependencies);
    }
  }
}
