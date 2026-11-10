package org.openmetadata.service.resources.audit;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.SecurityContext;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.context.ContextMemoryVisibility;
import org.openmetadata.service.resources.drive.ContextFileVisibility;
import org.openmetadata.service.resources.feeds.AnnouncementVisibility;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/** Audit entries follow the current entity's read rules, including after a soft delete. */
final class AuditLogEntityAccess {
  private static final Set<String> VISIBILITY_TYPES =
      Set.of(Entity.CONTEXT_MEMORY, Entity.CONTEXT_FILE, Entity.ANNOUNCEMENT);

  private AuditLogEntityAccess() {}

  static void authorizeEntity(
      Authorizer authorizer, SecurityContext context, String type, String fqn) {
    final ResourceContext<?> resource = resourceContext(type, fqn);
    authorizer.authorize(
        context, new OperationContext(type, MetadataOperation.VIEW_BASIC), resource);
    if (hasVisibilityRules(type) && !readsAll(context)) {
      enforceVisibility(resource.getEntity(), authorizer, context);
    }
  }

  static void authorizeCollection(Authorizer authorizer, SecurityContext context, String type) {
    if (nullOrEmpty(type) || hasVisibilityRules(type)) {
      authorizer.authorizeAdminOrBot(context);
    }
  }

  static boolean readsAll(SecurityContext context) {
    final SubjectContext subject = DefaultAuthorizer.getSubjectContext(context);
    return subject.isAdmin() || subject.isBot();
  }

  private static boolean hasVisibilityRules(String type) {
    return type != null && VISIBILITY_TYPES.contains(type);
  }

  private static ResourceContext<?> resourceContext(String type, String fqn) {
    final String fields =
        Entity.CONTEXT_FILE.equals(type)
            ? ContextFileVisibility.guardFields("")
            : ContextMemoryVisibility.guardFields(type, "");
    return new ResourceContext<>(
        type,
        null,
        fqn,
        Include.ALL,
        Entity.getEntityRepository(type).getFields(fields),
        RelationIncludes.fromInclude(Include.ALL));
  }

  static void enforceVisibility(
      EntityInterface<?> entity, Authorizer authorizer, SecurityContext context) {
    ContextMemoryVisibility.enforceVisibility(entity, context);
    if (entity instanceof ContextFile file) {
      ContextFileVisibility.enforceVisibility(file, context);
    }
    if (entity instanceof Announcement announcement) {
      AnnouncementVisibility.enforceVisibility(announcement, authorizer, context);
    }
  }
}
