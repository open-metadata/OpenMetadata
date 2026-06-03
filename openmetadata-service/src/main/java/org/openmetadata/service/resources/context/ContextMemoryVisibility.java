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

import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.SecurityContext;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Visibility rules for {@link ContextMemory}. Every read on {@code /v1/contextCenter/memories} runs
 * through this check so a non-admin user cannot read another user's PRIVATE memory via the public
 * API. Visibility is independent of the OSS policy/authorizer model because it is driven by the
 * per-memory {@code shareConfig} (visibility + sharedWith) rather than role/policy.
 */
public final class ContextMemoryVisibility {

  private static final Logger LOG = LoggerFactory.getLogger(ContextMemoryVisibility.class);

  private ContextMemoryVisibility() {}

  public static boolean isVisibleToUser(ContextMemory memory, String userName, boolean isAdmin) {
    if (isAdmin) {
      return true;
    }
    if (isOwnedBy(memory, userName)) {
      return true;
    }
    if (memory.getShareConfig() == null) {
      return false;
    }
    MemoryVisibility visibility = memory.getShareConfig().getVisibility();
    if (visibility == MemoryVisibility.ENTITY) {
      return true;
    }
    if (visibility == MemoryVisibility.SHARED) {
      return isInSharedWithList(memory, userName);
    }
    return false;
  }

  public static void enforceVisibility(ContextMemory memory, String userName, boolean isAdmin) {
    if (!isVisibleToUser(memory, userName, isAdmin)) {
      throw new ForbiddenException(getVisibilityDeniedMessage(memory));
    }
  }

  public static void enforceVisibility(ContextMemory memory, SecurityContext securityContext) {
    if (memory == null || securityContext == null || securityContext.getUserPrincipal() == null) {
      return;
    }
    SubjectContext subject = DefaultAuthorizer.getSubjectContext(securityContext);
    enforceVisibility(memory, securityContext.getUserPrincipal().getName(), subject.isAdmin());
  }

  public static List<ContextMemory> filterByVisibility(
      List<ContextMemory> memories, String userName, boolean isAdmin) {
    return memories.stream().filter(m -> isVisibleToUser(m, userName, isAdmin)).toList();
  }

  public static List<ContextMemory> filterByVisibility(
      List<ContextMemory> memories, SecurityContext securityContext) {
    if (memories == null || memories.isEmpty()) {
      return memories;
    }
    if (securityContext == null || securityContext.getUserPrincipal() == null) {
      return memories;
    }
    SubjectContext subject = DefaultAuthorizer.getSubjectContext(securityContext);
    return filterByVisibility(
        memories, securityContext.getUserPrincipal().getName(), subject.isAdmin());
  }

  public static boolean isOwnedBy(ContextMemory memory, String userName) {
    if (memory.getOwners() == null || memory.getOwners().isEmpty() || userName == null) {
      return false;
    }
    return memory.getOwners().stream()
        .anyMatch(o -> userName.equals(o.getName()) || userName.equals(o.getFullyQualifiedName()));
  }

  private static boolean isInSharedWithList(ContextMemory memory, String userName) {
    if (memory.getShareConfig() == null || memory.getShareConfig().getSharedWith() == null) {
      return false;
    }
    Set<String> principalIds = resolvePrincipalIdentifiers(userName);
    return memory.getShareConfig().getSharedWith().stream()
        .anyMatch(
            sp ->
                sp.getPrincipal() != null
                    && (principalIds.contains(sp.getPrincipal().getName())
                        || principalIds.contains(sp.getPrincipal().getFullyQualifiedName())));
  }

  private static Set<String> resolvePrincipalIdentifiers(String userName) {
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
    if (memory.getShareConfig() == null) {
      return "Not authorized to access this memory.";
    }
    MemoryVisibility visibility = memory.getShareConfig().getVisibility();
    if (visibility == null || visibility == MemoryVisibility.PRIVATE) {
      return "Memory with visibility PRIVATE is only accessible to its owner.";
    }
    if (visibility == MemoryVisibility.SHARED) {
      return "Memory with visibility SHARED is only accessible to explicitly shared users.";
    }
    return "Not authorized to access this memory.";
  }
}
