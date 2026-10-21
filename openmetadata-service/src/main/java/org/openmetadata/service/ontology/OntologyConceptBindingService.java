package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.UpdateOntologyConceptBinding;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyBoundColumn;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyColumnBindingState;
import org.openmetadata.schema.type.OntologyConceptBindings;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.type.OntologyHydratedAssetBinding;
import org.openmetadata.schema.type.OntologyHydratedColumnBinding;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.OntologyConceptBindingStore;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FreshReadScope;

@Slf4j
public final class OntologyConceptBindingService {
  private final OntologyConceptBindingStore store;
  private final Authorizer authorizer;
  private final Function<String, EntityRepository<?>> repositories;

  public record Access(UriInfo uriInfo, SecurityContext securityContext) {}

  public OntologyConceptBindingService(
      final OntologyConceptBindingStore store,
      final Authorizer authorizer,
      final Function<String, EntityRepository<?>> repositories) {
    this.store = store;
    this.authorizer = authorizer;
    this.repositories = repositories;
  }

  public OntologyConceptBindingsResponse get(final Access access, final UUID conceptId) {
    try (final var ignored = FreshReadScope.enter()) {
      final var concept = concept(access, conceptId, MetadataOperation.VIEW_BASIC);
      store.requireLiveOntology(concept);
      return hydrate(access, concept, store.read(conceptId));
    }
  }

  public OntologyConceptBindingsResponse put(
      final Access access, final UUID conceptId, final UpdateOntologyConceptBinding request) {
    if (request == null) {
      throw new BadRequestException("A binding update is required");
    }
    OntologyBindingRules.requireRevision(request.getExpectedRevision());
    OntologyBindingRules.validate(request.getAsset());
    final var concept = concept(access, conceptId, MetadataOperation.EDIT_ALL);
    final var updated =
        store.update(
            concept,
            (currentConcept, current) -> replace(access, currentConcept, current, request));
    return hydrate(access, concept, updated);
  }

  public OntologyConceptBindingsResponse remove(
      final Access access,
      final UUID conceptId,
      final String assetType,
      final UUID assetId,
      final Long expectedRevision) {
    OntologyBindingRules.requireRevision(expectedRevision);
    final var type = assetType(assetType);
    final var concept = concept(access, conceptId, MetadataOperation.EDIT_ALL);
    final var updated =
        store.update(
            concept,
            (currentConcept, current) -> {
              concept(access, currentConcept.getId(), MetadataOperation.EDIT_ALL);
              authorized(access, type.value(), assetId, MetadataOperation.VIEW_BASIC);
              final var live = liveTargets(access, current);
              final var result = OntologyBindingRules.remove(live, type, assetId, expectedRevision);
              return result == live ? current : result;
            });
    return hydrate(access, concept, updated);
  }

  private OntologyConceptBindings replace(
      final Access access,
      final OntologyConcept concept,
      final OntologyConceptBindings current,
      final UpdateOntologyConceptBinding request) {
    concept(access, concept.getId(), MetadataOperation.EDIT_ALL);
    final var asset = request.getAsset();
    final var target =
        authorized(
            access, asset.getAssetType().value(), asset.getAssetId(), MetadataOperation.VIEW_BASIC);
    final var live = liveTargets(access, current);
    final var updated = OntologyBindingRules.replace(live, asset, request.getExpectedRevision());
    if (updated != live) {
      validateColumns(access, concept, current, new Candidate(asset, target));
    }
    return updated == live ? current : updated;
  }

  private OntologyConceptBindings liveTargets(
      final Access access, final OntologyConceptBindings current) {
    return new OntologyConceptBindings()
        .withRevision(current.getRevision())
        .withAssets(
            current.getAssets().stream().filter(asset -> isLiveTarget(access, asset)).toList());
  }

  private boolean isLiveTarget(final Access access, final OntologyAssetBinding asset) {
    try {
      final var target =
          repositories
              .apply(asset.getAssetType().value())
              .get(access.uriInfo(), asset.getAssetId(), new Fields(Set.of()), Include.ALL, false);
      return !Boolean.TRUE.equals(target.getDeleted());
    } catch (final EntityNotFoundException missing) {
      return false;
    }
  }

  private void validateColumns(
      final Access access,
      final OntologyConcept concept,
      final OntologyConceptBindings current,
      final Candidate candidate) {
    final var asset = candidate.binding();
    final var existing =
        OntologyBindingRules.find(current, asset.getAssetType(), asset.getAssetId());
    final var retained =
        existing == null ? List.<OntologyColumnBinding>of() : listOrEmpty(existing.getColumns());
    final var additions =
        listOrEmpty(asset.getColumns()).stream()
            .filter(binding -> !retained.contains(binding))
            .toList();
    final var ancestors = additions.isEmpty() ? Set.<String>of() : store.ancestors(concept);
    for (final var binding : additions) {
      final var property =
          (OntologyProperty)
              authorized(
                  access,
                  Entity.ONTOLOGY_PROPERTY,
                  binding.getPropertyId(),
                  MetadataOperation.VIEW_BASIC);
      if (!OntologyBindingRules.isApplicable(concept, property, ancestors)
          || !(candidate.entity() instanceof Table table)
          || OntologyBindingRules.resolveColumn(table, binding.getColumnPath()) == null) {
        throw new BadRequestException(
            "Bindings require an applicable same-ontology DATA property and an existing exact column path");
      }
    }
  }

  private OntologyConceptBindingsResponse hydrate(
      final Access access, final OntologyConcept concept, final OntologyConceptBindings bindings) {
    try (final var ignored = FreshReadScope.enter()) {
      final var ancestors =
          bindings.getAssets().stream()
                  .anyMatch(asset -> !listOrEmpty(asset.getColumns()).isEmpty())
              ? store.ancestors(concept)
              : Set.<String>of();
      final var hydration = new Hydration(access, concept, ancestors);
      return new OntologyConceptBindingsResponse()
          .withRevision(bindings.getRevision())
          .withAssets(
              bindings.getAssets().stream()
                  .flatMap(asset -> hydrateAsset(hydration, asset).stream())
                  .toList());
    }
  }

  private Optional<OntologyHydratedAssetBinding> hydrateAsset(
      final Hydration hydration, final OntologyAssetBinding binding) {
    return readable(hydration.access(), binding.getAssetType().value(), binding.getAssetId())
        .map(
            asset ->
                new OntologyHydratedAssetBinding()
                    .withAssetType(binding.getAssetType())
                    .withAssetId(binding.getAssetId())
                    .withAsset(asset.getEntityReference())
                    .withColumns(
                        listOrEmpty(binding.getColumns()).stream()
                            .map(column -> hydrateColumn(hydration, asset, column))
                            .toList()));
  }

  private OntologyHydratedColumnBinding hydrateColumn(
      final Hydration hydration,
      final EntityInterface<?> asset,
      final OntologyColumnBinding binding) {
    final var property =
        readable(hydration.access(), Entity.ONTOLOGY_PROPERTY, binding.getPropertyId())
            .map(OntologyProperty.class::cast);
    final var column =
        asset instanceof Table table
            ? OntologyBindingRules.resolveColumn(table, binding.getColumnPath())
            : null;
    final boolean resolved =
        column != null
            && property
                .filter(
                    value ->
                        OntologyBindingRules.isApplicable(
                            hydration.concept(), value, hydration.ancestors()))
                .isPresent();
    return new OntologyHydratedColumnBinding()
        .withPropertyId(binding.getPropertyId())
        .withColumnPath(binding.getColumnPath())
        .withState(
            resolved ? OntologyColumnBindingState.RESOLVED : OntologyColumnBindingState.UNRESOLVED)
        .withProperty(property.map(OntologyProperty::getEntityReference).orElse(null))
        .withColumn(column == null ? null : columnMetadata(column));
  }

  private static OntologyBoundColumn columnMetadata(final Column column) {
    return new OntologyBoundColumn()
        .withName(column.getName())
        .withDisplayName(column.getDisplayName())
        .withFullyQualifiedName(column.getFullyQualifiedName())
        .withDescription(column.getDescription())
        .withDataType(column.getDataType())
        .withDataTypeDisplay(column.getDataTypeDisplay());
  }

  private Optional<EntityInterface<?>> readable(
      final Access access, final String type, final UUID id) {
    try {
      return Optional.of(authorized(access, type, id, MetadataOperation.VIEW_BASIC));
    } catch (final AuthorizationException | EntityNotFoundException unavailable) {
      LOG.debug("Binding target {} {} is unavailable to the current reader", type, id);
      return Optional.empty();
    }
  }

  private OntologyConcept concept(
      final Access access, final UUID id, final MetadataOperation operation) {
    return (OntologyConcept) authorized(access, Entity.ONTOLOGY_CONCEPT, id, operation);
  }

  private EntityInterface<?> authorized(
      final Access access, final String type, final UUID id, final MetadataOperation operation) {
    return authorized(access, repositories.apply(type), id, operation);
  }

  private <T extends EntityInterface<?>> T authorized(
      final Access access,
      final EntityRepository<T> repository,
      final UUID id,
      final MetadataOperation operation) {
    final var fieldNames =
        new HashSet<>(ResourceContext.authorizationFields(repository).getFieldList());
    if (Entity.TABLE.equals(repository.getEntityType())) {
      fieldNames.add(Entity.FIELD_COLUMNS);
    }
    final T entity =
        repository.get(access.uriInfo(), id, new Fields(fieldNames), Include.NON_DELETED, false);
    authorizer.authorize(
        access.securityContext(),
        new OperationContext(repository.getEntityType(), operation),
        new ResourceContext<>(repository.getEntityType(), entity, repository));
    return entity;
  }

  private static OntologyBindingAssetType assetType(final String value) {
    try {
      return OntologyBindingAssetType.fromValue(value);
    } catch (final IllegalArgumentException invalid) {
      throw new BadRequestException("Unsupported ontology binding asset type", invalid);
    }
  }

  private record Candidate(OntologyAssetBinding binding, EntityInterface<?> entity) {}

  private record Hydration(Access access, OntologyConcept concept, Set<String> ancestors) {}
}
