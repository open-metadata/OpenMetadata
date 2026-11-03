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
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AnnouncementRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * An entity announcement is shown on its asset, so reading one needs the ViewBasic that asset
 * needs (ADR:2026-11-03-reading-an-entity-announcement-needs-view-on-its-asset). Every read path
 * (REST and MCP) applies the rule through this class.
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

  /**
   * Leaves out of {@code page} the announcements on assets the caller may not view, and takes them
   * off its total; announcements hidden on other pages are still counted there.
   */
  public static ResultList<Announcement> filterVisible(
      ResultList<Announcement> page, Authorizer authorizer, SecurityContext securityContext) {
    List<Announcement> visible = filterVisible(page.getData(), authorizer, securityContext);
    int hidden = page.getData().size() - visible.size();
    if (hidden > 0 && page.getPaging() != null && page.getPaging().getTotal() != null) {
      page.getPaging().setTotal(Math.max(page.getPaging().getTotal() - hidden, visible.size()));
    }
    page.setData(visible);
    return page;
  }

  /** The announcements on assets the caller may view, with one check per asset type. */
  public static List<Announcement> filterVisible(
      List<Announcement> announcements, Authorizer authorizer, SecurityContext securityContext) {
    List<Announcement> visible = announcements;
    if (!DefaultAuthorizer.getSubjectContext(securityContext).isAdmin()) {
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

  private static AnnouncementRepository repository() {
    return (AnnouncementRepository) Entity.getEntityRepository(Entity.ANNOUNCEMENT);
  }
}
