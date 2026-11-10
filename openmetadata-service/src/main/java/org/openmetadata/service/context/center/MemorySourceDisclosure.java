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

package org.openmetadata.service.context.center;

import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.drive.ContextFileVisibility;

/**
 * Which of the documents stating a memory its readers are told about: a document shared with only
 * some people is never named to the others (ADR:2026-09-29-context-file-memory-reuse). A linked
 * document joins the memory's related entities only when everyone may read it, and the memory's
 * source is its anchor, else a document everyone may read, else a restricted one, which is why a
 * restricted document links only to a memory already showing one everyone may read.
 */
public final class MemorySourceDisclosure {
  private MemorySourceDisclosure() {}

  /** A live article, which has no sharing of its own, or a file shared with the whole organization. */
  public static boolean everyoneMayRead(EntityReference document) {
    return (Entity.PAGE.equals(document.getType()) && isLive(document))
        || (Entity.CONTEXT_FILE.equals(document.getType()) && isOrgWideFile(document));
  }

  /**
   * The source a memory shows among the live documents linked to it, sorted by name: its anchor,
   * else the first one everyone may read, else the first. A lone document needs no choice.
   */
  public static EntityReference shownSource(
      EntityReference anchor, List<EntityReference> documents) {
    return shownSource(anchor, documents, MemorySourceDisclosure::everyoneMayRead);
  }

  static EntityReference shownSource(
      EntityReference anchor,
      List<EntityReference> documents,
      Predicate<EntityReference> readableByEveryone) {
    return documents.size() < 2
        ? documents.stream().findFirst().orElse(null)
        : anchorAmong(anchor, documents)
            .or(() -> documents.stream().filter(readableByEveryone).findFirst())
            .orElse(documents.getFirst());
  }

  /**
   * Whether {@code document} may be linked to a memory showing {@code shownSource} without being
   * shown in its place: one everyone may read always may; a restricted one only beside a shown
   * source everyone may read, which then stays the one shown.
   */
  public static boolean mayLink(
      EntityReference document,
      EntityReference shownSource,
      Predicate<EntityReference> readableByEveryone) {
    return isReadByEveryone(document, readableByEveryone)
        || isReadByEveryone(shownSource, readableByEveryone);
  }

  private static boolean isReadByEveryone(
      EntityReference document, Predicate<EntityReference> readableByEveryone) {
    return document != null && readableByEveryone.test(document);
  }

  private static Optional<EntityReference> anchorAmong(
      EntityReference anchor, List<EntityReference> documents) {
    return anchor == null
        ? Optional.empty()
        : documents.stream()
            .filter(document -> anchor.getId().equals(document.getId()))
            .findFirst();
  }

  private static boolean isLive(EntityReference document) {
    return Entity.getEntityOrNull(document, "", Include.NON_DELETED) != null;
  }

  private static boolean isOrgWideFile(EntityReference file) {
    boolean orgWide;
    try {
      ContextFile stored = Entity.getEntity(file, "", Include.NON_DELETED);
      orgWide = ContextFileVisibility.isOrgWide(stored);
    } catch (EntityNotFoundException e) {
      orgWide = false;
    }
    return orgWide;
  }
}
