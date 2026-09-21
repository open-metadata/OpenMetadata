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

package org.openmetadata.service.rdf.insights;

import java.util.Objects;
import org.openmetadata.service.rdf.RdfRepository;

/** Application service for RDF graph insight queries and computations. */
public final class RdfInsightsService {

  private static final String SPARQL_JSON = "application/sparql-results+json";
  private final RdfRepository repository;

  public RdfInsightsService(RdfRepository repository) {
    this.repository = Objects.requireNonNull(repository);
  }

  public String listImportantEntities(String entityType, String window, int limit) {
    return query(ImportanceQueryBuilder.build(entityType, window, limit));
  }

  public CentralityComputation.Result recomputeCentrality(String entityType) {
    return new CentralityComputation(repository).computeAndPersist(entityType);
  }

  public CommunityComputation.Result recomputeCommunities(String entityType, String graphType) {
    return new CommunityComputation(repository).computeAndPersist(entityType, graphType);
  }

  public String listCommunities(String entityType, String graphType) {
    return query(CommunityComputation.listingSparql(entityType, graphType));
  }

  public LineagePathFinder.Path findLineagePath(
      String from, String to, String direction, Integer maxHops) {
    LineagePathBuilder.Direction parsedDirection = LineagePathBuilder.Direction.parse(direction);
    return new LineagePathFinder(repository).findPath(from, to, parsedDirection, maxHops);
  }

  public String datasetRecommendations(String entityUri, int limit) {
    return query(RecommendationsQueryBuilder.build(entityUri, limit));
  }

  public String tagCoOccurrence(int minimumCount, int limit) {
    return query(CoOccurrenceQueryBuilder.tagCoOccurrence(minimumCount, limit));
  }

  public String glossaryReach(int minimumDomains, int limit) {
    return query(CoOccurrenceQueryBuilder.glossaryReach(minimumDomains, limit));
  }

  public String tagPopularity(int limit) {
    return query(CoOccurrenceQueryBuilder.tagPopularity(limit));
  }

  private String query(String sparql) {
    return repository.executeSparqlQuery(sparql, SPARQL_JSON);
  }
}
