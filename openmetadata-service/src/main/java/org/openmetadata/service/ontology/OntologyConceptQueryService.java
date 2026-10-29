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

package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.OntologyConceptQuery;
import org.openmetadata.schema.api.data.OntologyConceptQueryHop;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingRow;
import org.openmetadata.service.jdbi3.OntologyConceptBindingStore;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.ontology.OntologyConceptBindingService.Access;
import org.openmetadata.service.ontology.OntologyConceptSqlGenerator.BoundConcept;
import org.openmetadata.service.ontology.OntologyConceptSqlGenerator.BoundTable;
import org.openmetadata.service.ontology.OntologyConceptSqlGenerator.Generated;
import org.openmetadata.service.ontology.OntologyConceptSqlGenerator.Hop;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.BulkFieldHydrator;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FreshReadScope;

/**
 * Reads what SQL generation needs in a fixed number of batched statements, whatever the hop count:
 * the concepts, the hop properties, each concept's first bound tables, those tables, and the
 * properties their columns bind. Tables the reader may not view are treated as unbound, so their
 * columns never appear in the SQL. The call writes nothing.
 */
@Slf4j
public final class OntologyConceptQueryService {
  /** Bound tables considered per concept (ADR:2026-10-21-ontology-live-data-execution-is-a-collate-extension). */
  public static final int TABLES_PER_CONCEPT = 10;

  private final OntologyConceptBindingStore store;
  private final Authorizer authorizer;
  private final Function<String, EntityRepository<?>> repositories;

  public OntologyConceptQueryService(
      final OntologyConceptBindingStore store,
      final Authorizer authorizer,
      final Function<String, EntityRepository<?>> repositories) {
    this.store = store;
    this.authorizer = authorizer;
    this.repositories = repositories;
  }

  public OntologyConceptQuery generate(
      final Access access, final UUID conceptId, final OntologyConceptQuery request) {
    final List<OntologyConceptQueryHop> hops =
        request == null ? List.of() : listOrEmpty(request.getHops());
    try (final var ignored = FreshReadScope.enter()) {
      final Map<UUID, OntologyConcept> concepts = concepts(access, conceptId, hops);
      store.requireLiveOntology(concepts.get(conceptId));
      final List<OntologyConceptQueryHop> labeled =
          labeled(hops, relations(access, concepts.get(conceptId), hops));
      final Map<UUID, BoundConcept> bound = bind(access, concepts.values());
      final List<Hop> steps =
          labeled.stream()
              .map(hop -> new Hop(hop.getProperty(), hop.getLabel(), bound.get(hop.getTarget())))
              .toList();
      return response(OntologyConceptSqlGenerator.generate(bound.get(conceptId), steps), labeled);
    }
  }

  private static List<OntologyConceptQueryHop> labeled(
      final List<OntologyConceptQueryHop> hops, final Map<UUID, OntologyProperty> relations) {
    return hops.stream()
        .map(
            hop ->
                new OntologyConceptQueryHop()
                    .withProperty(hop.getProperty())
                    .withTarget(hop.getTarget())
                    .withLabel(label(relations.get(hop.getProperty()))))
        .toList();
  }

  private Map<UUID, OntologyConcept> concepts(
      final Access access, final UUID conceptId, final List<OntologyConceptQueryHop> hops) {
    final Set<UUID> ids = new LinkedHashSet<>();
    ids.add(conceptId);
    hops.forEach(hop -> ids.add(hop.getTarget()));
    final Map<UUID, OntologyConcept> concepts =
        authorizedAll(access, Entity.ONTOLOGY_CONCEPT, ids, OntologyConcept.class);
    final UUID ontologyId = concepts.get(conceptId).getOntology().getId();
    if (concepts.values().stream()
        .anyMatch(concept -> !ontologyId.equals(concept.getOntology().getId()))) {
      throw new BadRequestException(
          "Every search-around hop must reach a concept of the same ontology");
    }
    return concepts;
  }

  private Map<UUID, OntologyProperty> relations(
      final Access access, final OntologyConcept root, final List<OntologyConceptQueryHop> hops) {
    final Set<UUID> ids =
        hops.stream()
            .map(OntologyConceptQueryHop::getProperty)
            .collect(Collectors.toCollection(LinkedHashSet::new));
    final Map<UUID, OntologyProperty> properties =
        authorizedAll(access, Entity.ONTOLOGY_PROPERTY, ids, OntologyProperty.class);
    for (final OntologyProperty property : properties.values()) {
      if (property.getKind() != OntologyPropertyKind.OBJECT
          || !root.getOntology().getId().equals(property.getOntology().getId())) {
        throw new BadRequestException(
            String.format(
                "Search-around property %s is not an object property of this ontology",
                label(property)));
      }
    }
    return properties;
  }

  private Map<UUID, BoundConcept> bind(
      final Access access, final Collection<OntologyConcept> concepts) {
    final List<BindingRow> rows =
        store.firstTables(
            concepts.stream().map(OntologyConcept::getId).toList(), TABLES_PER_CONCEPT);
    final Map<UUID, Table> tables = viewableTables(access, rows);
    final List<BindingRow> visible =
        rows.stream().filter(row -> tables.containsKey(row.assetId())).toList();
    final Map<UUID, OntologyProperty> properties = boundProperties(access, visible);
    final Map<UUID, BoundConcept> bound = new HashMap<>();
    for (final OntologyConcept concept : concepts) {
      final List<BoundTable> conceptTables =
          visible.stream()
              .filter(row -> row.conceptId().equals(concept.getId()))
              .map(row -> boundTable(tables.get(row.assetId()), row, properties))
              .toList();
      bound.put(concept.getId(), new BoundConcept(label(concept), conceptTables));
    }
    return bound;
  }

  private Map<UUID, Table> viewableTables(final Access access, final List<BindingRow> rows) {
    @SuppressWarnings("unchecked")
    final EntityRepository<Table> repository =
        (EntityRepository<Table>) repositories.apply(Entity.TABLE);
    final List<UUID> ids = rows.stream().map(BindingRow::assetId).distinct().toList();
    final List<Table> loaded =
        ids.isEmpty()
            ? List.of()
            : repository.get(access.uriInfo(), ids, tableFields(repository), Include.NON_DELETED);
    final var tags =
        new BulkFieldHydrator(
            Map.of(Entity.FIELD_TAGS, () -> repository.batchLoadTags(new ArrayList<>(loaded))));
    return loaded.stream()
        .filter(table -> canView(access, repository, table, tags))
        .collect(Collectors.toMap(Table::getId, Function.identity()));
  }

  private boolean canView(
      final Access access,
      final EntityRepository<Table> repository,
      final Table table,
      final BulkFieldHydrator tags) {
    try {
      authorizer.authorize(
          access.securityContext(),
          new OperationContext(Entity.TABLE, MetadataOperation.VIEW_BASIC),
          new ResourceContext<>(Entity.TABLE, table, repository, tags));
      return true;
    } catch (final AuthorizationException hidden) {
      LOG.debug("Bound table {} is hidden from the reader", table.getId());
      return false;
    }
  }

  private Map<UUID, OntologyProperty> boundProperties(
      final Access access, final List<BindingRow> rows) {
    final List<UUID> ids =
        rows.stream()
            .flatMap(row -> row.columns().stream())
            .map(OntologyColumnBinding::getPropertyId)
            .distinct()
            .toList();
    final EntityRepository<?> repository = repositories.apply(Entity.ONTOLOGY_PROPERTY);
    return ids.isEmpty()
        ? Map.of()
        : repository.get(access.uriInfo(), ids, new Fields(Set.of()), Include.NON_DELETED).stream()
            .map(OntologyProperty.class::cast)
            .collect(Collectors.toMap(OntologyProperty::getId, Function.identity()));
  }

  private static BoundTable boundTable(
      final Table table, final BindingRow row, final Map<UUID, OntologyProperty> properties) {
    final List<OntologyColumnBinding> resolved =
        row.columns().stream()
            .filter(binding -> properties.containsKey(binding.getPropertyId()))
            .filter(
                binding ->
                    OntologyBindingRules.resolveColumn(table, binding.getColumnPath()) != null)
            .toList();
    final Map<UUID, List<String>> objectColumns =
        resolved.stream()
            .filter(binding -> kindOf(properties, binding) == OntologyPropertyKind.OBJECT)
            .collect(
                Collectors.toMap(
                    OntologyColumnBinding::getPropertyId,
                    OntologyColumnBinding::getColumnPath,
                    (first, ignored) -> first,
                    LinkedHashMap::new));
    final List<String> identifier =
        resolved.stream()
            .filter(binding -> isIdentifier(properties.get(binding.getPropertyId())))
            .findFirst()
            .map(OntologyColumnBinding::getColumnPath)
            .orElse(List.of());
    return new BoundTable(
        table.getFullyQualifiedName(),
        table.getServiceType() == null ? null : table.getServiceType().value(),
        resolved.stream().map(OntologyColumnBinding::getColumnPath).toList(),
        objectColumns,
        identifier,
        listOrEmpty(table.getTableConstraints()));
  }

  private static OntologyPropertyKind kindOf(
      final Map<UUID, OntologyProperty> properties, final OntologyColumnBinding binding) {
    return properties.get(binding.getPropertyId()).getKind();
  }

  private static boolean isIdentifier(final OntologyProperty property) {
    return property.getKind() == OntologyPropertyKind.DATA
        && Boolean.TRUE.equals(property.getIsIdentifier());
  }

  private <T extends EntityInterface<?>> Map<UUID, T> authorizedAll(
      final Access access, final String type, final Set<UUID> ids, final Class<T> kind) {
    final EntityRepository<?> repository = repositories.apply(type);
    final Map<UUID, T> found = new LinkedHashMap<>();
    if (!ids.isEmpty()) {
      repository
          .get(
              access.uriInfo(),
              List.copyOf(ids),
              ResourceContext.authorizationFields(repository),
              Include.NON_DELETED)
          .forEach(entity -> found.put(entity.getId(), kind.cast(entity)));
    }
    for (final UUID id : ids) {
      final T entity = found.get(id);
      if (entity == null) {
        throw EntityNotFoundException.byId(id.toString());
      }
      authorize(access, repository, entity);
    }
    return found;
  }

  @SuppressWarnings({"unchecked", "rawtypes"})
  private void authorize(
      final Access access, final EntityRepository<?> repository, final EntityInterface<?> entity) {
    authorizer.authorize(
        access.securityContext(),
        new OperationContext(repository.getEntityType(), MetadataOperation.VIEW_BASIC),
        new ResourceContext(repository.getEntityType(), entity, repository));
  }

  private static Fields tableFields(final EntityRepository<Table> repository) {
    final var names =
        new LinkedHashSet<>(ResourceContext.authorizationFields(repository).getFieldList());
    names.add(Entity.FIELD_COLUMNS);
    names.add(TableRepository.TABLE_CONSTRAINTS_FIELD);
    return new Fields(names);
  }

  private static String label(final OntologyConcept concept) {
    return concept.getDisplayName() == null || concept.getDisplayName().isBlank()
        ? concept.getName()
        : concept.getDisplayName();
  }

  /** Reads the relation the way the Studio labels it: "placedBy" becomes "placed by". */
  private static String label(final OntologyProperty property) {
    final String displayName = property.getDisplayName();
    final String name =
        displayName == null || displayName.isBlank() ? property.getName() : displayName;
    return name.replaceAll("([a-z0-9])([A-Z])", "$1 $2")
        .replaceAll("[_-]+", " ")
        .strip()
        .toLowerCase(Locale.ROOT);
  }

  private static OntologyConceptQuery response(
      final Generated generated, final List<OntologyConceptQueryHop> hops) {
    return new OntologyConceptQuery()
        .withHops(hops)
        .withSql(generated.sql())
        .withDialect(generated.dialect())
        .withService(generated.service())
        .withServiceType(generated.serviceType())
        .withTables(generated.tables());
  }
}
