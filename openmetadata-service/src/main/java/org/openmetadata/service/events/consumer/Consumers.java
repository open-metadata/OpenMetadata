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

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.ServiceLoader;
import java.util.Set;

/**
 * Every consumer this server can run for an alert, by id and by alias. Consumers are registered,
 * never guessed: an alert naming a consumer nothing here answers to is not run by another instead.
 */
public final class Consumers {

  /** The consumer of an alert that names none: it sends the alert's notifications. */
  public static final String DEFAULT = "alert";

  private static final Map<String, ConsumerProvider> REGISTERED =
      index(ServiceLoader.load(ConsumerProvider.class));

  private Consumers() {}

  /**
   * Every id and alias this server answers to. The first call loads the providers, so the server
   * calls it at startup: two providers answering to one name then fail there, not on a tick.
   */
  public static Set<String> names() {
    return REGISTERED.keySet();
  }

  /** The consumer registered under this id or alias. */
  public static Optional<ConsumerProvider> find(String idOrAlias) {
    return Optional.ofNullable(idOrAlias).map(REGISTERED::get);
  }

  /** The id an alert should store for this id or alias, or empty when nothing answers to it. */
  public static Optional<String> idOf(String idOrAlias) {
    return find(idOrAlias).map(ConsumerProvider::id);
  }

  /** Every id and alias to its provider; two providers answering to one name are refused. */
  static Map<String, ConsumerProvider> index(Iterable<ConsumerProvider> providers) {
    Map<String, ConsumerProvider> consumers = new LinkedHashMap<>();
    for (ConsumerProvider provider : providers) {
      register(consumers, provider.id(), provider);
      provider.aliases().forEach(alias -> register(consumers, alias, provider));
    }
    return Map.copyOf(consumers);
  }

  private static void register(
      Map<String, ConsumerProvider> consumers, String name, ConsumerProvider provider) {
    ConsumerProvider other = consumers.putIfAbsent(name, provider);
    if (other != null) {
      throw new IllegalStateException(
          "Two consumers answer to "
              + name
              + ": "
              + other.getClass().getName()
              + " and "
              + provider.getClass().getName());
    }
  }
}
