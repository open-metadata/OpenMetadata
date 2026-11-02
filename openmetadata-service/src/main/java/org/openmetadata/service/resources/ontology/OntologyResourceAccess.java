package org.openmetadata.service.resources.ontology;

import jakarta.json.JsonPatch;
import jakarta.json.JsonValue;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
  private static final Set<String> CONTENT_FIELDS = Set.of("description", "tags");

  private OntologyResourceAccess() {}

  /**
   * Description and tag edits land in the next release for everyone, so on ontology resources they
   * need the same right as the rest of the content, not the per-field default.
   */
  static void requireEditForContentPatch(
      final Authorizer authorizer,
      final SecurityContext context,
      final String type,
      final UUID id,
      final JsonPatch patch) {
    if (touchesContent(patch)) {
      authorizer.authorize(
          context,
          new OperationContext(type, MetadataOperation.EDIT_ALL),
          new ResourceContext<>(type, id, null));
    }
  }

  static boolean touchesContent(final JsonPatch patch) {
    return patch.toJsonArray().stream()
        .map(JsonValue::asJsonObject)
        .map(operation -> operation.getString("path", ""))
        .anyMatch(path -> CONTENT_FIELDS.contains(firstSegment(path)));
  }

  private static String firstSegment(final String path) {
    final String trimmed = path.startsWith("/") ? path.substring(1) : path;
    final int slash = trimmed.indexOf('/');
    return slash < 0 ? trimmed : trimmed.substring(0, slash);
  }

  static void requireView(
      final Authorizer authorizer,
      final SecurityContext context,
      final List<? extends OntologyDefinition> definitions) {
    definitions.stream()
        .collect(Collectors.groupingBy(definition -> definition.getEntityReference().getType()))
        .forEach(
            (type, batch) ->
                requireView(authorizer, context, batch, Entity.getEntityRepository(type)));
  }

  private static <T extends EntityInterface<?>> void requireView(
      final Authorizer authorizer,
      final SecurityContext context,
      final List<? extends OntologyDefinition> definitions,
      final EntityRepository<T> repository) {
    final String type = repository.getEntityType();
    final List<T> batch = definitions.stream().map(repository.getEntityClass()::cast).toList();
    final String fields = Entity.entityHasField(type, "reviewers") ? "owners,reviewers" : "owners";
    repository.setFieldsInBulk(repository.getFields(fields), batch);
    batch.forEach(
        definition ->
            authorizer.authorize(
                context,
                new OperationContext(type, MetadataOperation.VIEW_ALL),
                new ResourceContext<>(type, definition, repository)));
  }
}
