/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.resources.context;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.SecurityContext;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiPredicate;
import java.util.stream.Collectors;
import org.jdbi.v3.core.JdbiException;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.search.security.ContextMemorySearchVisibility;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Visibility rules for {@link ContextMemory}. Every read on {@code /v1/contextCenter/memories} runs
 * through this check so a non-admin user cannot read another user's PRIVATE memory via the public
 * API. The rule is driven by the per-memory {@code shareConfig}; an {@code Entity} memory anchored
 * to an asset ({@code primaryEntity}) is readable only by readers of that asset.
 *
 * <p>Because it sits outside the policy model, no {@code authorizer.authorize(...)} call can ever
 * enforce it: a read path that authorizes and fetches is not yet a read path that is allowed to
 * answer. Callers that reach a memory without knowing they have (the MCP entity tools read any
 * type by name) use the type-blind {@link #enforceVisibility(EntityInterface, SecurityContext)}
 * together with {@link #guardFields(String, String)}.
 */
public final class ContextMemoryVisibility {

  private static final Logger LOG = LoggerFactory.getLogger(ContextMemoryVisibility.class);
  private static final int MAX_ANCHOR_DECISIONS_PER_PAGE = 1000;

  /**
   * The anchors one query may have evaluated, each a policy evaluation on the request path
   * (ADR:2026-10-09-search-admits-memories-of-pinned-anchors).
   */
  public static final int MAX_PINNED_ANCHORS = 20;

  /** The field selection that already asks for every allowed field, owners included. */
  private static final String ALL_FIELDS = "*";

  /** Relationship fields the decision reads. */
  private static final List<String> DECISION_FIELDS =
      List.of(Entity.FIELD_OWNERS, ContextMemoryRepository.FIELD_PRIMARY_ENTITY);

  /** Whether a caller may read the asset an Entity memory is anchored to. */
  @FunctionalInterface
  interface AnchorAccess {
    boolean canView(String userName, EntityReference anchor);
  }

  /** Whether a caller owns the document a memory was extracted from. */
  @FunctionalInterface
  interface SourceOwnership {
    boolean owns(String userName, EntityReference source);
  }

  /** The extraction sources each of some memories is linked to, read in one batch. */
  @FunctionalInterface
  interface LinkedDocuments {
    Map<UUID, List<EntityReference>> of(List<UUID> memoryIds);
  }

  /** The entities among some ids that anchor a memory, with their type. */
  @FunctionalInterface
  interface AnchorFinder {
    List<EntityReference> findAnchors(List<UUID> candidateIds);
  }

  private ContextMemoryVisibility() {}

  public static boolean isVisibleToUser(ContextMemory memory, String userName, boolean isAdmin) {
    return isVisibleToUser(memory, userName, isAdmin, ContextMemoryAnchorAccess::canView);
  }

  static boolean isVisibleToUser(
      ContextMemory memory, String userName, boolean isAdmin, AnchorAccess anchorAccess) {
    return isAdmin
        || isOwnedBy(memory, userName)
        || isVisibleThroughShareConfig(memory, userName, anchorAccess);
  }

  private static boolean isVisibleThroughShareConfig(
      ContextMemory memory, String userName, AnchorAccess anchorAccess) {
    MemoryVisibility visibility =
        memory.getShareConfig() == null ? null : memory.getShareConfig().getVisibility();
    boolean visible = false;
    if (visibility == MemoryVisibility.ENTITY || visibility == MemoryVisibility.PUBLIC) {
      visible = isAnchorReadable(memory, userName, anchorAccess);
    } else if (visibility == MemoryVisibility.SHARED) {
      visible = isInSharedWithList(memory, userName);
    }
    return visible;
  }

  /** Entity means "readers of the anchor"; an unanchored Entity memory stays org-wide. */
  private static boolean isAnchorReadable(
      ContextMemory memory, String userName, AnchorAccess anchorAccess) {
    EntityReference anchor = memory.getPrimaryEntity();
    return anchor == null || anchorAccess.canView(userName, anchor);
  }

  /**
   * The anchors among {@code pinnedAnchorIds} whose Entity memories {@code userName} may read under
   * the anchor rule above. Search cannot evaluate an anchor's policy for every hit, but it can for
   * the few anchors a query names: the agent's entity memory fetch and capture's duplicate probe
   * name one. Ids that do not parse, ids past {@link #MAX_PINNED_ANCHORS} and entities that anchor
   * no memory are dropped, so a query cannot make this evaluate an unbounded number of policies.
   */
  public static Set<String> readableAnchorIds(String userName, Collection<String> pinnedAnchorIds) {
    return readableAnchorIds(
        userName,
        pinnedAnchorIds,
        ContextMemoryVisibility::findAnchors,
        ContextMemoryAnchorAccess::canView);
  }

  static Set<String> readableAnchorIds(
      String userName,
      Collection<String> pinnedAnchorIds,
      AnchorFinder anchorFinder,
      AnchorAccess anchorAccess) {
    List<UUID> candidates = pinnedAnchors(pinnedAnchorIds);
    Set<String> readable = Set.of();
    if (userName != null && !candidates.isEmpty()) {
      readable =
          anchorFinder.findAnchors(candidates).stream()
              .filter(anchor -> anchorAccess.canView(userName, anchor))
              .map(anchor -> anchor.getId().toString())
              .collect(Collectors.toUnmodifiableSet());
    }
    return readable;
  }

  static List<UUID> pinnedAnchors(Collection<String> pinnedAnchorIds) {
    List<UUID> pinned =
        pinnedAnchorIds == null
            ? List.of()
            : pinnedAnchorIds.stream()
                .filter(Objects::nonNull)
                .map(ContextMemoryVisibility::parseAnchorId)
                .flatMap(Optional::stream)
                .distinct()
                .toList();
    if (pinned.size() > MAX_PINNED_ANCHORS) {
      LOG.debug(
          "A query pins {} memory anchors; only the first {} are evaluated",
          pinned.size(),
          MAX_PINNED_ANCHORS);
    }
    return pinned.size() > MAX_PINNED_ANCHORS
        ? List.copyOf(pinned.subList(0, MAX_PINNED_ANCHORS))
        : pinned;
  }

  private static Optional<UUID> parseAnchorId(String anchorId) {
    Optional<UUID> parsed = Optional.empty();
    try {
      parsed = Optional.of(UUID.fromString(anchorId.trim()));
    } catch (IllegalArgumentException e) {
      LOG.debug("Ignoring pinned anchor '{}': not an entity id", anchorId);
    }
    return parsed;
  }

  /** A lookup that cannot run leaves the query owner-only, as if it pinned nothing. */
  private static List<EntityReference> findAnchors(List<UUID> candidates) {
    List<EntityReference> anchors = List.of();
    if (Entity.hasEntityRepository(Entity.CONTEXT_MEMORY)) {
      try {
        anchors =
            ((ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY))
                .findAnchors(candidates);
      } catch (JdbiException e) {
        LOG.warn("Cannot resolve pinned memory anchors {}; search stays owner-only", candidates, e);
      }
    }
    return anchors;
  }

  public static void enforceVisibility(ContextMemory memory, String userName, boolean isAdmin) {
    if (!isVisibleToUser(memory, userName, isAdmin)) {
      throw new ForbiddenException(getVisibilityDeniedMessage(memory));
    }
  }

  public static void enforceVisibility(ContextMemory memory, SecurityContext securityContext) {
    if (memory != null) {
      enforceVisibility(memory, callerName(securityContext), isAdmin(securityContext));
    }
  }

  /**
   * The type-blind guard, for read paths that hold an entity without knowing its type. Applies the
   * rule when {@code entity} is a memory and does nothing for every other entity type, so a caller
   * needs no per-type knowledge to be safe.
   */
  public static void enforceVisibility(EntityInterface<?> entity, SecurityContext securityContext) {
    if (entity instanceof ContextMemory memory) {
      enforceVisibility(memory, securityContext);
    }
  }

  /** Whether reads of {@code entityType} are governed by a per-entity visibility rule. */
  public static boolean hasVisibilityRules(String entityType) {
    return Entity.CONTEXT_MEMORY.equals(entityType);
  }

  /**
   * Merges the fields the decision reads into a caller's field selection. Owners and primaryEntity
   * are relationship fields, null unless fetched: without owners an owner is denied their own
   * memory, without primaryEntity an anchored Entity memory reads as org-wide.
   */
  public static String guardFields(String entityType, String requestedFields) {
    String fields = requestedFields;
    if (hasVisibilityRules(entityType) && !ALL_FIELDS.equals(requestedFields)) {
      Set<String> requested = new LinkedHashSet<>(splitFields(requestedFields));
      requested.addAll(DECISION_FIELDS);
      fields = String.join(",", requested);
    }
    return fields;
  }

  private static List<String> splitFields(String fields) {
    return nullOrEmpty(fields) ? List.of() : List.of(fields.split(","));
  }

  public static List<ContextMemory> filterByVisibility(
      List<ContextMemory> memories, String userName, boolean isAdmin) {
    return filterByVisibility(memories, userName, isAdmin, ContextMemoryAnchorAccess::canView);
  }

  static List<ContextMemory> filterByVisibility(
      List<ContextMemory> memories, String userName, boolean isAdmin, AnchorAccess anchorAccess) {
    AnchorAccess cachedAccess = decidedOncePerPage(anchorAccess::canView)::test;
    return memories.stream()
        .filter(m -> isVisibleToUser(m, userName, isAdmin, cachedAccess))
        .toList();
  }

  /**
   * The memories a listing shows the caller: those they may read, except that a memory awaiting
   * review ({@link #isPending}) is listed to its owners and admins only, and a document's pending
   * pill to that document's owners too. A read by id still follows the share rules alone
   * (ADR:2026-11-03-context-center-listings-show-and-count-only-what-the-caller-may-read).
   */
  public static List<ContextMemory> filterListed(
      List<ContextMemory> memories, SecurityContext securityContext) {
    return memories == null || memories.isEmpty()
        ? memories
        : filterListed(
            memories,
            callerName(securityContext),
            isAdmin(securityContext),
            ContextMemoryAnchorAccess::canView,
            ContextMemoryVisibility::ownsSource,
            ContextMemoryVisibility::findLinkedDocuments);
  }

  static List<ContextMemory> filterListed(
      List<ContextMemory> memories,
      String userName,
      boolean isAdmin,
      AnchorAccess anchorAccess,
      SourceOwnership sourceOwnership,
      LinkedDocuments linkedDocuments) {
    List<ContextMemory> visible = filterByVisibility(memories, userName, isAdmin, anchorAccess);
    return isAdmin
        ? visible
        : withoutOthersPending(visible, userName, sourceOwnership, linkedDocuments);
  }

  private static List<ContextMemory> withoutOthersPending(
      List<ContextMemory> visible,
      String userName,
      SourceOwnership sourceOwnership,
      LinkedDocuments linkedDocuments) {
    Map<UUID, List<EntityReference>> documents =
        documentsOfOthersPending(visible, userName, linkedDocuments);
    SourceOwnership ownership = decidedOncePerPage(sourceOwnership::owns)::test;
    return visible.stream()
        .filter(
            m ->
                !isPending(m)
                    || isOwnedBy(m, userName)
                    || ownsAny(documents, m, userName, ownership))
        .toList();
  }

  /** Read once for the page's pending extracted pills; an anonymous caller owns no document. */
  private static Map<UUID, List<EntityReference>> documentsOfOthersPending(
      List<ContextMemory> visible, String userName, LinkedDocuments linkedDocuments) {
    List<UUID> asked =
        visible.stream()
            .filter(m -> userName != null && isPending(m) && isExtracted(m))
            .filter(m -> !isOwnedBy(m, userName))
            .map(ContextMemory::getId)
            .distinct()
            .toList();
    return asked.isEmpty() ? Map.of() : linkedDocuments.of(asked);
  }

  /** Whether {@code memory} still awaits review: Unprocessed or Draft. */
  public static boolean isPending(ContextMemory memory) {
    ContextMemoryStatus status = memory.getEntityStatus();
    return status != null && ContextMemorySearchVisibility.OWNER_PENDING_STATUSES.contains(status);
  }

  private static boolean isExtracted(ContextMemory memory) {
    return ContextMemoryWriteAccess.isAutomatedSource(memory.getSourceType());
  }

  /** One memory, one review: the owners of every document it is linked to may list it. */
  private static boolean ownsAny(
      Map<UUID, List<EntityReference>> documents,
      ContextMemory memory,
      String userName,
      SourceOwnership ownership) {
    return isExtracted(memory)
        && documents.getOrDefault(memory.getId(), List.of()).stream()
            .anyMatch(document -> ownership.owns(userName, document));
  }

  /** A lookup that cannot run lists a pending pill to its owners and admins only. */
  private static Map<UUID, List<EntityReference>> findLinkedDocuments(List<UUID> memoryIds) {
    Map<UUID, List<EntityReference>> documents = Map.of();
    if (Entity.hasEntityRepository(Entity.CONTEXT_MEMORY)) {
      try {
        documents =
            ((ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY))
                .listExtractedSources(memoryIds);
      } catch (JdbiException e) {
        LOG.warn("Cannot read the documents of pending memories; listing them to their owners", e);
      }
    }
    return documents;
  }

  /**
   * A document's owners as policies count them, an owning team's members included. A source or
   * user that is gone owns nothing.
   */
  static boolean ownsSource(String userName, EntityReference source) {
    boolean owns = false;
    try {
      EntityInterface entity = Entity.getEntity(source, Entity.FIELD_OWNERS, Include.NON_DELETED);
      owns = SubjectContext.getSubjectContext(userName).isOwner(entity.getOwners());
    } catch (EntityNotFoundException e) {
      LOG.debug("Memory source {} or user {} is gone; no ownership", source.getId(), userName, e);
    }
    return owns;
  }

  /** Whether a listing can hide nothing from this caller, so its database total stands. */
  public static boolean seesEveryMemory(SecurityContext securityContext) {
    return isAdmin(securityContext);
  }

  /** Each entity is decided once per page, however many of its memories the page holds. */
  private static BiPredicate<String, EntityReference> decidedOncePerPage(
      BiPredicate<String, EntityReference> decision) {
    Cache<UUID, Boolean> decisions =
        CacheBuilder.newBuilder().maximumSize(MAX_ANCHOR_DECISIONS_PER_PAGE).build();
    return (name, entity) -> {
      UUID entityId = entity.getId();
      if (entityId == null) {
        return decision.test(name, entity);
      }
      Boolean cached = decisions.getIfPresent(entityId);
      if (cached == null) {
        cached = decision.test(name, entity);
        decisions.put(entityId, cached);
      }
      return cached;
    };
  }

  public static List<ContextMemory> filterByVisibility(
      List<ContextMemory> memories, SecurityContext securityContext) {
    if (memories == null || memories.isEmpty()) {
      return memories;
    }
    return filterByVisibility(memories, callerName(securityContext), isAdmin(securityContext));
  }

  /**
   * The {@code snapshots} whose memory, among {@code current}, the caller may read now. A snapshot
   * carries the sharing it was written with, so deciding on it would keep showing what was shared
   * before the memory was made private.
   */
  public static List<ContextMemory> retainVisibleNow(
      List<ContextMemory> snapshots, List<ContextMemory> current, SecurityContext securityContext) {
    Set<UUID> visible =
        filterByVisibility(current, securityContext).stream()
            .map(ContextMemory::getId)
            .collect(Collectors.toSet());
    return snapshots.stream().filter(snapshot -> visible.contains(snapshot.getId())).toList();
  }

  /**
   * An anonymous caller matches no owner, shared principal or anchor reader, so it keeps only the
   * unanchored ENTITY memories; search's unresolvable-subject fallback keeps every ENTITY memory.
   */
  private static String callerName(SecurityContext securityContext) {
    return securityContext == null || securityContext.getUserPrincipal() == null
        ? null
        : securityContext.getUserPrincipal().getName();
  }

  static boolean isAdmin(SecurityContext securityContext) {
    boolean admin = false;
    if (callerName(securityContext) != null) {
      SubjectContext subject = DefaultAuthorizer.getSubjectContext(securityContext);
      admin = subject != null && subject.isAdmin();
    }
    return admin;
  }

  /**
   * Whether {@code userName} is among the owners. Only an owner of type user can be the caller: a
   * team owner named like the caller is a different principal.
   */
  public static boolean isOwnedBy(ContextMemory memory, String userName) {
    if (nullOrEmpty(memory.getOwners()) || userName == null) {
      return false;
    }
    return memory.getOwners().stream()
        .filter(o -> Entity.USER.equals(o.getType()))
        .anyMatch(o -> userName.equals(o.getName()) || userName.equals(o.getFullyQualifiedName()));
  }

  private static boolean isInSharedWithList(ContextMemory memory, String userName) {
    return memory.getShareConfig() != null
        && isSharedWith(memory.getShareConfig().getSharedWith(), userName);
  }

  /**
   * Whether {@code userName} is named by a sharing list, directly or through a team or domain they
   * belong to. Public because Context Center shares files by the same vocabulary, and one matcher
   * is what keeps the two from drifting apart.
   *
   * <p>Principals are matched by id, as search matches them. Users, teams and domains are named
   * independently of each other, so a name does not say which of them was shared with: a user who
   * signs up under a team's name is not a member of that team.
   */
  public static boolean isSharedWith(List<MemorySharedPrincipal> sharedWith, String userName) {
    if (nullOrEmpty(sharedWith)) {
      return false;
    }
    Set<String> principalIds = resolvePrincipalIdentifiers(userName);
    return sharedWith.stream()
        .anyMatch(
            sp ->
                sp.getPrincipal() != null
                    && sp.getPrincipal().getId() != null
                    && principalIds.contains(sp.getPrincipal().getId().toString()));
  }

  /**
   * The ids a sharing list may name to reach {@code userName}: their own, their teams' and their
   * domains'. A user that cannot be resolved is shared nothing.
   */
  static Set<String> resolvePrincipalIdentifiers(String userName) {
    Set<String> ids = Set.of();
    if (!nullOrEmpty(userName)) {
      try {
        User user =
            Entity.getEntityByName(Entity.USER, userName, "teams,domains", Include.NON_DELETED);
        ids = Set.copyOf(ContextMemorySearchVisibility.sharedPrincipalIds(user));
      } catch (RuntimeException e) {
        LOG.debug("Could not resolve shared principal ids for user '{}'", userName, e);
      }
    }
    return ids;
  }

  private static String getVisibilityDeniedMessage(ContextMemory memory) {
    String message = "Not authorized to access this memory.";
    if (memory.getShareConfig() != null) {
      message = deniedMessageFor(memory.getShareConfig().getVisibility());
    }
    return message;
  }

  private static String deniedMessageFor(MemoryVisibility visibility) {
    return switch (visibility == null ? MemoryVisibility.PRIVATE : visibility) {
      case PRIVATE -> "Memory with visibility PRIVATE is only accessible to its owner.";
      case SHARED -> "Memory with visibility SHARED is only accessible to explicitly shared users.";
      case ENTITY,
          PUBLIC -> "Memory with visibility ENTITY or PUBLIC is only accessible to users who can view its"
          + " primary entity.";
    };
  }
}
