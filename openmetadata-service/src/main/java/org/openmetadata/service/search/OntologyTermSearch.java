package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.apache.commons.lang3.function.FailableFunction;
import org.apache.commons.lang3.function.FailableRunnable;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.OntologyEntityInterface;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingPosition;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingRow;
import org.openmetadata.service.jdbi3.OntologyConceptBindingStore;
import org.openmetadata.service.ontology.OntologyBindingRules;
import org.openmetadata.service.ontology.OntologyReleaseReader;
import org.openmetadata.service.search.indexes.OntologyTermIndex;
import org.openmetadata.service.search.security.PrivateSearchFields;
import org.openmetadata.service.search.vector.VectorDocBuilder;
import org.openmetadata.service.util.FreshReadScope;

public final class OntologyTermSearch {
  public static final String ALIAS = "ontologyTerms";

  /** The ontology term types, each with its own index behind {@link #ALIAS}. */
  public static final List<String> TERM_TYPES =
      List.of(Entity.ONTOLOGY_CONCEPT, Entity.ONTOLOGY_PROPERTY);

  static final int PAGE_SIZE = 250;

  private OntologyTermSearch() {}

  public static boolean isTerm(String type) {
    return TERM_TYPES.stream().anyMatch(term -> term.equalsIgnoreCase(type));
  }

  public static OntologyTermIndex activeIndex(EntityReference reference) {
    try (var ignored = FreshReadScope.enter()) {
      return activeIndexes(
              reference.getType(),
              loadWorkingTerms(reference.getType(), List.of(reference.getId())))
          .get(reference.getId());
    }
  }

  static <T, E extends Exception> T withLockedIndexes(
      List<EntityReference> references, FailableFunction<Map<UUID, OntologyTermIndex>, T, E> write)
      throws E {
    final var idsByType =
        references.stream()
            .collect(
                Collectors.groupingBy(
                    EntityReference::getType,
                    TreeMap::new,
                    Collectors.mapping(EntityReference::getId, Collectors.toList())));
    return Entity.getCollectionDAO()
        .inTransaction(
            TransactionIsolationLevel.READ_COMMITTED,
            dao -> {
              // Keep the row locks through the search write. A waiting refresh must read after
              // acquiring them, or it could publish a snapshot the previous writer superseded.
              idsByType.forEach((type, ids) -> lockTerms(dao, type, ids));
              try (var fresh = FreshReadScope.enter()) {
                final Map<UUID, OntologyTermIndex> active = new HashMap<>();
                idsByType.forEach(
                    (type, ids) -> active.putAll(activeIndexes(type, loadWorkingTerms(type, ids))));
                return write.apply(active);
              }
            });
  }

  private static void lockTerms(CollectionDAO dao, String type, List<UUID> ids) {
    final var terms =
        Entity.ONTOLOGY_CONCEPT.equalsIgnoreCase(type)
            ? dao.ontologyConceptDAO()
            : dao.ontologyPropertyDAO();
    terms.lockIdsForUpdate(terms.getTableName(), ids.stream().map(UUID::toString).toList());
  }

  public static <E extends Exception> void writeCurrentEmbedding(
      EntityReference ref, String fingerprint, FailableRunnable<E> write) throws E {
    withLockedIndexes(
        List.of(ref),
        active -> {
          final var index = active.get(ref.getId());
          if (index != null && fingerprint.equals(embeddingFingerprint(index))) {
            write.run();
          }
          return null;
        });
  }

  static String embeddingFingerprint(OntologyTermIndex index) {
    return VectorDocBuilder.computeFingerprintForEntity(index.term(), index.embeddingBody());
  }

  static List<? extends EntityInterface<?>> loadWorkingTerms(String type, List<UUID> ids) {
    final var repository = Entity.getEntityRepository(type);
    return repository.get(
        null, ids, repository.getOnlySupportedFields("owners"), Include.NON_DELETED);
  }

  public static Map<UUID, OntologyTermIndex> activeIndexes(
      String type, List<? extends EntityInterface<?>> working) {
    final var live =
        working.stream()
            .filter(term -> !Boolean.TRUE.equals(term.getDeleted()))
            .collect(Collectors.toMap(EntityInterface::getId, Function.identity()));
    if (live.isEmpty()) {
      return Map.of();
    }
    final var kind =
        Entity.ONTOLOGY_CONCEPT.equals(type) ? MemberKind.CONCEPT : MemberKind.PROPERTY;
    final var members =
        Entity.getCollectionDAO()
            .ontologyReleaseDAO()
            .listActiveMembers(kind.value(), live.keySet().stream().map(UUID::toString).toList());
    final var definitions =
        members.stream()
            .collect(
                Collectors.toMap(
                    OntologyReleaseMember::getMemberId, OntologyReleaseReader::definition));
    final var assets =
        kind == MemberKind.CONCEPT
            ? boundTableIds(definitions.keySet())
            : Map.<UUID, List<String>>of();
    final var labels =
        kind == MemberKind.PROPERTY
            ? propertyLabels(members, definitions)
            : Map.<UUID, Map<URI, String>>of();
    final Map<UUID, OntologyTermIndex> indexes = new HashMap<>();
    for (var member : members) {
      final var term = (OntologyEntityInterface) definitions.get(member.getMemberId());
      term.setOwners(live.get(term.getId()).getOwners());
      if (term instanceof OntologyConcept concept
          && !Boolean.TRUE.equals(concept.getDeprecated())) {
        indexes.put(
            term.getId(),
            new OntologyTermIndex(
                concept, assets.getOrDefault(term.getId(), List.of()), List.of(), List.of()));
      }
      if (term instanceof OntologyProperty property
          && !Boolean.TRUE.equals(property.getDeprecated())) {
        indexes.put(
            term.getId(),
            propertyIndex(property, labels.getOrDefault(member.getReleaseId(), Map.of())));
      }
    }
    return indexes;
  }

  private static void forEachTableBindingPage(Set<UUID> ids, Consumer<List<BindingRow>> action) {
    if (ids.isEmpty()) {
      return;
    }
    final var store = bindingStore();
    BindingPosition after = null;
    List<BindingRow> rows;
    do {
      rows = store.page(ids, after, PAGE_SIZE);
      action.accept(
          rows.stream().filter(row -> row.assetType() == OntologyBindingAssetType.TABLE).toList());
      if (!rows.isEmpty()) {
        final var last = rows.getLast();
        after = new BindingPosition(last.conceptId(), last.assetId());
      }
    } while (rows.size() == PAGE_SIZE);
  }

  private static Map<UUID, List<String>> boundTableIds(Set<UUID> ids) {
    final Map<UUID, Set<String>> assets = new HashMap<>();
    forEachTableBindingPage(
        ids,
        rows -> {
          final var tableIds = rows.stream().map(BindingRow::assetId).distinct().toList();
          final var existing =
              Entity.getCollectionDAO()
                  .tableDAO()
                  .findReferencesByIds(tableIds, Include.NON_DELETED)
                  .stream()
                  .map(EntityReference::getId)
                  .collect(Collectors.toSet());
          rows.stream()
              .filter(row -> existing.contains(row.assetId()))
              .forEach(
                  row ->
                      assets
                          .computeIfAbsent(row.conceptId(), ignored -> new TreeSet<>())
                          .add(row.assetId().toString()));
        });
    return assets.entrySet().stream()
        .collect(Collectors.toMap(Map.Entry::getKey, entry -> List.copyOf(entry.getValue())));
  }

  public static Response withAdminBindingNames(Response response) throws IOException {
    if (response.getStatus() != 200 || !(response.getEntity() instanceof String body)) {
      return response;
    }
    final var result = JsonUtils.getObjectMapper().readTree(body);
    final Map<UUID, ObjectNode> concepts = new HashMap<>();
    for (JsonNode hit : result.path("hits").path("hits")) {
      if (hit.path("_source") instanceof ObjectNode source
          && source.has("boundAssetIds")
          && Entity.ONTOLOGY_CONCEPT.equals(source.path("entityType").asText())) {
        concepts.put(UUID.fromString(hit.path("_id").asText()), source);
      }
    }
    if (concepts.isEmpty()) {
      return response;
    }
    final var names = boundAssetNames(concepts.keySet());
    concepts.forEach(
        (id, source) -> {
          final var assets = source.putArray(PrivateSearchFields.BOUND_ASSETS);
          names.getOrDefault(id, Set.of()).forEach(assets::add);
        });
    return Response.fromResponse(response).entity(JsonUtils.pojoToJson(result)).build();
  }

  private static Map<UUID, Set<String>> boundAssetNames(Set<UUID> conceptIds) {
    final Map<UUID, Set<String>> names = new HashMap<>();
    forEachTableBindingPage(
        conceptIds,
        rows -> {
          final var ids = rows.stream().map(BindingRow::assetId).distinct().toList();
          final var tables =
              Entity.getCollectionDAO()
                  .tableDAO()
                  .findEntitiesByIds(ids, Include.NON_DELETED)
                  .stream()
                  .collect(Collectors.toMap(Table::getId, Function.identity()));
          final var properties = activeBindingProperties(rows);
          rows.forEach(
              row -> {
                final var table = tables.get(row.assetId());
                if (table != null) {
                  addBoundAsset(
                      names.computeIfAbsent(row.conceptId(), ignored -> new TreeSet<>()),
                      row,
                      table,
                      properties);
                }
              });
        });
    return names;
  }

  private static Set<UUID> activeBindingProperties(List<BindingRow> rows) {
    final var ids =
        rows.stream()
            .flatMap(row -> row.columns().stream())
            .map(binding -> binding.getPropertyId().toString())
            .distinct()
            .toList();
    return ids.isEmpty()
        ? Set.of()
        : Entity.getCollectionDAO()
            .ontologyReleaseDAO()
            .listActiveMembers(MemberKind.PROPERTY.value(), ids)
            .stream()
            .map(OntologyReleaseMember::getMemberId)
            .collect(Collectors.toUnmodifiableSet());
  }

  private static void addBoundAsset(
      Set<String> names, BindingRow row, Table table, Set<UUID> properties) {
    names.add(table.getFullyQualifiedName());
    row.columns().stream()
        .filter(binding -> properties.contains(binding.getPropertyId()))
        .map(binding -> OntologyBindingRules.resolveColumn(table, binding.getColumnPath()))
        .filter(Objects::nonNull)
        .map(column -> column.getFullyQualifiedName())
        .filter(Objects::nonNull)
        .forEach(names::add);
  }

  private static OntologyTermIndex propertyIndex(
      OntologyProperty property, Map<URI, String> labels) {
    return new OntologyTermIndex(
        property,
        List.of(),
        labelList(property.getDomain(), labels),
        labelList(property.getRange(), labels));
  }

  private static List<String> labelList(List<URI> iris, Map<URI, String> labels) {
    return listOrEmpty(iris).stream()
        .map(iri -> labels.getOrDefault(iri, iriLabel(iri)))
        .distinct()
        .sorted()
        .toList();
  }

  private static Map<UUID, Map<URI, String>> propertyLabels(
      List<OntologyReleaseMember> members, Map<UUID, ? extends EntityInterface<?>> definitions) {
    final Map<UUID, Set<String>> irisByRelease = new HashMap<>();
    for (var member : members) {
      final var property = (OntologyProperty) definitions.get(member.getMemberId());
      irisByRelease
          .computeIfAbsent(member.getReleaseId(), ignored -> new TreeSet<>())
          .addAll(propertyIris(property).toList());
    }
    return irisByRelease.entrySet().stream()
        .collect(
            Collectors.toMap(
                Map.Entry::getKey, entry -> labels(entry.getKey(), List.copyOf(entry.getValue()))));
  }

  private static Stream<String> propertyIris(OntologyProperty property) {
    return Stream.concat(
            listOrEmpty(property.getDomain()).stream(), listOrEmpty(property.getRange()).stream())
        .map(URI::toString);
  }

  private static Map<URI, String> labels(UUID releaseId, List<String> iris) {
    if (iris.isEmpty()) {
      return Map.of();
    }
    return Entity.getCollectionDAO()
        .ontologyReleaseDAO()
        .listConceptsByIri(releaseId, iris)
        .stream()
        .map(OntologyReleaseReader::definition)
        .map(OntologyConcept.class::cast)
        .collect(Collectors.toMap(OntologyConcept::getIri, OntologyTermSearch::label));
  }

  private static String label(EntityInterface<?> term) {
    return nullOrEmpty(term.getDisplayName()) || term.getDisplayName().isBlank()
        ? term.getName()
        : term.getDisplayName();
  }

  private static String iriLabel(URI iri) {
    final var text = iri.toString();
    final int separator =
        Math.max(text.lastIndexOf('#'), Math.max(text.lastIndexOf('/'), text.lastIndexOf(':')));
    return separator < text.length() - 1 ? text.substring(separator + 1) : text;
  }

  public static String embeddingBody(EntityInterface<?> term, Function<String, String> plainText) {
    return embeddingBody(
        term,
        plainText,
        term instanceof OntologyProperty property ? propertyEmbeddingLabels(property) : null);
  }

  public static String embeddingBody(
      EntityInterface<?> term, Function<String, String> plainText, List<String> propertyLabels) {
    final var description =
        term.getDescription() == null ? "" : plainText.apply(term.getDescription());
    final var extras =
        switch (term) {
          case OntologyConcept concept -> nullOrEmpty(concept.getSynonyms())
              ? List.<String>of()
              : concept.getSynonyms().stream().sorted().toList();
          case OntologyProperty property -> propertyLabels;
          default -> List.<String>of();
        };
    return String.join(". ", label(term), description, String.join(", ", extras));
  }

  private static List<String> propertyEmbeddingLabels(OntologyProperty property) {
    final var members =
        Entity.getCollectionDAO()
            .ontologyReleaseDAO()
            .listActiveMembers(MemberKind.PROPERTY.value(), List.of(property.getId().toString()));
    final var labels =
        members.isEmpty()
            ? Map.<URI, String>of()
            : labels(members.getFirst().getReleaseId(), propertyIris(property).distinct().toList());
    return Stream.concat(
            labelList(property.getDomain(), labels).stream(),
            labelList(property.getRange(), labels).stream())
        .toList();
  }

  public static List<EntityReference> releaseTerms(UUID... releaseIds) {
    final var ids =
        Stream.of(releaseIds).filter(Objects::nonNull).map(UUID::toString).distinct().toList();
    if (ids.isEmpty()) {
      return List.of();
    }
    return Entity.getCollectionDAO().ontologyReleaseDAO().listAllMemberVersions(ids).stream()
        .filter(
            member ->
                MemberKind.CONCEPT.value().equals(member.memberKind())
                    || MemberKind.PROPERTY.value().equals(member.memberKind()))
        .map(
            member ->
                new EntityReference()
                    .withId(UUID.fromString(member.memberId()))
                    .withType(
                        MemberKind.CONCEPT.value().equals(member.memberKind())
                            ? Entity.ONTOLOGY_CONCEPT
                            : Entity.ONTOLOGY_PROPERTY))
        .distinct()
        .toList();
  }

  public static void bindingsChanged(EntityReference table) {
    final var search = Entity.getSearchRepository();
    if (search == null) {
      return;
    }
    if (Entity.ONTOLOGY_CONCEPT.equals(table.getType())) {
      search.refreshOntologyTerm(table);
      return;
    }
    final var store = bindingStore();
    UUID after = null;
    List<BindingRow> rows;
    do {
      rows = store.forAssetAfter(table.getId(), after, PAGE_SIZE);
      search.refreshOntologyTerms(
          rows.stream()
              .map(
                  row ->
                      new EntityReference()
                          .withId(row.conceptId())
                          .withType(Entity.ONTOLOGY_CONCEPT))
              .toList());
      after = rows.isEmpty() ? after : rows.getLast().conceptId();
    } while (rows.size() == PAGE_SIZE);
  }

  private static OntologyConceptBindingStore bindingStore() {
    return new OntologyConceptBindingStore(
        Entity.getCollectionDAO(), OntologyConceptBindingStore.registeredAssetTables());
  }
}
