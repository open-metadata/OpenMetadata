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

package org.openmetadata.service.resources.feeds;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AnnouncementRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * An entity announcement is shown on its asset, so reading one needs the ViewBasic that asset
 * needs (ADR:2026-11-03-reading-an-entity-announcement-needs-view-on-its-asset). The REST and
 * MCP reads apply the rule through this class.
 */
public final class AnnouncementVisibility {

  private AnnouncementVisibility() {}

  /** The type-blind guard, for read paths that hold an entity without knowing its type. */
  public static void enforceVisibility(EntityInterface<?> entity, SecurityContext securityContext) {
    if (entity instanceof Announcement announcement) {
      enforceVisibility(announcement, Entity.getAuthorizer(), securityContext);
    }
  }

  /** One whose asset cannot be resolved is left to admins. */
  public static void enforceVisibility(
      Announcement announcement, Authorizer authorizer, SecurityContext securityContext) {
    if (!nullOrEmpty(announcement.getEntityLink())) {
      EntityReference linked =
          repository().getLinkedEntities(List.of(announcement)).get(announcement.getId());
      if (linked == null) {
        authorizer.authorizeAdmin(securityContext);
      } else {
        authorizeView(authorizer, securityContext, linked);
      }
    }
  }

  /** Rows read per batch when counting the visible total of a first page. */
  static final int TOTAL_SCAN_BATCH = 500;

  /** Matches checked for the visible total; any past it are counted unchecked. */
  static final int TOTAL_SCAN_CAP = 10_000;

  /**
   * Leaves out of {@code page} the announcements on assets the caller may not view. On the first
   * page the total counts only visible matches, up to {@link #TOTAL_SCAN_CAP}; later pages only
   * subtract what they hid, which keeps paging cheap.
   */
  public static ResultList<Announcement> filterVisible(
      ResultList<Announcement> page,
      ListFilter filter,
      boolean firstPage,
      Authorizer authorizer,
      SecurityContext securityContext) {
    if (!isAdmin(securityContext)) {
      List<Announcement> visible = filterVisible(page.getData(), authorizer, securityContext);
      int hidden = page.getData().size() - visible.size();
      page.setData(visible);
      Paging paging = page.getPaging();
      if (paging != null && paging.getTotal() != null) {
        paging.setTotal(
            firstPage
                ? visibleTotal(filter, paging.getTotal(), authorizer, securityContext)
                : Math.max(paging.getTotal() - hidden, visible.size()));
      }
    }
    return page;
  }

  private static int visibleTotal(
      ListFilter filter, int total, Authorizer authorizer, SecurityContext securityContext) {
    int checked = Math.min(total, TOTAL_SCAN_CAP);
    int visible = 0;
    for (int offset = 0; offset < checked; offset += TOTAL_SCAN_BATCH) {
      List<Announcement> batch =
          repository().listBatch(filter, Math.min(TOTAL_SCAN_BATCH, checked - offset), offset);
      visible += filterVisible(batch, authorizer, securityContext).size();
    }
    return visible + (total - checked);
  }

  /** The announcements on assets the caller may view, with one check per asset type. */
  public static List<Announcement> filterVisible(
      List<Announcement> announcements, Authorizer authorizer, SecurityContext securityContext) {
    List<Announcement> visible = announcements;
    if (!isAdmin(securityContext)) {
      Map<UUID, EntityReference> linked = repository().getLinkedEntities(announcements);
      Set<UUID> viewable =
          new ViewPermissionFilter(authorizer)
              .viewableIds(securityContext, List.copyOf(linked.values()));
      visible =
          announcements.stream()
              .filter(announcement -> isVisible(announcement, linked, viewable))
              .toList();
    }
    return visible;
  }

  static void authorizeView(
      Authorizer authorizer, SecurityContext securityContext, EntityReference entity) {
    authorizer.authorize(
        securityContext,
        new OperationContext(entity.getType(), MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(entity.getType(), entity.getId(), null, Include.ALL));
  }

  private static boolean isVisible(
      Announcement announcement, Map<UUID, EntityReference> linked, Set<UUID> viewable) {
    EntityReference entity = linked.get(announcement.getId());
    return nullOrEmpty(announcement.getEntityLink())
        || (entity != null && viewable.contains(entity.getId()));
  }

  private static boolean isAdmin(SecurityContext securityContext) {
    return DefaultAuthorizer.getSubjectContext(securityContext).isAdmin();
  }

  private static AnnouncementRepository repository() {
    return (AnnouncementRepository) Entity.getEntityRepository(Entity.ANNOUNCEMENT);
  }
}
