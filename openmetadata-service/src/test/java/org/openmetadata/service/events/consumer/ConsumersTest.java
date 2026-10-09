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

package org.openmetadata.service.events.consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.util.List;
import java.util.Optional;
import java.util.ServiceLoader;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.alerting.AlertConsumers;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.ConsumerKind;
import org.openmetadata.service.util.DIContainer;

/** An alert names its consumer by a registered id, or by a class name it was once stored under. */
class ConsumersTest {
  private static final String STORED_BEFORE_IDS =
      "org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher";

  @Test
  void anAlertThatNamesNoConsumerIsSentByTheAlertConsumer() {
    ConsumerProvider consumer = Consumers.find(Consumers.DEFAULT).orElseThrow();

    assertInstanceOf(AlertConsumers.class, consumer);
    assertInstanceOf(AlertPublisher.class, consumer.create(mock(DIContainer.class)));
  }

  @Test
  void theClassNameAConsumerWasStoredUnderStillNamesIt() {
    assertEquals(Optional.of(Consumers.DEFAULT), Consumers.idOf(STORED_BEFORE_IDS));
    assertEquals(Optional.of(Consumers.DEFAULT), Consumers.idOf(Consumers.DEFAULT));
  }

  @Test
  void aNameNothingAnswersToNamesNoConsumer() {
    assertTrue(Consumers.find("org.openmetadata.NoSuchConsumer").isEmpty());
    assertTrue(Consumers.find(null).isEmpty());
  }

  @Test
  void twoConsumersAnsweringToOneNameAreRefused() {
    assertThrows(
        IllegalStateException.class,
        () -> Consumers.index(List.of(provider("same", Set.of()), provider("same", Set.of()))));
    assertThrows(
        IllegalStateException.class,
        () -> Consumers.index(List.of(provider("one", Set.of()), provider("two", Set.of("one")))));
  }

  /** The kind is read from the provider without building the consumer, so the two must agree. */
  @Test
  void everyConsumerIsTheKindItsProviderDeclares() {
    for (ConsumerProvider provider : ServiceLoader.load(ConsumerProvider.class)) {
      AbstractEventConsumer consumer = provider.create(mock(DIContainer.class));
      assertEquals(provider.type(), ConsumerKind.of(consumer.getClass()), provider.id());
    }
  }

  private static ConsumerProvider provider(String id, Set<String> aliases) {
    return new ConsumerProvider() {
      @Override
      public String id() {
        return id;
      }

      @Override
      public Set<String> aliases() {
        return aliases;
      }

      @Override
      public ConsumerKind type() {
        return ConsumerKind.EVENT;
      }

      @Override
      public AbstractEventConsumer create(DIContainer dependencies) {
        return new AlertPublisher(dependencies);
      }
    };
  }
}
