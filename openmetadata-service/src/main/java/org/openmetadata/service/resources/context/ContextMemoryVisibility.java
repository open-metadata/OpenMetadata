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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.SecurityContext;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jdbi.v3.core.JdbiException;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
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
    Cache<UUID, Boolean> anchorDecisions =
        CacheBuilder.newBuilder().maximumSize(MAX_ANCHOR_DECISIONS_PER_PAGE).build();
    AnchorAccess cachedAccess =
        (name, anchor) -> {
          UUID anchorId = anchor.getId();
          if (anchorId == null) {
            return anchorAccess.canView(name, anchor);
          }
          Boolean cached = anchorDecisions.getIfPresent(anchorId);
          if (cached == null) {
            cached = anchorAccess.canView(name, anchor);
            anchorDecisions.put(anchorId, cached);
          }
          return cached;
        };
    return memories.stream()
        .filter(m -> isVisibleToUser(m, userName, isAdmin, cachedAccess))
        .toList();
  }

  public static List<ContextMemory> filterByVisibility(
      List<ContextMemory> memories, SecurityContext securityContext) {
    if (memories == null || memories.isEmpty()) {
      return memories;
    }
    return filterByVisibility(memories, callerName(securityContext), isAdmin(securityContext));
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

  private static boolean isAdmin(SecurityContext securityContext) {
    boolean admin = false;
    if (callerName(securityContext) != null) {
      SubjectContext subject = DefaultAuthorizer.getSubjectContext(securityContext);
      admin = subject != null && subject.isAdmin();
    }
    return admin;
  }

  public static boolean isOwnedBy(ContextMemory memory, String userName) {
    if (memory.getOwners() == null || memory.getOwners().isEmpty() || userName == null) {
      return false;
    }
    return memory.getOwners().stream()
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
                    && (principalIds.contains(sp.getPrincipal().getName())
                        || principalIds.contains(sp.getPrincipal().getFullyQualifiedName())));
  }

  static Set<String> resolvePrincipalIdentifiers(String userName) {
    Set<String> ids = new HashSet<>();
    ids.add(userName);
    try {
      User user =
          Entity.getEntityByName(Entity.USER, userName, "teams,domains", Include.NON_DELETED);
      addRefNames(ids, user.getTeams());
      addRefNames(ids, user.getDomains());
    } catch (Exception e) {
      LOG.debug("Could not resolve teams/domains for user '{}'", userName, e);
    }
    return ids;
  }

  private static void addRefNames(Set<String> ids, List<EntityReference> refs) {
    for (EntityReference ref : listOrEmpty(refs)) {
      if (ref.getName() != null) {
        ids.add(ref.getName());
      }
      if (ref.getFullyQualifiedName() != null) {
        ids.add(ref.getFullyQualifiedName());
      }
    }
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
