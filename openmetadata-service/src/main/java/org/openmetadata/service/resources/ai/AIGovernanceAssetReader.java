package org.openmetadata.service.resources.ai;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Pages the AI estate with the same per-asset ViewAll decision as an item read. */
public final class AIGovernanceAssetReader {
  private static final int PAGE_SIZE = 500;
  private final SecurityContext securityContext;
  private final ViewPermissionFilter permissions;

  public AIGovernanceAssetReader(
      final Authorizer authorizer, final SecurityContext securityContext) {
    this.securityContext = securityContext;
    this.permissions = new ViewPermissionFilter(authorizer);
  }

  static AIGovernanceAssetReader forReport(final Authorizer authorizer, final AuditReport report) {
    final EntityReference requester = report.getRequestedBy();
    if (requester == null || requester.getId() == null) {
      throw new AuthorizationException("Audit report has no requester; regenerate the report");
    }
    final User user = Entity.getEntity(Entity.USER, requester.getId(), "", Include.NON_DELETED);
    final SecurityContext context =
        new CatalogSecurityContext(
            () -> user.getName(), "https", CatalogSecurityContext.OPENID_AUTH, Set.of());
    return new AIGovernanceAssetReader(authorizer, context);
  }

  public List<EntityInterface<?>> list(final String entityType, final String fields) {
    return list(entityType, fields, Integer.MAX_VALUE);
  }

  @SuppressWarnings("unchecked")
  List<EntityInterface<?>> list(final String entityType, final String fields, final int limit) {
    final EntityRepository<EntityInterface<?>> repository =
        (EntityRepository<EntityInterface<?>>) Entity.getEntityRepository(entityType);
    final Fields projection =
        ResourceContext.authorizationFields(repository, repository.getFields(fields));
    final ListFilter filter = new ListFilter(Include.NON_DELETED);
    final List<EntityInterface<?>> result = new ArrayList<>();
    String after = null;
    do {
      final ResultList<EntityInterface<?>> page =
          repository.listAfter(
              null, projection, filter, Math.min(PAGE_SIZE, limit - result.size()), after);
      result.addAll(
          permissions.retainPermitted(
              securityContext,
              entityType,
              repository,
              page.getData(),
              List.of(MetadataOperation.VIEW_ALL)));
      after = page.getPaging() == null ? null : page.getPaging().getAfter();
    } while (after != null && result.size() < limit);
    return result;
  }
}
