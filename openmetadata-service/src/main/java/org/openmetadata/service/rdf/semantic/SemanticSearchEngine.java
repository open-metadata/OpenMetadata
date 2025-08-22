package org.openmetadata.service.rdf.semantic;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.search.SearchRepository;

/**
 * Semantic Search Engine that combines RDF knowledge with vector embeddings
 * for intelligent entity discovery and recommendation.
 */
@Slf4j
public class SemanticSearchEngine {

  private final RdfRepository rdfRepository;
  private final SearchRepository searchRepository;
  private final EmbeddingService embeddingService;
  private final Map<String, float[]> embeddingCache;

  @Getter
  public static class SearchResult {
    private final EntityReference entity;
    private final double score;
    private final String explanation;
    private final Map<String, Object> metadata;

    public SearchResult(EntityReference entity, double score, String explanation) {
      this.entity = entity;
      this.score = score;
      this.explanation = explanation;
      this.metadata = new HashMap<>();
    }

    public SearchResult withMetadata(String key, Object value) {
      this.metadata.put(key, value);
      return this;
    }
  }

  public SemanticSearchEngine(RdfRepository rdfRepository, SearchRepository searchRepository) {
    this.rdfRepository = rdfRepository;
    this.searchRepository = searchRepository;
    this.embeddingService = EmbeddingService.getInstance();
    this.embeddingCache = new ConcurrentHashMap<>();
  }

  /**
   * Perform semantic search combining text similarity, graph relationships, and inference
   */
  public List<SearchResult> semanticSearch(String query, String entityType, int limit) {
    try {
      // Step 1: Execute OpenSearch semantic query
      List<SearchResult> openSearchResults =
          executeOpenSearchSemanticQuery(query, entityType, limit * 2);

      // Step 2: Enhance with RDF graph context and inference
      List<SearchResult> enhancedResults = enhanceWithGraphContext(openSearchResults, query);

      // Step 3: Apply SPARQL-based semantic inference for additional results
      List<SearchResult> inferredResults = applySemanticInference(enhancedResults, query);

      // Step 4: Re-rank combining all signals
      return reRankResults(inferredResults, limit);
    } catch (Exception e) {
      LOG.error("Semantic search failed", e);
      return Collections.emptyList();
    }
  }

  private List<SearchResult> executeOpenSearchSemanticQuery(
      String query, String entityType, int limit) {
    // Since we don't have SubjectContext here, we'll use the direct entity search approach
    // The main search API handles OpenSearch semantic search via SearchResource
    // This method is specifically for the RDF semantic search endpoints which have different
    // requirements

    // Use embedding-based search with RDF enhancement for now
    float[] queryEmbedding = embeddingService.generateEmbedding(query);
    List<SearchResult> results = findSimilarByEmbedding(queryEmbedding, entityType, limit);

    // The results are already enhanced with RDF context in the pipeline
    return results;
  }

  public List<SearchResult> findSimilarEntities(String entityId, String entityType, int limit) {
    try {
      EntityInterface entity = Entity.getEntity(entityType, UUID.fromString(entityId), "", null);
      float[] entityEmbedding = getOrGenerateEmbedding(entity);
      List<SearchResult> similar = findSimilarByEmbedding(entityEmbedding, entityType, limit * 2);
      similar =
          similar.stream()
              .filter(r -> !r.getEntity().getId().toString().equals(entityId))
              .collect(Collectors.toList());
      return enhanceWithRelationships(entity, similar, limit);
    } catch (Exception e) {
      LOG.error("Similar entity search failed", e);
      return Collections.emptyList();
    }
  }

  public List<SearchResult> getRecommendations(String userId, String entityType, int limit) {
    try {
      // Query user's interaction patterns from RDF
      String sparql =
          """
        PREFIX om: <https://open-metadata.org/ontology/>
        SELECT ?entity ?type ?interaction ?timestamp
        WHERE {
          ?user om:id "%s" .
          ?user om:interactedWith ?entity .
          ?entity a ?type .
          ?entity om:interactionType ?interaction .
          ?entity om:interactionTime ?timestamp .
        }
        ORDER BY DESC(?timestamp)
        LIMIT 100
        """
              .formatted(userId);

      List<Map<String, String>> interactions = rdfRepository.executeSparqlQueryAsJson(sparql);
      UserProfile profile = buildUserProfile(interactions);
      return generateRecommendations(profile, entityType, limit);
    } catch (Exception e) {
      LOG.error("Recommendation generation failed", e);
      return Collections.emptyList();
    }
  }

  private List<SearchResult> findSimilarByEmbedding(
      float[] embedding, String entityType, int limit) {
    // This would integrate with a vector database like Pinecone, Weaviate, or Milvus
    // For now, we'll use a simple in-memory similarity search

    List<SearchResult> results = new ArrayList<>();
    List<String> entityIds = getEntitiesOfType(entityType);

    for (String entityId : entityIds) {
      try {
        EntityInterface entity = Entity.getEntity(entityType, UUID.fromString(entityId), "", null);
        float[] entityEmbedding = getOrGenerateEmbedding(entity);

        double similarity = cosineSimilarity(embedding, entityEmbedding);

        if (similarity > 0.7) { // Threshold for relevance
          SearchResult result =
              new SearchResult(entity.getEntityReference(), similarity, "High semantic similarity");
          results.add(result);
        }
      } catch (Exception e) {
        LOG.debug("Error processing entity {}: {}", entityId, e.getMessage());
      }
    }

    // Sort by score and limit
    return results.stream()
        .sorted((a, b) -> Double.compare(b.getScore(), a.getScore()))
        .limit(limit)
        .collect(Collectors.toList());
  }

  private List<SearchResult> enhanceWithGraphContext(List<SearchResult> results, String query) {
    for (SearchResult result : results) {
      try {
        // Query graph patterns around the entity
        String sparql =
            """
          PREFIX om: <https://open-metadata.org/ontology/>
          SELECT ?predicate ?object ?objectType
          WHERE {
            <%s> ?predicate ?object .
            OPTIONAL { ?object a ?objectType }
            FILTER(?predicate != rdf:type)
          }
          LIMIT 50
          """
                .formatted(getEntityUri(result.getEntity()));

        List<Map<String, String>> relationships = rdfRepository.executeSparqlQueryAsJson(sparql);

        // Boost score based on relevant relationships
        double contextBoost = calculateContextBoost(relationships, query);
        SearchResult enhanced =
            new SearchResult(
                result.getEntity(),
                result.getScore() * (1 + contextBoost),
                result.getExplanation() + "; Graph context boost: " + contextBoost);

        // Add relationship metadata
        enhanced.withMetadata("relationships", relationships.size());
        enhanced.withMetadata("contextRelevance", contextBoost);

        results.set(results.indexOf(result), enhanced);

      } catch (Exception e) {
        LOG.debug("Error enhancing result: {}", e.getMessage());
      }
    }

    return results;
  }

  private List<SearchResult> applySemanticInference(List<SearchResult> results, String query) {
    List<SearchResult> inferredResults = new ArrayList<>(results);

    try {
      // Use inference to find additional related entities
      for (SearchResult result : results) {
        String sparql =
            """
          PREFIX om: <https://open-metadata.org/ontology/>
          SELECT ?related ?type ?relationship
          WHERE {
            <%s> ?relationship ?related .
            ?related a ?type .
            FILTER(?relationship IN (om:relatedTo, om:similarTo, om:derivedFrom))
          }
          """
                .formatted(getEntityUri(result.getEntity()));

        // Execute with custom inference rules
        List<Map<String, String>> inferenceResults =
            rdfRepository.executeSparqlQueryWithInferenceAsJson(sparql, "custom");

        for (Map<String, String> row : inferenceResults) {
          String relatedUri = row.get("related");
          String relationType = row.get("relationship");

          if (relatedUri != null && relationType != null) {
            // Extract relationship type from URI
            String relationName = relationType.substring(relationType.lastIndexOf("#") + 1);

            // Create inferred result
            EntityReference related = getEntityFromUri(relatedUri);
            if (related != null && !isDuplicate(inferredResults, related)) {
              SearchResult inferred =
                  new SearchResult(
                      related,
                      result.getScore() * 0.8, // Slightly lower score for inferred
                      "Inferred through " + relationName + " from " + result.getEntity().getName());
              inferred.withMetadata("inferenceType", relationName);
              inferredResults.add(inferred);
            }
          }
        }
      }
    } catch (Exception e) {
      LOG.error("Inference failed", e);
    }

    return inferredResults;
  }

  private boolean isDuplicate(List<SearchResult> results, EntityReference entity) {
    return results.stream().anyMatch(r -> r.getEntity().getId().equals(entity.getId()));
  }

  private List<SearchResult> reRankResults(List<SearchResult> results, int limit) {
    // Remove duplicates keeping highest score
    Map<String, SearchResult> uniqueResults = new HashMap<>();
    for (SearchResult result : results) {
      String id = result.getEntity().getId().toString();
      if (!uniqueResults.containsKey(id) || uniqueResults.get(id).getScore() < result.getScore()) {
        uniqueResults.put(id, result);
      }
    }

    // Sort by final score and limit
    return uniqueResults.values().stream()
        .sorted((a, b) -> Double.compare(b.getScore(), a.getScore()))
        .limit(limit)
        .collect(Collectors.toList());
  }

  private float[] getOrGenerateEmbedding(EntityInterface entity) {
    String cacheKey = entity.getId().toString();

    return embeddingCache.computeIfAbsent(
        cacheKey,
        k -> {
          // Generate text representation for embedding
          StringBuilder text = new StringBuilder();
          text.append(entity.getName()).append(" ");
          text.append(entity.getDisplayName()).append(" ");
          text.append(entity.getDescription()).append(" ");

          // Add tags
          if (entity.getTags() != null) {
            entity.getTags().forEach(tag -> text.append(tag.getTagFQN()).append(" "));
          }

          return embeddingService.generateEmbedding(text.toString());
        });
  }

  private double cosineSimilarity(float[] a, float[] b) {
    if (a.length != b.length) return 0.0;

    double dotProduct = 0.0;
    double normA = 0.0;
    double normB = 0.0;

    for (int i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private double calculateContextBoost(List<Map<String, String>> relationships, String query) {
    // Simple keyword matching in relationships
    String[] queryTerms = query.toLowerCase().split("\\s+");
    int matches = 0;

    for (Map<String, String> rel : relationships) {
      String relString = rel.values().toString().toLowerCase();
      for (String term : queryTerms) {
        if (relString.contains(term)) {
          matches++;
        }
      }
    }

    return Math.min(matches * 0.1, 0.5); // Max 50% boost
  }

  private List<String> getEntitiesOfType(String entityType) {
    // Query from the appropriate named graph with both om: and dcat: types
    String graphUri = "https://open-metadata.org/graph/" + entityType.toLowerCase();
    String omType = entityType.substring(0, 1).toUpperCase() + entityType.substring(1);
    String sparql =
        """
      PREFIX om: <https://open-metadata.org/ontology/>
      PREFIX dcat: <http://www.w3.org/ns/dcat#>
      SELECT DISTINCT ?entity
      WHERE {
        GRAPH <%s> {
          ?entity a om:%s .
        }
      }
      """
            .formatted(graphUri, omType);

    return rdfRepository.executeSparqlQueryAsJson(sparql).stream()
        .map(m -> m.get("entity"))
        .map(uri -> uri.substring(uri.lastIndexOf("/") + 1))
        .collect(Collectors.toList());
  }

  private String getEntityUri(EntityReference ref) {
    return String.format(
        "https://open-metadata.org/entity/%s/%s", ref.getType().toLowerCase(), ref.getId());
  }

  private EntityReference getEntityFromUri(String uri) {
    try {
      String[] parts = uri.split("/");
      String type = parts[parts.length - 2];
      String id = parts[parts.length - 1];

      EntityInterface entity = Entity.getEntity(type, UUID.fromString(id), "", null);
      return entity.getEntityReference();
    } catch (Exception e) {
      return null;
    }
  }

  private List<SearchResult> enhanceWithRelationships(
      EntityInterface source, List<SearchResult> similar, int limit) {
    // Query for common relationships patterns
    for (SearchResult result : similar) {
      try {
        String sparql =
            """
          PREFIX om: <https://open-metadata.org/ontology/>
          SELECT (COUNT(DISTINCT ?common) as ?commonCount)
          WHERE {
            {
              <%s> ?p1 ?common .
              <%s> ?p2 ?common .
            } UNION {
              ?common ?p3 <%s> .
              ?common ?p4 <%s> .
            }
          }
          """
                .formatted(
                    getEntityUri(source.getEntityReference()),
                    getEntityUri(result.getEntity()),
                    getEntityUri(source.getEntityReference()),
                    getEntityUri(result.getEntity()));

        List<Map<String, String>> commonResults = rdfRepository.executeSparqlQueryAsJson(sparql);
        if (!commonResults.isEmpty()) {
          int commonCount = Integer.parseInt(commonResults.get(0).get("commonCount"));
          result.withMetadata("commonRelationships", commonCount);

          // Boost score based on common relationships
          SearchResult enhanced =
              new SearchResult(
                  result.getEntity(),
                  result.getScore() * (1 + commonCount * 0.05),
                  result.getExplanation() + "; Common relationships: " + commonCount);
          similar.set(similar.indexOf(result), enhanced);
        }
      } catch (Exception e) {
        LOG.debug("Error enhancing with relationships: {}", e.getMessage());
      }
    }

    return similar.stream()
        .sorted((a, b) -> Double.compare(b.getScore(), a.getScore()))
        .limit(limit)
        .collect(Collectors.toList());
  }

  private UserProfile buildUserProfile(List<Map<String, String>> interactions) {
    return new UserProfile(interactions);
  }

  private List<SearchResult> generateRecommendations(
      UserProfile profile, String entityType, int limit) {
    // Generate recommendations based on user profile
    // This would use collaborative filtering, content-based filtering, or hybrid approaches
    List<SearchResult> recommendations = new ArrayList<>();

    // Get entities similar to user's interests
    for (String interest : profile.getTopInterests()) {
      try {
        UUID entityId = UUID.fromString(interest);
        List<SearchResult> similar = findSimilarEntities(entityId.toString(), entityType, 5);
        recommendations.addAll(similar);
      } catch (Exception e) {
        LOG.debug("Error processing interest: {}", e.getMessage());
      }
    }

    return reRankResults(recommendations, limit);
  }

  /**
   * User profile for personalized recommendations
   */
  private static class UserProfile {
    private final Map<String, Integer> interactionCounts = new HashMap<>();
    private final Map<String, Long> lastInteractions = new HashMap<>();

    public UserProfile(List<Map<String, String>> interactions) {
      for (Map<String, String> interaction : interactions) {
        String entity = interaction.get("entity");
        interactionCounts.merge(entity, 1, Integer::sum);

        try {
          long timestamp = Long.parseLong(interaction.get("timestamp"));
          lastInteractions.put(entity, timestamp);
        } catch (Exception e) {
          // Ignore parse errors
        }
      }
    }

    public List<String> getTopInterests() {
      return interactionCounts.entrySet().stream()
          .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
          .limit(10)
          .map(Map.Entry::getKey)
          .map(uri -> uri.substring(uri.lastIndexOf("/") + 1))
          .collect(Collectors.toList());
    }
  }
}
