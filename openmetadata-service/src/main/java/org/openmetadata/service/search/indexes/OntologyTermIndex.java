package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.OntologyEntityInterface;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.OntologyTermSearch;
import org.openmetadata.service.search.vector.VectorDocBuilder;

public record OntologyTermIndex(
    OntologyEntityInterface term,
    List<String> boundAssetIds,
    List<String> domainLabels,
    List<String> rangeLabels)
    implements SearchIndex {
  private static final Set<String> FIELDS =
      Set.of(
          "id",
          "name",
          "displayName",
          "fullyQualifiedName",
          "description",
          "entityType",
          "ontology",
          "iri",
          "conceptType",
          "synonyms",
          "domain",
          "range",
          "owners",
          "ownerDisplayName",
          "ownerName",
          "deleted",
          "updatedAt");

  public OntologyTermIndex(OntologyEntityInterface term) {
    this(term, List.of(), List.of(), List.of());
  }

  public String embeddingBody() {
    return OntologyTermSearch.embeddingBody(
        term,
        VectorDocBuilder::removeHtml,
        term instanceof OntologyProperty
            ? java.util.stream.Stream.concat(domainLabels.stream(), rangeLabels.stream()).toList()
            : null);
  }

  @Override
  public Object getEntity() {
    return term;
  }

  @Override
  public String getEntityTypeName() {
    return term instanceof OntologyProperty ? Entity.ONTOLOGY_PROPERTY : Entity.ONTOLOGY_CONCEPT;
  }

  @Override
  public Map<String, Object> buildSearchIndexDoc(DocBuildContext context) {
    if (Boolean.TRUE.equals(term.getDeleted())) {
      throw new IllegalArgumentException("Cannot index a deleted ontology term");
    }
    return SearchIndex.super.buildSearchIndexDoc(context);
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> document) {
    document.keySet().retainAll(FIELDS);
    document.put(
        "kind",
        term instanceof OntologyProperty property
            ? property.getKind().value().toLowerCase(Locale.ROOT)
            : "class");
    document.put(
        "synonyms",
        term instanceof OntologyConcept concept && !nullOrEmpty(concept.getSynonyms())
            ? concept.getSynonyms().stream().sorted().toList()
            : List.of());
    document.put("boundAssetIds", boundAssetIds);
    document.put("domainLabels", domainLabels);
    document.put("rangeLabels", rangeLabels);
    document.put("deleted", false);
    return document;
  }
}
