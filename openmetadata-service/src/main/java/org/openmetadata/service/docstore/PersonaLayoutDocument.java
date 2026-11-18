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

package org.openmetadata.service.docstore;

import jakarta.ws.rs.core.SecurityContext;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Supplier;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * A persona's UI customization (navigation, page layouts, app mode) is stored as the document
 * {@code persona.<personaFqn>}. Every user the persona applies to needs it to render their UI, so
 * they read it through their persona assignment, as they do the persona's AI context, instead of
 * needing ViewBasic on all documents. See
 * ADR:2026-11-02-persona-layouts-are-readable-through-persona-assignment.
 */
public final class PersonaLayoutDocument {
  private static final String FQN_PREFIX = Entity.PERSONA + Entity.SEPARATOR;
  private static final int LAYOUT_FQN_PARTS = 2;

  private PersonaLayoutDocument() {}

  /** Whether {@code documentFqn} is the layout of a persona assigned to the caller. */
  public static boolean isAssignedToCaller(
      final SecurityContext securityContext, final String documentFqn) {
    return isAssignedTo(
        () -> DefaultAuthorizer.getSubjectContext(securityContext),
        documentFqn,
        PersonaLayoutDocument::findPersona);
  }

  static boolean isAssignedTo(
      final Supplier<SubjectContext> caller,
      final String documentFqn,
      final Function<String, Optional<EntityReference>> findPersona) {
    return personaFqnOf(documentFqn)
        .flatMap(findPersona)
        .map(persona -> caller.get().hasPersona(persona.getId()))
        .orElse(false);
  }

  /**
   * The persona FQN of a layout document, which has exactly two FQN parts, {@code persona} and the
   * persona's own FQN, so a quoted persona name such as {@code "Data.Quality"} stays whole.
   */
  static Optional<String> personaFqnOf(final String documentFqn) {
    return Optional.ofNullable(documentFqn)
        .filter(fqn -> fqn.startsWith(FQN_PREFIX))
        .map(FullyQualifiedName::split)
        .filter(parts -> parts.length == LAYOUT_FQN_PARTS)
        .map(parts -> parts[1]);
  }

  private static Optional<EntityReference> findPersona(final String personaFqn) {
    try {
      return Optional.of(
          Entity.getEntityReferenceByName(Entity.PERSONA, personaFqn, Include.NON_DELETED));
    } catch (EntityNotFoundException e) {
      return Optional.empty();
    }
  }
}
