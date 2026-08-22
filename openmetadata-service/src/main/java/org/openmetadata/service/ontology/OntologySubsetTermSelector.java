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

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.data.BuildOntologySubset;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;

final class OntologySubsetTermSelector {
  static final int MAXIMUM_TERM_COUNT = 500;
  private final TermLookup termLookup;

  OntologySubsetTermSelector(final TermLookup termLookup) {
    this.termLookup = termLookup;
  }

  List<SourceTerm> select(final Glossary source, final BuildOntologySubset request) {
    final List<SourceTerm> selected = directlySelected(source, request.getSourceTermIds());
    if (Boolean.TRUE.equals(request.getIncludeDescendants())) {
      includeDescendants(source, selected);
    }
    requireWithinLimit(selected);
    return orderParentsFirst(selected);
  }

  private List<SourceTerm> directlySelected(final Glossary source, final Set<UUID> sourceTermIds) {
    return new ArrayList<>(
        sourceTermIds.stream()
            .map(termLookup::read)
            .map(term -> requireSourceTerm(source, term))
            .map(term -> new SourceTerm(term, true))
            .toList());
  }

  private void includeDescendants(final Glossary source, final List<SourceTerm> selected) {
    final List<SourceTerm> roots = List.copyOf(selected);
    for (final SourceTerm root : roots) {
      final int remaining = MAXIMUM_TERM_COUNT - selected.size();
      final List<GlossaryTerm> descendants = termLookup.descendants(root.term(), remaining + 1);
      descendants.stream()
          .map(term -> requireSourceTerm(source, term))
          .filter(term -> !contains(selected, term.getId()))
          .map(term -> new SourceTerm(term, false))
          .forEach(selected::add);
      requireWithinLimit(selected);
    }
  }

  private static GlossaryTerm requireSourceTerm(final Glossary source, final GlossaryTerm term) {
    final boolean isInvalid =
        term.getGlossary() == null
            || !source.getId().equals(term.getGlossary().getId())
            || term.getVersion() == null;
    if (isInvalid) {
      throw new BadRequestException(
          "Term '" + term.getId() + "' is not a versioned member of " + source.getName());
    }
    return term;
  }

  private static void requireWithinLimit(final List<SourceTerm> selected) {
    if (selected.size() > MAXIMUM_TERM_COUNT) {
      throw new BadRequestException(
          "A synchronous ontology subset cannot exceed " + MAXIMUM_TERM_COUNT + " terms");
    }
  }

  private static List<SourceTerm> orderParentsFirst(final List<SourceTerm> selected) {
    final List<SourceTerm> ordered = new ArrayList<>();
    final List<SourceTerm> pending = new ArrayList<>(selected);
    while (!pending.isEmpty()) {
      final List<SourceTerm> ready =
          pending.stream().filter(term -> isParentAvailable(term, selected, ordered)).toList();
      if (ready.isEmpty()) {
        throw new BadRequestException("Ontology subset source hierarchy contains a cycle");
      }
      ordered.addAll(ready);
      pending.removeAll(ready);
    }
    return List.copyOf(ordered);
  }

  private static boolean isParentAvailable(
      final SourceTerm sourceTerm,
      final List<SourceTerm> selected,
      final List<SourceTerm> ordered) {
    final UUID parentId =
        sourceTerm.term().getParent() == null ? null : sourceTerm.term().getParent().getId();
    return parentId == null || !contains(selected, parentId) || contains(ordered, parentId);
  }

  private static boolean contains(final List<SourceTerm> terms, final UUID termId) {
    return terms.stream().anyMatch(source -> source.term().getId().equals(termId));
  }

  interface TermLookup {
    GlossaryTerm read(UUID termId);

    List<GlossaryTerm> descendants(GlossaryTerm root, int limit);
  }

  record SourceTerm(GlossaryTerm term, boolean selectedDirectly) {}
}
