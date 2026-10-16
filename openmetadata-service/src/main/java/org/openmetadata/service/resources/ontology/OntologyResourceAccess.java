package org.openmetadata.service.resources.ontology;

import jakarta.ws.rs.core.SecurityContext;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/** Applies current policies to the definition snapshot actually being read. */
final class OntologyResourceAccess {
  private OntologyResourceAccess() {}

  static void requireView(
      final Authorizer authorizer,
      final SecurityContext context,
      final OntologyDefinition definition) {
    final String type = definition.getEntityReference().getType();
    requireView(authorizer, context, definition, Entity.getEntityRepository(type));
  }

  private static <T extends EntityInterface<?>> void requireView(
      final Authorizer authorizer,
      final SecurityContext context,
      final OntologyDefinition definition,
      final EntityRepository<T> repository) {
    final String type = repository.getEntityType();
    authorizer.authorize(
        context,
        new OperationContext(type, MetadataOperation.VIEW_ALL),
        new ResourceContext<>(type, repository.getEntityClass().cast(definition), repository));
  }
}
