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

package org.openmetadata.service.alerting;

import java.util.Set;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.ConsumerKind;
import org.openmetadata.service.events.consumer.ConsumerProvider;
import org.openmetadata.service.events.consumer.Consumers;
import org.openmetadata.service.util.DIContainer;

/** The consumer of every alert that names none: it sends the alert's notifications. */
public final class AlertConsumers implements ConsumerProvider {
  public static final String ID = Consumers.DEFAULT;

  @Override
  public String id() {
    return ID;
  }

  @Override
  public Set<String> aliases() {
    return Set.of("org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher");
  }

  @Override
  public ConsumerKind type() {
    return ConsumerKind.EVENT;
  }

  @Override
  public AbstractEventConsumer create(DIContainer dependencies) {
    return new AlertPublisher(dependencies);
  }
}
