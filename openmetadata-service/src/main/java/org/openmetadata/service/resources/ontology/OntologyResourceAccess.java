package org.openmetadata.service.resources.ontology;

import jakarta.json.JsonPatch;
import jakarta.json.JsonValue;
import jakarta.ws.rs.core.SecurityContext;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

/** Applies current policies to the definition snapshot actually being read. */
final class OntologyResourceAccess {
  private static final Set<String> CONTENT_FIELDS = Set.of("description", "tags");

  private OntologyResourceAccess() {}

  /**
   * A library install writes definitions through the job's own repository calls, so the caller
   * needs here what applying a stamped library change set needs: edit on the ontology and create
   * on each kind of definition the install adds.
   */
  static void requireLibraryInstall(
      final Authorizer authorizer, final SecurityContext context, final Ontology ontology) {
    authorizer.authorize(
        context,
        new OperationContext(Entity.ONTOLOGY, MetadataOperation.EDIT_ALL),
        new ResourceContext<>(Entity.ONTOLOGY, ontology.getId(), null));
    final EntityReference parent = ontology.getEntityReference();
    requireCreate(
        authorizer, context, Entity.ONTOLOGY_CONCEPT, new OntologyConcept().withOntology(parent));
    requireCreate(
        authorizer, context, Entity.ONTOLOGY_PROPERTY, new OntologyProperty().withOntology(parent));
    requireCreate(
        authorizer, context, Entity.ONTOLOGY_AXIOM, new OntologyAxiom().withOntology(parent));
  }

  private static <T extends EntityInterface<?>> void requireCreate(
      final Authorizer authorizer,
      final SecurityContext context,
      final String type,
      final T probe) {
    authorizer.authorize(
        context,
        new OperationContext(type, MetadataOperation.CREATE),
        new CreateResourceContext<>(type, probe));
  }

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

  /**
   * Working-draft content, which no release has published yet, is read with the right that edits
   * it (ADR:2026-11-03-ontology-working-draft-reads-require-edit-rights). Everyone else reads the
   * active release.
   */
  static void requireDraftRead(
      final Authorizer authorizer,
      final SecurityContext context,
      final ResourceContextInterface ontology) {
    authorizer.authorize(
        context, new OperationContext(Entity.ONTOLOGY, MetadataOperation.EDIT_ALL), ontology);
  }

  /** The draft rule for a list: one ontology when the request names it, else every ontology. */
  static void requireDraftListRead(
      final Authorizer authorizer, final SecurityContext context, final UUID ontologyId) {
    requireDraftRead(
        authorizer,
        context,
        ontologyId == null
            ? new ResourceContext<>(Entity.ONTOLOGY)
            : new ResourceContext<>(Entity.ONTOLOGY, ontologyId, null));
  }

  /**
   * An unscoped list names no ontology, so the type-level check above cannot see whose rows the
   * page holds, and a conditional rule such as {@code noOwner()} passes on a context with no
   * entity. Every distinct ontology on the page is therefore checked as a by-id read would. The
   * page is refused whole, not filtered, to keep {@code paging.total} and the cursors honest.
   */
  static void requireDraftRowsRead(
      final Authorizer authorizer,
      final SecurityContext context,
      final UUID requestedOntologyId,
      final Collection<UUID> rowOntologyIds) {
    if (requestedOntologyId != null) {
      return;
    }
    new LinkedHashSet<>(rowOntologyIds)
        .forEach(
            id ->
                requireDraftRead(
                    authorizer, context, new ResourceContext<>(Entity.ONTOLOGY, id, null)));
  }

  static List<UUID> ontologyIdsOf(final List<? extends OntologyDefinition> rows) {
    return rows.stream().map(row -> row.getOntology().getId()).toList();
  }

  /** A move or copy reads or removes its {@code from} field, so that field counts as touched. */
  static boolean touchesContent(final JsonPatch patch) {
    return patch.toJsonArray().stream()
        .map(JsonValue::asJsonObject)
        .anyMatch(
            operation ->
                CONTENT_FIELDS.contains(firstSegment(operation.getString("path", "")))
                    || CONTENT_FIELDS.contains(firstSegment(operation.getString("from", ""))));
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
    // Every attribute a condition reads; setFieldsInBulk clears the fields it is not asked for.
    repository.setFieldsInBulk(ResourceContext.authorizationFields(repository), batch);
    batch.forEach(
        definition ->
            authorizer.authorize(
                context,
                new OperationContext(type, MetadataOperation.VIEW_ALL),
                new ResourceContext<>(type, definition, repository)));
  }
}
