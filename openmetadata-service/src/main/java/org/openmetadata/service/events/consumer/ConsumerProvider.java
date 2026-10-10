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

import java.util.Set;
import org.openmetadata.service.util.DIContainer;

/**
 * A change-event consumer an alert can name. Providers are found with ServiceLoader, so a plugin
 * adds its consumers by listing a provider in its META-INF/services; every server that has the
 * plugin builds each provider once, so a provider's constructor must do nothing.
 *
 * <p>An alert stores its consumer's id in its {@code className}, which therefore no longer names a
 * Java class and never changes when the class moves. The class names consumers were stored under
 * before ids are kept as aliases, and still accepted.
 */
public interface ConsumerProvider {

  /** The id an alert names this consumer by. It never changes once released. */
  String id();

  /** Other names an alert may hold for this consumer: the class names it was once stored under. */
  default Set<String> aliases() {
    return Set.of();
  }

  /** The kind of consumer {@link #create} builds, known without building it. */
  ConsumerKind type();

  /** A consumer for one tick. */
  AbstractEventConsumer create(DIContainer dependencies);
}
