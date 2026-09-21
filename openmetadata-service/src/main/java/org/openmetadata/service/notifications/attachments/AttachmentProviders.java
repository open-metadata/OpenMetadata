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

package org.openmetadata.service.notifications.attachments;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.ServiceLoader;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.ChangeEvent;

/** Every attachment provider on the classpath, by the entity type it is registered for. */
public final class AttachmentProviders {
  private static final Map<String, AttachmentProvider> BY_SOURCE_TYPE = load();

  private AttachmentProviders() {}

  public static Optional<Attachment> attachmentFor(ChangeEvent event, EventSubscription alert) {
    return Optional.ofNullable(event.getEntityType())
        .map(BY_SOURCE_TYPE::get)
        .flatMap(provider -> provider.attachmentFor(event, alert));
  }

  private static Map<String, AttachmentProvider> load() {
    Map<String, AttachmentProvider> providers = new HashMap<>();
    for (AttachmentProvider provider : ServiceLoader.load(AttachmentProvider.class)) {
      AttachmentProvider other = providers.putIfAbsent(provider.sourceType(), provider);
      if (other != null) {
        throw new IllegalStateException(
            "Two attachment providers are registered for " + provider.sourceType());
      }
    }
    return Map.copyOf(providers);
  }
}
