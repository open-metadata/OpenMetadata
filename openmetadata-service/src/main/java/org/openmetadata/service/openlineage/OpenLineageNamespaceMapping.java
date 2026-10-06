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

package org.openmetadata.service.openlineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Comparator;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Operator-declared mapping from OpenLineage dataset namespaces to OpenMetadata service names. A
 * namespace matches an exact key first, then the longest key it starts with, so the answer never
 * depends on map iteration order. Creating entities hangs off this mapping, so a namespace nobody
 * mapped never resolves to a service by guesswork.
 */
public final class OpenLineageNamespaceMapping {

  private final Map<String, String> serviceByNamespace;

  public OpenLineageNamespaceMapping(Map<String, String> serviceByNamespace) {
    this.serviceByNamespace =
        serviceByNamespace == null
            ? Map.of()
            : serviceByNamespace.entrySet().stream()
                .filter(entry -> !nullOrEmpty(entry.getKey()) && !nullOrEmpty(entry.getValue()))
                .collect(Collectors.toUnmodifiableMap(Map.Entry::getKey, Map.Entry::getValue));
  }

  public Optional<String> serviceFor(String namespace) {
    Optional<String> result = Optional.empty();
    if (!nullOrEmpty(namespace)) {
      result =
          Optional.ofNullable(serviceByNamespace.get(namespace))
              .or(() -> longestPrefixMatch(namespace));
    }
    return result;
  }

  public boolean isEmpty() {
    return serviceByNamespace.isEmpty();
  }

  private Optional<String> longestPrefixMatch(String namespace) {
    return serviceByNamespace.entrySet().stream()
        .filter(entry -> namespace.startsWith(entry.getKey()))
        .max(Comparator.comparingInt(entry -> entry.getKey().length()))
        .map(Map.Entry::getValue);
  }
}
