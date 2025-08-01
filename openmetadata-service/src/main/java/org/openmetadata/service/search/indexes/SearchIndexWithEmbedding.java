package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.semantic.EmbeddingService;

/**
 * Interface for search indices that support semantic search with embeddings
 * and RDF context enrichment.
 */
public interface SearchIndexWithEmbedding extends SearchIndex {

  // Default embedding field name
  String EMBEDDING_FIELD = "embedding";
  String RDF_CONTEXT_FIELD = "rdfContext";


  default void enrichWithSemanticData(Map<String, Object> doc, EntityInterface entity) {
    try {
      EmbeddingService embeddingService = getEmbeddingService();
      if (embeddingService != null) {
        float[] embedding = generateEntityEmbedding(entity, embeddingService);
        doc.put(EMBEDDING_FIELD, embedding);
      }

      RdfRepository rdfRepository = RdfRepository.getInstance();
      if (rdfRepository != null && rdfRepository.isEnabled()) {
        Map<String, Object> rdfContext = extractRdfContext(entity, rdfRepository);
        doc.put(RDF_CONTEXT_FIELD, rdfContext);
      }
    } catch (Exception e) {
      // Log but don't fail indexing if semantic enrichment fails
      // This ensures backward compatibility
    }
  }


  default float[] generateEntityEmbedding(
      EntityInterface entity, EmbeddingService embeddingService) {
    StringBuilder text = new StringBuilder();
    text.append(entity.getName()).append(" ");
    if (entity.getDisplayName() != null) {
      text.append(entity.getDisplayName()).append(" ");
    }
    if (entity.getDescription() != null) {
      text.append(entity.getDescription()).append(" ");
    }
    if (entity.getTags() != null) {
      entity.getTags().forEach(tag -> text.append(tag.getTagFQN()).append(" "));
    }
    text.append(getAdditionalTextForEmbedding(entity));
    return embeddingService.generateEmbedding(text.toString());
  }

  default Map<String, Object> extractRdfContext(
      EntityInterface entity, RdfRepository rdfRepository) {
    Map<String, Object> context = new java.util.HashMap<>();

    try {
      String entityUri =
          String.format(
              "https://open-metadata.org/entity/%s/%s",
              entity.getEntityReference().getType().toLowerCase(), entity.getId());

      String sparql =
          String.format(
              """
          PREFIX om: <https://open-metadata.org/ontology/>
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
          PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
          SELECT DISTINCT ?type ?property ?value
          WHERE {
            <%s> a ?type .
            OPTIONAL { <%s> ?property ?value .
                      FILTER(?property != rdf:type && isLiteral(?value)) }
          }
          LIMIT 20
          """,
              entityUri, entityUri);

      List<Map<String, String>> results = rdfRepository.executeSparqlQueryAsJson(sparql);

      List<String> semanticTypes =
          results.stream()
              .map(r -> r.get("type"))
              .filter(java.util.Objects::nonNull)
              .distinct()
              .toList();
      context.put("semanticTypes", semanticTypes);

      Map<String, String> properties = new java.util.HashMap<>();
      results.forEach(
          r -> {
            String prop = r.get("property");
            String val = r.get("value");
            if (prop != null && val != null) {
              properties.put(prop.substring(prop.lastIndexOf("#") + 1), val);
            }
          });
      context.put("rdfProperties", properties);

      String countQuery =
          String.format(
              """
          PREFIX om: <https://open-metadata.org/ontology/>
          SELECT (COUNT(DISTINCT ?upstream) as ?upstreamCount)
                 (COUNT(DISTINCT ?downstream) as ?downstreamCount)
                 (COUNT(DISTINCT ?related) as ?relatedCount)
          WHERE {
            OPTIONAL { <%s> om:upstream ?upstream }
            OPTIONAL { <%s> om:downstream ?downstream }
            OPTIONAL { <%s> om:relatedTo ?related }
          }
          """,
              entityUri, entityUri, entityUri);

      List<Map<String, String>> counts = rdfRepository.executeSparqlQueryAsJson(countQuery);
      if (!counts.isEmpty()) {
        context.put(
            "upstreamCount", Integer.parseInt(counts.getFirst().getOrDefault("upstreamCount", "0")));
        context.put(
            "downstreamCount",
            Integer.parseInt(counts.getFirst().getOrDefault("downstreamCount", "0")));
        context.put(
            "relatedCount", Integer.parseInt(counts.getFirst().getOrDefault("relatedCount", "0")));
      }

    } catch (Exception e) {
      // Return partial context on error
    }

    return context;
  }


  default String getAdditionalTextForEmbedding(EntityInterface entity) {
    return "";
  }

  default EmbeddingService getEmbeddingService() {
    // Use singleton instance
    return EmbeddingService.getInstance();
  }
}
