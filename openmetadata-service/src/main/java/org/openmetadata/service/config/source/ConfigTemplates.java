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

package org.openmetadata.service.config.source;

import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;

/**
 * The configuration files as read from disk, before environment substitution. One entry per file
 * kind; the last read wins.
 */
public final class ConfigTemplates {
  private static final Map<ConfigTemplateKind, String> TEMPLATES =
      new EnumMap<>(ConfigTemplateKind.class);

  private ConfigTemplates() {}

  static synchronized void record(ConfigTemplateKind kind, String text) {
    TEMPLATES.put(kind, text);
  }

  public static synchronized Optional<String> get(ConfigTemplateKind kind) {
    return Optional.ofNullable(TEMPLATES.get(kind));
  }

  public static synchronized void clear() {
    TEMPLATES.clear();
  }
}
