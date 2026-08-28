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

package org.openmetadata.service.util.branding;

import java.util.Comparator;
import java.util.ServiceLoader;
import java.util.stream.StreamSupport;

/**
 * Resolves the active MessageBrandingProvider via ServiceLoader SPI.
 * The highest-priority registered provider is selected and cached for the lifetime of the JVM.
 */
public final class MessageBrandingResolver {

  private static final MessageBrandingProvider INSTANCE = resolve();

  private MessageBrandingResolver() {}

  public static MessageBrandingProvider get() {
    return INSTANCE;
  }

  private static MessageBrandingProvider resolve() {
    ServiceLoader<MessageBrandingProvider> loader =
        ServiceLoader.load(MessageBrandingProvider.class);
    return StreamSupport.stream(loader.spliterator(), false)
        .max(Comparator.comparingInt(MessageBrandingProvider::getPriority))
        .orElseThrow(
            () ->
                new IllegalStateException(
                    "No MessageBrandingProvider found via ServiceLoader. "
                        + "Ensure META-INF/services/"
                        + MessageBrandingProvider.class.getName()
                        + " is properly configured."));
  }
}
