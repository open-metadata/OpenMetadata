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

package org.openmetadata.service.resources.drive;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.SecurityContext;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.context.ContextMemoryVisibility;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Visibility rules for {@link ContextFile}, driven by its {@code shareConfig} rather than by the
 * policy model — the same arrangement {@link ContextMemoryVisibility} describes, and it shares that
 * class's principal matcher so the two cannot drift.
 *
 * <p>One rule differs, and it is the important one: a file with no {@code shareConfig} is visible.
 * Every file uploaded before the field existed has none, and the field marks a file as restricted
 * rather than marking the rest as public. Files that must stay private say so.
 */
public final class ContextFileVisibility {

  /** The field selection that already asks for every allowed field, owners included. */
  private static final String ALL_FIELDS = "*";

  private ContextFileVisibility() {}

  public static boolean isVisibleToUser(ContextFile file, String userName, boolean isAdmin) {
    if (isAdmin) {
      return true;
    }
    MemoryShareConfig share = file.getShareConfig();
    if (share == null || share.getVisibility() == null) {
      return true;
    }
    if (isOwnedBy(file, userName)) {
      return true;
    }
    if (share.getVisibility() == MemoryVisibility.ENTITY) {
      return true;
    }
    return share.getVisibility() == MemoryVisibility.SHARED
        && ContextMemoryVisibility.isSharedWith(share.getSharedWith(), userName);
  }

  public static void enforceVisibility(ContextFile file, SecurityContext securityContext) {
    if (file != null
        && !isVisibleToUser(file, callerName(securityContext), isAdmin(securityContext))) {
      throw new ForbiddenException(deniedMessage(file));
    }
  }

  /**
   * Drops the files this caller may not see, keeping the page's cursors. A filtered page can come
   * back shorter than the limit asked for; the cursors still walk every file, which is what keeps
   * the next page from skipping any.
   */
  public static ResultList<ContextFile> filterByVisibility(
      ResultList<ContextFile> files, SecurityContext securityContext) {
    if (files == null || nullOrEmpty(files.getData())) {
      return files;
    }
    String userName = callerName(securityContext);
    boolean admin = isAdmin(securityContext);
    return files.filter(file -> isVisibleToUser(file, userName, admin));
  }

  /**
   * Merges the fields the decision reads into a caller's selection. Owners and shareConfig are null
   * unless the fetch asked for them, and a read that omits them hands the guard a file that looks
   * ownerless and unrestricted.
   */
  public static String guardFields(String requestedFields) {
    if (ALL_FIELDS.equals(requestedFields)) {
      return requestedFields;
    }
    Set<String> requested =
        new LinkedHashSet<>(
            nullOrEmpty(requestedFields) ? List.of() : List.of(requestedFields.split(",")));
    requested.add(Entity.FIELD_OWNERS);
    return String.join(",", requested);
  }

  public static boolean isOwnedBy(ContextFile file, String userName) {
    if (nullOrEmpty(file.getOwners()) || userName == null) {
      return false;
    }
    return file.getOwners().stream()
        .anyMatch(
            owner ->
                userName.equals(owner.getName()) || userName.equals(owner.getFullyQualifiedName()));
  }

  /** A caller too anonymous to decide from is treated as one, not waved through. */
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

  private static String deniedMessage(ContextFile file) {
    MemoryVisibility visibility = file.getShareConfig().getVisibility();
    if (visibility == MemoryVisibility.SHARED) {
      return "This document is only accessible to the people it is shared with.";
    }
    return "This document is private to its owner.";
  }
}
