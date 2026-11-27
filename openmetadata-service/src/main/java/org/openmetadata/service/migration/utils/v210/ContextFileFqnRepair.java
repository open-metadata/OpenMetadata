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

package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.service.Entity.CONTEXT_FILE;
import static org.openmetadata.service.jdbi3.FolderRepository.FOLDER_ENTITY;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.EntityFqnHolders;
import org.openmetadata.service.migration.utils.EntityFqnHolders.Holder;
import org.openmetadata.service.migration.utils.IdBatches;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Derives the FQN of each Context Center file from its folder again. A PATCH used to load the file
 * without its folder, so the FQN, and the nameHash written with it, fell back to the bare file name
 * until the file's next edit. Such a file was not found by its name, and its nameHash blocked a
 * root-level file of the same name. Edits keep the folder now; this repairs what released versions
 * already stored.
 *
 * <p>The derived FQN is the one {@code ContextFileRepository.setFullyQualifiedName} builds: the
 * folder's FQN and the file's name, or the name alone at the root. tag_usage is keyed by FQN alone
 * and does not record which entity a row belongs to. When no other entity, of any type and live or
 * soft-deleted, has the stored FQN or the derived FQN, every row under the stored FQN is the
 * file's: the rows move to the derived FQN, as a rename moves them, and a tag already there from
 * before the edit stays. When another entity has the stored FQN, as a root folder, metric, service,
 * glossary, domain or data product named like the file can, the rows under it may be that entity's,
 * and nothing proves which are the file's: a version of the file saved after the edit lists every
 * tag under the stored FQN, and one row can be the tag of both. When another entity has the derived
 * FQN, as a subfolder, glossary term or subdomain named like the file under the same parent can,
 * moving the file's rows there would merge them with that entity's under the one hash. In either
 * case the file's FQN and nameHash are still repaired, its rows are left where they are, and the
 * file, both FQNs and the other entities are logged for repair by hand. A table a later migration
 * creates, as one of a server built on this one, holds no entity yet, so it does not stop the move.
 *
 * <p>A file's stored JSON carries its extracted text, up to 200,000 characters, so the scan reads
 * only each file's name, FQN and nameHash, and a rewrite loads one file at a time.
 *
 * <p>A file whose derived FQN another Context Center file holds is left as it is and logged with
 * both ids, since its nameHash would collide with that file's and which of the two keeps the name
 * is for their owners to decide. A non-file entity holding the derived FQN does not block the
 * file's nameHash, unique only within the context_file table, so the file's FQN is repaired and
 * only its tag rows are left where they are. Those files are retried until a pass repairs nothing,
 * so one freed by another file's repair in the same run is repaired too. A file in a folder that
 * no longer exists is left as it is. Each file is rewritten in a transaction of its own, and only
 * while it still holds the FQN the scan read before its folder, so a file edited or moved meanwhile
 * keeps that change; a failure is logged and skipped. Idempotent: a file whose FQN and nameHash
 * match the derived FQN is left alone.
 */
@Slf4j
public final class ContextFileFqnRepair {
  public static final String STEP_NAME = "repairContextFileFqns";
  private static final String TABLE = "context_file";
  private static final String IDS_BIND = "ids";
  private static final String FILE_JSON_SQL = "SELECT json FROM context_file WHERE id = :id";
  private static final String HOLDER_SQL = "SELECT id FROM context_file WHERE nameHash = :nameHash";
  private static final String DROP_TAG_SQL =
      "DELETE FROM tag_usage WHERE targetFQNHash = :targetFQNHash AND source = :source "
          + "AND tagFQNHash = :tagFQNHash";

  private ContextFileFqnRepair() {}

  private enum Outcome {
    REPAIRED,
    HELD_BY_ANOTHER_FILE,
    CHANGED_SINCE_READ,
    FAILED
  }

  /** The columns of a file row the scan compares, without the file's stored text. */
  private record StoredName(UUID id, String name, String fqn, String nameHash) {}

  /** A file whose stored FQN or nameHash differs from the FQN its folder gives it. */
  private record Misnamed(UUID id, String storedFqn, String derivedFqn) {}

  /** Files repaired, so a test can assert that a second run changes nothing. */
  public static int repairAll(final Handle handle, final ConnectionType connectionType) {
    CollectionDAO dao = handle.attach(CollectionDAO.class);
    List<Misnamed> pending =
        IdBatches.fold(
            handle,
            TABLE,
            new ArrayList<>(),
            (found, ids) -> {
              found.addAll(misnamed(handle, connectionType, dao, ids));
              return found;
            });
    if (pending.isEmpty()) {
      return 0;
    }
    final EntityFqnHolders holders =
        EntityFqnHolders.in(handle, EntityFqnHolders.registeredTables());
    int repaired = 0;
    int repairedInPass;
    do {
      List<Misnamed> held = new ArrayList<>();
      repairedInPass = 0;
      for (Misnamed file : pending) {
        Outcome outcome = repair(handle, holders, file);
        if (outcome == Outcome.REPAIRED) {
          repairedInPass++;
        } else if (outcome == Outcome.HELD_BY_ANOTHER_FILE) {
          held.add(file);
        }
      }
      repaired += repairedInPass;
      pending = held;
    } while (repairedInPass > 0 && !pending.isEmpty());
    pending.forEach(file -> logHeld(handle, file));
    if (repaired > 0) {
      LOG.info("Derived the FQN of {} Context Center files from their folders again", repaired);
    }
    return repaired;
  }

  /** The rows are read before their folders, so a move in between fails the rewrite's check. */
  private static List<Misnamed> misnamed(
      final Handle handle,
      final ConnectionType connectionType,
      final CollectionDAO dao,
      final List<String> ids) {
    List<StoredName> files = storedNames(handle, connectionType, ids);
    Map<UUID, List<UUID>> foldersByFile = foldersByFile(dao, ids);
    Map<UUID, String> folderFqns =
        folderFqns(dao, foldersByFile.values().stream().flatMap(List::stream).toList());
    List<Misnamed> result = new ArrayList<>();
    for (StoredName file : files) {
      List<UUID> folders = foldersByFile.getOrDefault(file.id(), List.of());
      String folderFqn = folders.size() == 1 ? folderFqns.get(folders.getFirst()) : null;
      if (!folders.isEmpty() && folderFqn == null) {
        LOG.warn(
            "Context Center file {} links to folders {} that do not resolve to one existing folder;"
                + " its FQN {} is left as it is",
            file.id(),
            folders,
            file.fqn());
        continue;
      }
      String derivedFqn =
          folderFqn == null ? file.name() : FullyQualifiedName.add(folderFqn, file.name());
      boolean matches =
          derivedFqn.equals(file.fqn())
              && FullyQualifiedName.buildHash(derivedFqn).equals(file.nameHash());
      if (!matches) {
        result.add(new Misnamed(file.id(), file.fqn(), derivedFqn));
      }
    }
    return result;
  }

  private static List<StoredName> storedNames(
      final Handle handle, final ConnectionType connectionType, final List<String> ids) {
    return handle
        .createQuery(storedNamesSql(connectionType))
        .bindList(IDS_BIND, ids)
        .map(
            (rs, ctx) ->
                new StoredName(
                    UUID.fromString(rs.getString(1)),
                    rs.getString(2),
                    rs.getString(3),
                    rs.getString(4)))
        .list();
  }

  private static String storedNamesSql(final ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> "SELECT id, name, JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName')),"
          + " nameHash FROM context_file WHERE id IN (<ids>)";
      case POSTGRES -> "SELECT id, name, json ->> 'fullyQualifiedName', nameHash"
          + " FROM context_file WHERE id IN (<ids>)";
    };
  }

  private static Map<UUID, List<UUID>> foldersByFile(
      final CollectionDAO dao, final List<String> ids) {
    Map<UUID, List<UUID>> foldersByFile = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject edge :
        dao.relationshipDAO().findFromBatch(ids, CONTEXT_FILE, Relationship.CONTAINS.ordinal())) {
      if (FOLDER_ENTITY.equals(edge.getFromEntity())) {
        foldersByFile
            .computeIfAbsent(UUID.fromString(edge.getToId()), id -> new ArrayList<>())
            .add(UUID.fromString(edge.getFromId()));
      }
    }
    return foldersByFile;
  }

  private static Map<UUID, String> folderFqns(
      final CollectionDAO dao, final Collection<UUID> folderIds) {
    if (folderIds.isEmpty()) {
      return Map.of();
    }
    return dao.folderDAO().findEntitiesByIds(List.copyOf(folderIds), Include.ALL).stream()
        .collect(
            Collectors.toMap(
                Folder::getId, Folder::getFullyQualifiedName, (first, second) -> first));
  }

  private static Outcome repair(
      final Handle handle, final EntityFqnHolders holders, final Misnamed misnamed) {
    try {
      if (otherHolder(handle, misnamed).isPresent()) {
        return Outcome.HELD_BY_ANOTHER_FILE;
      }
      final List<Holder> sharingStoredFqn =
          movesTags(misnamed)
              ? entitiesSharing(holders, misnamed.storedFqn(), misnamed.id())
              : List.of();
      final List<Holder> sharingDerivedFqn =
          movesTags(misnamed)
              ? entitiesSharing(holders, misnamed.derivedFqn(), misnamed.id())
              : List.of();
      final boolean moveTags =
          movesTags(misnamed) && sharingStoredFqn.isEmpty() && sharingDerivedFqn.isEmpty();
      Optional<ContextFile> repaired =
          handle.inTransaction(transaction -> rewrite(transaction, misnamed, moveTags));
      if (repaired.isEmpty()) {
        LOG.info(
            "Context Center file {} changed while its FQN was derived; its next edit derives it",
            misnamed.id());
        return Outcome.CHANGED_SINCE_READ;
      }
      EntityRepository.invalidateCacheForEntity(CONTEXT_FILE, misnamed.id(), misnamed.storedFqn());
      EntityRepository.invalidateCacheForEntity(CONTEXT_FILE, misnamed.id(), misnamed.derivedFqn());
      // A lookup of the derived FQN before the repair left a not-found marker that the entity
      // cache helper above does not clear.
      CacheBundle.invalidateEntity(CONTEXT_FILE, misnamed.id(), misnamed.derivedFqn());
      reindex(repaired.get());
      logCollisions(misnamed, sharingStoredFqn, sharingDerivedFqn);
      return Outcome.REPAIRED;
    } catch (Exception e) {
      LOG.warn(
          "Could not derive the FQN of Context Center file {} ({} -> {})",
          misnamed.id(),
          misnamed.storedFqn(),
          misnamed.derivedFqn(),
          e);
      return Outcome.FAILED;
    }
  }

  /** The id of another file whose nameHash is the one the derived FQN needs. */
  private static Optional<String> otherHolder(final Handle handle, final Misnamed misnamed) {
    return handle
        .createQuery(HOLDER_SQL)
        .bind("nameHash", FullyQualifiedName.buildHash(misnamed.derivedFqn()))
        .mapTo(String.class)
        .findOne()
        .filter(holder -> !holder.equals(misnamed.id().toString()));
  }

  /** Empty when the row no longer holds what the scan read, and then nothing is written. */
  private static Optional<ContextFile> rewrite(
      final Handle transaction, final Misnamed misnamed, final boolean moveTags) {
    Optional<String> storedJson =
        transaction
            .createQuery(FILE_JSON_SQL)
            .bind("id", misnamed.id().toString())
            .mapTo(String.class)
            .findOne();
    if (storedJson.isEmpty()) {
      return Optional.empty();
    }
    ContextFile file = JsonUtils.readValue(storedJson.get(), ContextFile.class);
    if (!Objects.equals(misnamed.storedFqn(), file.getFullyQualifiedName())) {
      return Optional.empty();
    }
    CollectionDAO dao = transaction.attach(CollectionDAO.class);
    file.setFullyQualifiedName(misnamed.derivedFqn());
    if (dao.contextFileDAO().updateIfMatches(file, storedJson.get()) == 0) {
      return Optional.empty();
    }
    if (moveTags) {
      moveTags(transaction, dao, misnamed.storedFqn(), misnamed.derivedFqn());
    }
    return Optional.of(file);
  }

  private static boolean movesTags(final Misnamed misnamed) {
    return misnamed.storedFqn() != null && !misnamed.storedFqn().equals(misnamed.derivedFqn());
  }

  /**
   * Every other entity, live or soft-deleted, whose FQN is the one given. A type whose table exists
   * but cannot be searched is listed too, so its rows are never taken from it. The file itself, when
   * the FQN is its stored FQN, is excluded: every row under that hash is the file's until proved
   * otherwise.
   */
  private static List<Holder> entitiesSharing(
      final EntityFqnHolders holders, final String fqn, final UUID id) {
    return holders.holding(fqn).stream()
        .filter(holder -> !holder.is(CONTEXT_FILE, id.toString()))
        .toList();
  }

  /** Logs each FQN another entity shares with the file, so its tag rows can be moved by hand. */
  private static void logCollisions(
      final Misnamed misnamed,
      final List<Holder> sharingStoredFqn,
      final List<Holder> sharingDerivedFqn) {
    if (!sharingStoredFqn.isEmpty()) {
      LOG.warn(
          "Context Center file {} now has the FQN {}. Its old FQN {} is also the FQN of {}, and"
              + " tag_usage does not record which entity a row belongs to, so every tag under {}"
              + " was left where it is. Move the file's own tags to {} by hand",
          misnamed.id(),
          misnamed.derivedFqn(),
          misnamed.storedFqn(),
          sharingStoredFqn,
          misnamed.storedFqn(),
          misnamed.derivedFqn());
    }
    if (!sharingDerivedFqn.isEmpty()) {
      LOG.warn(
          "Context Center file {} now has the FQN {}. Its new FQN {} is also the FQN of {}, and"
              + " tag_usage does not record which entity a row belongs to, so every tag under {}"
              + " was left where it is to keep the rows from merging under the one hash. Rename"
              + " the file or the other entity, then move the file's own tags to the file's new"
              + " FQN by hand",
          misnamed.id(),
          misnamed.derivedFqn(),
          misnamed.derivedFqn(),
          sharingDerivedFqn,
          misnamed.storedFqn());
    }
  }

  /** A tag under both FQNs keeps its row under the derived one, so the move breaks no key. */
  private static void moveTags(
      final Handle transaction,
      final CollectionDAO dao,
      final String storedFqn,
      final String derivedFqn) {
    String storedHash = FullyQualifiedName.buildHash(storedFqn);
    for (TagLabel tag : dao.tagUsageDAO().getTagsInternal(derivedFqn)) {
      transaction
          .createUpdate(DROP_TAG_SQL)
          .bind("targetFQNHash", storedHash)
          .bind("source", tag.getSource().ordinal())
          .bind("tagFQNHash", FullyQualifiedName.buildHash(tag.getTagFQN()))
          .execute();
    }
    dao.tagUsageDAO().updateTargetFQNHash(storedFqn, derivedFqn);
  }

  /** The search index is rebuilt by a reindex too, so an unreachable search must not fail this. */
  private static void reindex(final ContextFile file) {
    try {
      Entity.getSearchRepository().updateEntity(file.getEntityReference());
    } catch (Exception e) {
      LOG.warn(
          "Could not reindex Context Center file {}; run a reindex after the upgrade",
          file.getId(),
          e);
    }
  }

  private static void logHeld(final Handle handle, final Misnamed misnamed) {
    LOG.warn(
        "Context Center file {} keeps its FQN {}: file {} holds {}, the FQN its folder gives it."
            + " Move or delete one of the two; the file's next edit then takes that FQN",
        misnamed.id(),
        misnamed.storedFqn(),
        otherHolder(handle, misnamed).orElse("(none now)"),
        misnamed.derivedFqn());
  }
}
