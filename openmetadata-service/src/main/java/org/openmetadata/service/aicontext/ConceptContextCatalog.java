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
package org.openmetadata.service.aicontext;

import static org.openmetadata.service.aicontext.ConceptContextBuilder.CANDIDATE_PAGE_SIZE;
import static org.openmetadata.service.search.SearchClient.DATA_ASSET_SEARCH_ALIAS;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.aicontext.Observability;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.ConceptContextBuilder.CandidatePage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.resources.context.ContextMemoryVisibility;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.ChildFieldResolver;

/** Catalog boundary for concept resolution; cursor and page storage are request-local and bounded. */
@Slf4j
final class ConceptContextCatalog implements ConceptContextBuilder.Catalog {
  /**
   * Members of the data-asset alias that are not assets realizing a concept: a column document
   * duplicates its parent table's column binding, and terms, tags and articles are vocabulary or
   * knowledge rather than data.
   */
  private static final List<String> NON_ASSET_TYPES =
      List.of(Entity.TABLE_COLUMN, Entity.GLOSSARY_TERM, Entity.TAG, Entity.PAGE);

  private static final String ASSETS_ONLY_FILTER =
      JsonUtils.pojoToJson(
          Map.of(
              "query",
              Map.of(
                  "bool",
                  Map.of("must_not", Map.of("terms", Map.of("entityType", NON_ASSET_TYPES))))));

  private final Authorizer authorizer;
  private final SecurityContext securityContext;
  private final Function<Table, Observability> profileLoader;
  private final Function<Table, TableData> sampleLoader;
  private List<Object> searchAfter;

  ConceptContextCatalog(
      Authorizer authorizer,
      SecurityContext securityContext,
      Function<Table, Observability> profileLoader,
      Function<Table, TableData> sampleLoader) {
    this.authorizer = authorizer;
    this.securityContext = securityContext;
    this.profileLoader = profileLoader;
    this.sampleLoader = sampleLoader;
  }

  @Override
  public CandidatePage candidates(EntityInterface concept, int offset) {
    return concept instanceof GlossaryTerm term
        ? taggedAssets(term, offset)
        : metricAssets(concept, offset);
  }

  private CandidatePage taggedAssets(GlossaryTerm term, int offset) {
    SearchRequest request =
        AIContextFinder.tagSearchRequest(
                term.getFullyQualifiedName(),
                Entity.getSearchRepository().getIndexOrAliasName(DATA_ASSET_SEARCH_ALIAS),
                CANDIDATE_PAGE_SIZE)
            .withQueryFilter(ASSETS_ONLY_FILTER)
            .withSortFieldParam("id.keyword")
            .withSortOrder("asc")
            .withSearchAfter(searchAfter)
            .withIncludeAggregations(false);
    try (Response response = Entity.getSearchRepository().search(request, subject())) {
      String json = (String) response.getEntity();
      JsonNode hits = JsonUtils.readTree(json).path("hits").path("hits");
      List<EntityReference> references = new ArrayList<>();
      AIContextFinder.parseTagHits(json, references);
      searchAfter = nextCursor(hits);
      if (hits.size() == CANDIDATE_PAGE_SIZE && searchAfter.isEmpty()) {
        throw new IllegalStateException(
            "Missing search cursor while resolving " + term.getFullyQualifiedName());
      }
      return new CandidatePage(
          references, offset + hits.size(), hits.size() == CANDIDATE_PAGE_SIZE);
    } catch (IOException e) {
      throw new UncheckedIOException(
          "Failed to resolve bound assets for " + term.getFullyQualifiedName(), e);
    }
  }

  private static List<Object> nextCursor(JsonNode hits) {
    List<Object> cursor = new ArrayList<>();
    if (!hits.isEmpty()) {
      hits.get(hits.size() - 1)
          .path("sort")
          .forEach(value -> cursor.add(JsonUtils.convertValue(value, Object.class)));
    }
    return cursor;
  }

  private SubjectContext subject() {
    return securityContext == null ? null : DefaultAuthorizer.getSubjectContext(securityContext);
  }

  private static CandidatePage metricAssets(EntityInterface metric, int offset) {
    List<EntityRelationshipRecord> records =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findToWithOffset(
                metric.getId(),
                Entity.METRIC,
                List.of(Relationship.APPLIED_TO.ordinal()),
                offset,
                CANDIDATE_PAGE_SIZE);
    // A memory whose primaryEntity is this metric shares the metric --APPLIED_TO--> edge; it is
    // knowledge about the metric, not an asset that supplies it.
    List<EntityRelationshipRecord> assets =
        records.stream().filter(record -> !Entity.CONTEXT_MEMORY.equals(record.getType())).toList();
    List<EntityReference> references =
        Entity.getEntityRelationshipRepository().getEntityReferences(assets, Include.NON_DELETED);
    return new CandidatePage(
        references, offset + records.size(), records.size() == CANDIDATE_PAGE_SIZE);
  }

  @Override
  public EntityInterface asset(EntityReference reference) {
    EntityInterface asset = null;
    try {
      asset = Entity.getEntity(reference, assetFields(reference.getType()), Include.NON_DELETED);
    } catch (EntityNotFoundException e) {
      LOG.debug(
          "Concept context: {} {} disappeared during resolution",
          reference.getType(),
          reference.getFullyQualifiedName());
    }
    return asset;
  }

  /** Tags plus the type's child-field containers, limited to fields the repository can load. */
  static String assetFields(String type) {
    Set<String> allowed = Entity.getEntityRepository(type).getAllowedFields();
    Stream<String> containers =
        ChildFieldResolver.supports(type)
            ? Arrays.stream(ChildFieldResolver.containerFields(type).split(","))
            : Stream.empty();
    return Stream.concat(Stream.of(Entity.FIELD_TAGS), containers)
        .filter(allowed::contains)
        .distinct()
        .collect(Collectors.joining(","));
  }

  @Override
  public boolean canView(String type, String fqn) {
    return fqn != null
        && AIContextBuilder.canViewKnowledge(
            authorizer, securityContext, type, fqn, MetadataOperation.VIEW_BASIC);
  }

  @Override
  public ContextMemory memory(UUID id) {
    ContextMemory memory = null;
    try {
      ContextMemory loaded =
          Entity.getEntity(
              Entity.CONTEXT_MEMORY,
              id,
              ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, "relatedEntities"),
              Include.NON_DELETED);
      if (securityContext != null) {
        ContextMemoryVisibility.enforceVisibility(loaded, securityContext);
      }
      memory = loaded;
    } catch (EntityNotFoundException | ForbiddenException e) {
      LOG.debug("Concept context: source memory {} is unavailable to caller", id);
    }
    return memory;
  }

  @Override
  public Query query(EntityReference reference) {
    Query query = null;
    try {
      query = Entity.getEntity(reference, "", Include.NON_DELETED);
    } catch (EntityNotFoundException e) {
      LOG.debug("Concept context: evidence query {} is no longer available", reference.getId());
    }
    return query;
  }

  @Override
  public Observability profile(Table table) {
    return profileLoader.apply(table);
  }

  @Override
  public TableData sampleData(Table table) {
    return sampleLoader.apply(table);
  }
}
