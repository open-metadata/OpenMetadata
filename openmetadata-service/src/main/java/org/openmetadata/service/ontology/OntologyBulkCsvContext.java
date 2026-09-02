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

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;

record OntologyBulkCsvContext(
    Glossary glossary,
    List<GlossaryTerm> existingTerms,
    List<GlossaryTerm> plannedTerms,
    Set<String> fullyQualifiedNames,
    String user) {
  static OntologyBulkCsvContext create(
      final Glossary glossary, final List<GlossaryTerm> existingTerms, final String user) {
    final Set<String> fqns =
        existingTerms.stream()
            .map(GlossaryTerm::getFullyQualifiedName)
            .filter(Objects::nonNull)
            .collect(Collectors.toCollection(HashSet::new));
    return new OntologyBulkCsvContext(
        glossary, new ArrayList<>(existingTerms), new ArrayList<>(), fqns, user);
  }

  List<GlossaryTerm> allTerms() {
    final List<GlossaryTerm> all = new ArrayList<>(existingTerms);
    all.addAll(plannedTerms);
    return all;
  }

  void add(final GlossaryTerm term) {
    plannedTerms.add(term);
    fullyQualifiedNames.add(term.getFullyQualifiedName());
  }

  void update(final GlossaryTerm term) {
    final GlossaryTerm previous = find(term.getId());
    if (previous != null) {
      fullyQualifiedNames.remove(previous.getFullyQualifiedName());
      existingTerms.remove(previous);
    }
    existingTerms.add(term);
    fullyQualifiedNames.add(term.getFullyQualifiedName());
  }

  private GlossaryTerm find(final UUID id) {
    return existingTerms.stream().filter(term -> term.getId().equals(id)).findFirst().orElse(null);
  }
}
