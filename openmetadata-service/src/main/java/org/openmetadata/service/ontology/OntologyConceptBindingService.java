package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.jdbi3.OntologyConceptBindingStore.SCAN_PAGE_SIZE;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.type.OntologyHydratedAssetBinding;
import org.openmetadata.schema.type.OntologyHydratedColumnBinding;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingRow;
import org.openmetadata.service.jdbi3.OntologyConceptBindingStore;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.BulkFieldHydrator;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FreshReadScope;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public final class OntologyConceptBindingService {
  public static final int MAX_PAGE_SIZE = 100;

  static final int SCAN_BUDGET_MULTIPLIER = 10;

  private static final int MAX_CURSOR_LENGTH = 256;
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

  public OntologyConceptBindingsResponse get(
      final Access access, final UUID conceptId, final int limit, final String after) {
    final UUID start = decodeCursor(after);
    try (final var ignored = FreshReadScope.enter()) {
      final var concept = concept(access, conceptId, MetadataOperation.VIEW_BASIC);
      store.requireLiveOntology(concept);
      return page(access, concept, store.revision(conceptId), start, limit);
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
    store.update(
        concept,
        (lockedConcept, locked, current) ->
            replace(access, lockedConcept, locked, current, request));
    return firstPage(access, concept);
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
    store.update(
        concept,
        (lockedConcept, locked, current) -> {
          concept(access, lockedConcept.getId(), MetadataOperation.EDIT_ALL);
          authorized(access, type.value(), assetId, MetadataOperation.VIEW_BASIC);
          if (locked.find(lockedConcept.getId(), assetId) == null) {
            return current;
          }
          final long next = OntologyBindingRules.nextRevision(current, expectedRevision);
          prune(locked, lockedConcept.getId(), assetId);
          locked.remove(lockedConcept.getId(), assetId);
          return next;
        });
    return firstPage(access, concept);
  }

  private long replace(
      final Access access,
      final OntologyConcept concept,
      final OntologyConceptBindingStore locked,
      final long current,
      final UpdateOntologyConceptBinding request) {
    concept(access, concept.getId(), MetadataOperation.EDIT_ALL);
    final var asset = request.getAsset();
    final var target =
        authorized(
            access, asset.getAssetType().value(), asset.getAssetId(), MetadataOperation.VIEW_BASIC);
    final var existing = locked.find(concept.getId(), asset.getAssetId());
    if (existing != null
        && existing.assetType() == asset.getAssetType()
        && OntologyBindingRules.sameColumns(existing.columns(), asset.getColumns())) {
      return current;
    }
    final long next = OntologyBindingRules.nextRevision(current, request.getExpectedRevision());
    final int retained = prune(locked, concept.getId(), asset.getAssetId());
    OntologyBindingRules.requireColumnCapacity(retained + listOrEmpty(asset.getColumns()).size());
    validateColumns(
        access, concept, existing == null ? List.of() : existing.columns(), asset, target);
    locked.save(
        concept.getId(), asset, FullyQualifiedName.buildHash(target.getFullyQualifiedName()));
    return next;
  }

  /**
   * Deletes the rows whose assets are gone one page at a time, so a write holds one page however
   * many assets the concept binds, and returns the column assignments the surviving rows hold on
   * assets other than {@code written}. Pages are keyed by asset id, so deleting rows already
   * examined never moves the cursor.
   */
  private static int prune(
      final OntologyConceptBindingStore locked, final UUID conceptId, final UUID written) {
    int retained = 0;
    UUID after = null;
    List<BindingRow> rows;
    do {
      rows = locked.page(conceptId, after, SCAN_PAGE_SIZE);
      retained += retainLive(locked, conceptId, rows, written);
      after = rows.isEmpty() ? null : rows.getLast().assetId();
    } while (rows.size() == SCAN_PAGE_SIZE);
    return retained;
  }

  private static int retainLive(
      final OntologyConceptBindingStore locked,
      final UUID conceptId,
      final List<BindingRow> rows,
      final UUID written) {
    final var live = locked.liveAssets(rows).keySet();
    locked.remove(
        conceptId,
        rows.stream().map(BindingRow::assetId).filter(assetId -> !live.contains(assetId)).toList());
    return rows.stream()
        .filter(row -> live.contains(row.assetId()) && !row.assetId().equals(written))
        .mapToInt(row -> row.columns().size())
        .sum();
  }

  private void validateColumns(
      final Access access,
      final OntologyConcept concept,
      final List<OntologyColumnBinding> retained,
      final OntologyAssetBinding asset,
      final EntityInterface<?> target) {
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
          || !(target instanceof Table table)
          || OntologyBindingRules.resolveColumn(table, binding.getColumnPath()) == null) {
        throw new BadRequestException(
            "Bindings require an applicable same-ontology DATA property and an existing exact column path");
      }
    }
  }

  private OntologyConceptBindingsResponse firstPage(
      final Access access, final OntologyConcept concept) {
    try (final var ignored = FreshReadScope.enter()) {
      return page(access, concept, store.revision(concept.getId()), null, MAX_PAGE_SIZE);
    }
  }

  /**
   * Walks rows in asset id order until one more visible asset than the page holds is found, so the
   * cursor then points at the last returned asset. Hidden and deleted rows take no slot but count
   * against the scan budget; when it runs out first, the cursor points at the last row examined and
   * the page is short, so a reader hidden from most of a large concept pays a bounded price per
   * request.
   */
  private OntologyConceptBindingsResponse page(
      final Access access,
      final OntologyConcept concept,
      final long revision,
      final UUID after,
      final int limit) {
    final List<Visible> visible = new ArrayList<>();
    final int budget = limit * SCAN_BUDGET_MULTIPLIER;
    int scanned = 0;
    boolean exhausted = false;
    UUID cursor = after;
    while (visible.size() <= limit && scanned < budget) {
      final int batchSize = Math.min(limit + 1, budget - scanned);
      final var batch = store.page(concept.getId(), cursor, batchSize);
      visible.addAll(visibleAssets(access, batch));
      scanned += batch.size();
      if (batch.size() < batchSize) {
        exhausted = true;
        break;
      }
      cursor = batch.getLast().assetId();
    }
    final boolean more = visible.size() > limit;
    final var assets = visible.subList(0, Math.min(limit, visible.size()));
    final UUID next = more ? assets.getLast().row().assetId() : exhausted ? null : cursor;
    final var ancestors =
        assets.stream().anyMatch(asset -> !asset.row().columns().isEmpty())
            ? store.ancestors(concept)
            : Set.<String>of();
    final var hydration = new Hydration(access, concept, ancestors, new HashMap<>());
    return new OntologyConceptBindingsResponse()
        .withRevision(revision)
        .withAssets(assets.stream().map(asset -> hydrateAsset(hydration, asset)).toList())
        .withAfter(next == null ? null : RestUtil.encodeCursor(next.toString()));
  }

  private List<Visible> visibleAssets(final Access access, final List<BindingRow> rows) {
    final var live = store.liveAssets(rows);
    final Map<UUID, EntityInterface<?>> viewable = new HashMap<>();
    BindingRow.assetIdsByType(rows)
        .forEach(
            (type, ids) ->
                loadViewable(
                    access,
                    repositories.apply(type.value()),
                    ids.stream().filter(live::containsKey).toList(),
                    viewable));
    return rows.stream()
        .filter(row -> viewable.containsKey(row.assetId()))
        .map(
            row ->
                new Visible(
                    row, viewable.get(row.assetId()), live.get(row.assetId()).serviceType()))
        .toList();
  }

  private <T extends EntityInterface<?>> void loadViewable(
      final Access access,
      final EntityRepository<T> repository,
      final List<UUID> ids,
      final Map<UUID, EntityInterface<?>> viewable) {
    if (ids.isEmpty()) {
      return;
    }
    final List<T> entities =
        repository.get(access.uriInfo(), ids, fields(repository), Include.NON_DELETED);
    final var tags =
        new BulkFieldHydrator(
            Map.of(Entity.FIELD_TAGS, () -> repository.batchLoadTags(new ArrayList<>(entities))));
    for (final T entity : entities) {
      try {
        authorizer.authorize(
            access.securityContext(),
            new OperationContext(repository.getEntityType(), MetadataOperation.VIEW_BASIC),
            new ResourceContext<>(repository.getEntityType(), entity, repository, tags));
        viewable.put(entity.getId(), entity);
      } catch (final AuthorizationException hidden) {
        LOG.debug(
            "Binding target {} {} is hidden from the reader",
            repository.getEntityType(),
            entity.getId());
      }
    }
  }

  private OntologyHydratedAssetBinding hydrateAsset(
      final Hydration hydration, final Visible visible) {
    return new OntologyHydratedAssetBinding()
        .withAssetType(visible.row().assetType())
        .withAssetId(visible.row().assetId())
        .withAsset(visible.entity().getEntityReference())
        .withServiceType(visible.serviceType())
        .withColumns(
            visible.row().columns().stream()
                .map(column -> hydrateColumn(hydration, visible.entity(), column))
                .toList());
  }

  private OntologyHydratedColumnBinding hydrateColumn(
      final Hydration hydration,
      final EntityInterface<?> asset,
      final OntologyColumnBinding binding) {
    final var property =
        hydration
            .properties()
            .computeIfAbsent(
                binding.getPropertyId(),
                id ->
                    readable(hydration.access(), Entity.ONTOLOGY_PROPERTY, id)
                        .map(OntologyProperty.class::cast));
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
    final T entity =
        repository.get(access.uriInfo(), id, fields(repository), Include.NON_DELETED, false);
    authorize(access, repository, entity, operation);
    return entity;
  }

  private <T extends EntityInterface<?>> void authorize(
      final Access access,
      final EntityRepository<T> repository,
      final T entity,
      final MetadataOperation operation) {
    authorizer.authorize(
        access.securityContext(),
        new OperationContext(repository.getEntityType(), operation),
        new ResourceContext<>(repository.getEntityType(), entity, repository));
  }

  private static Fields fields(final EntityRepository<?> repository) {
    final var fieldNames =
        new HashSet<>(ResourceContext.authorizationFields(repository).getFieldList());
    if (Entity.TABLE.equals(repository.getEntityType())) {
      fieldNames.add(Entity.FIELD_COLUMNS);
    }
    return new Fields(fieldNames);
  }

  private static UUID decodeCursor(final String after) {
    if (after == null || after.isEmpty()) {
      return null;
    }
    if (after.length() > MAX_CURSOR_LENGTH) {
      throw new BadRequestException("Invalid ontology binding cursor");
    }
    try {
      return UUID.fromString(RestUtil.decodeCursor(after));
    } catch (final IllegalArgumentException invalid) {
      throw new BadRequestException("Invalid ontology binding cursor", invalid);
    }
  }

  private static OntologyBindingAssetType assetType(final String value) {
    try {
      return OntologyBindingAssetType.fromValue(value);
    } catch (final IllegalArgumentException invalid) {
      throw new BadRequestException("Unsupported ontology binding asset type", invalid);
    }
  }

  private record Visible(BindingRow row, EntityInterface<?> entity, String serviceType) {}

  private record Hydration(
      Access access,
      OntologyConcept concept,
      Set<String> ancestors,
      Map<UUID, Optional<OntologyProperty>> properties) {}
}
