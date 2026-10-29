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

package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.openmetadata.schema.type.OntologyPrefix;

public final class OntologyLayerValidator {
  private OntologyLayerValidator() {}

  public static void validatePrefixes(final List<OntologyPrefix> prefixes) {
    final Set<String> names = new HashSet<>();
    final Set<String> namespaces = new HashSet<>();
    for (final OntologyPrefix prefix : listOrEmpty(prefixes)) {
      requireValidPrefix(prefix);
      final String normalizedName = prefix.getPrefix().toLowerCase(Locale.ROOT);
      if (!names.add(normalizedName) || !namespaces.add(prefix.getNamespace().toString())) {
        throw new BadRequestException("Ontology prefixes and namespaces must be unique");
      }
    }
  }

  private static void requireValidPrefix(final OntologyPrefix prefix) {
    final boolean isInvalid =
        prefix == null
            || prefix.getPrefix() == null
            || prefix.getPrefix().isBlank()
            || prefix.getNamespace() == null
            || !prefix.getNamespace().isAbsolute();
    if (isInvalid) {
      throw new BadRequestException("Ontology prefixes require a name and an absolute namespace");
    }
  }
}
