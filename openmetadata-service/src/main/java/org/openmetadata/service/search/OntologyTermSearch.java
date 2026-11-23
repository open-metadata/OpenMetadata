package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
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
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingRow;
import org.openmetadata.service.jdbi3.OntologyConceptBindingStore;
import org.openmetadata.service.ontology.OntologyBindingRules;
import org.openmetadata.service.ontology.OntologyReleaseReader;
import org.openmetadata.service.search.indexes.OntologyTermIndex;

public final class OntologyTermSearch {
  public static final String ALIAS = "ontologyTerms";
  private static final int PAGE_SIZE = 250;

  private OntologyTermSearch() {}

  public static boolean isTerm(String type) {
    return Entity.ONTOLOGY_CONCEPT.equals(type) || Entity.ONTOLOGY_PROPERTY.equals(type);
  }

  public static OntologyTermIndex activeIndex(EntityReference reference) {
    final var dao = Entity.getCollectionDAO();
    final var kind =
        Entity.ONTOLOGY_CONCEPT.equals(reference.getType())
            ? MemberKind.CONCEPT
            : MemberKind.PROPERTY;
    final var members =
        dao.ontologyReleaseDAO()
            .listActiveMembers(kind.value(), List.of(reference.getId().toString()));
    if (members.isEmpty()) {
      return null;
    }
    final var current = liveTerm(reference);
    if (current == null) {
      return null;
    }
    final var member = members.getFirst();
    final var term = (OntologyEntityInterface) OntologyReleaseReader.definition(member);
    term.setOwners(current.getOwners());
    if (term instanceof OntologyConcept concept && !Boolean.TRUE.equals(concept.getDeprecated())) {
      return new OntologyTermIndex(concept, boundAssets(concept), List.of(), List.of());
    }
    if (term instanceof OntologyProperty property
        && !Boolean.TRUE.equals(property.getDeprecated())) {
      return propertyIndex(property, labels(property, member.getReleaseId()));
    }
    return null;
  }

  private static OntologyEntityInterface liveTerm(EntityReference reference) {
    final var repository = Entity.getEntityRepository(reference.getType());
    try {
      return (OntologyEntityInterface)
          repository.get(
              null,
              reference.getId(),
              repository.getOnlySupportedFields("owners"),
              Include.NON_DELETED,
              false);
    } catch (EntityNotFoundException missing) {
      return null;
    }
  }

  private static List<String> boundAssets(OntologyConcept concept) {
    final var store =
        new OntologyConceptBindingStore(
            Entity.getCollectionDAO(), OntologyConceptBindingStore.registeredAssetTables());
    final var names = new TreeSet<String>();
    UUID after = null;
    List<BindingRow> page;
    do {
      page = store.page(concept.getId(), after, OntologyConceptBindingStore.SCAN_PAGE_SIZE);
      final var properties = activeBindingProperties(page);
      page.forEach(row -> addBoundAsset(names, row, properties));
      after = page.isEmpty() ? null : page.getLast().assetId();
    } while (page.size() == OntologyConceptBindingStore.SCAN_PAGE_SIZE);
    return List.copyOf(names);
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

  private static void addBoundAsset(Set<String> names, BindingRow row, Set<UUID> properties) {
    if (row.assetType() != OntologyBindingAssetType.TABLE) {
      return;
    }
    final Table table =
        Entity.getEntityOrNull(Entity.TABLE, row.assetId(), "", Include.NON_DELETED);
    if (table == null) {
      return;
    }
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

  private static Map<URI, String> labels(OntologyProperty property, UUID releaseId) {
    final var iris =
        Stream.concat(
                listOrEmpty(property.getDomain()).stream(),
                listOrEmpty(property.getRange()).stream())
            .map(URI::toString)
            .distinct()
            .toList();
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
    final var description =
        term.getDescription() == null ? "" : plainText.apply(term.getDescription());
    final var extras =
        switch (term) {
          case OntologyConcept concept -> nullOrEmpty(concept.getSynonyms())
              ? List.<String>of()
              : concept.getSynonyms().stream().sorted().toList();
          case OntologyProperty property -> propertyEmbeddingLabels(property);
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
            : labels(property, members.getFirst().getReleaseId());
    return Stream.concat(
            labelList(property.getDomain(), labels).stream(),
            labelList(property.getRange(), labels).stream())
        .toList();
  }

  public static void forReleaseTerms(UUID releaseId, Consumer<EntityReference> refresh) {
    if (releaseId != null) {
      refreshMembers(releaseId, MemberKind.CONCEPT, Entity.ONTOLOGY_CONCEPT, refresh);
      refreshMembers(releaseId, MemberKind.PROPERTY, Entity.ONTOLOGY_PROPERTY, refresh);
    }
  }

  private static void refreshMembers(
      UUID releaseId, MemberKind kind, String type, Consumer<EntityReference> refresh) {
    final var dao = Entity.getCollectionDAO().ontologyReleaseDAO();
    String after = "";
    List<OntologyReleaseMember> page;
    do {
      page = dao.listMembers(releaseId, kind.value(), after, PAGE_SIZE);
      page.forEach(
          member ->
              refresh.accept(new EntityReference().withId(member.getMemberId()).withType(type)));
      after = page.isEmpty() ? after : page.getLast().getMemberId().toString();
    } while (page.size() == PAGE_SIZE);
  }
}
