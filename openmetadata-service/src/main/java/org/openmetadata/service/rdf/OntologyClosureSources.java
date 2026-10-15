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

package org.openmetadata.service.rdf;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.apache.jena.query.QuerySolution;
import org.apache.jena.query.ResultSet;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.riot.ResultSetMgr;
import org.apache.jena.riot.resultset.ResultSetLang;
import org.openmetadata.schema.api.rdf.RdfSourceRevision;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;

/** The serving store and metadata database behind {@link OntologyClosures}. */
public final class OntologyClosureSources {
  private OntologyClosureSources() {}

  public static OntologyClosures forRepository(final RdfRepository repository) {
    return new OntologyClosures(
        repository.getConfig().getBaseUri(),
        new RepositoryStore(repository),
        new DatabaseMetadata(repository),
        Clock.systemUTC());
  }

  /** Reads through the repository's serving storage, failing on any result it cannot parse. */
  private record RepositoryStore(RdfRepository repository) implements OntologyClosures.Store {
    @Override
    public List<Map<String, String>> select(final String query) {
      final String json = repository.executeSparqlQueryDirect(query, "json");
      final ResultSet results =
          ResultSetMgr.read(
              new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)),
              ResultSetLang.RS_JSON);
      final List<Map<String, String>> rows = new ArrayList<>();
      while (results.hasNext()) {
        final QuerySolution solution = results.next();
        final Map<String, String> row = new HashMap<>();
        solution
            .varNames()
            .forEachRemaining(
                variable -> {
                  final RDFNode node = solution.get(variable);
                  if (node != null) {
                    row.put(variable, value(node));
                  }
                });
        rows.add(row);
      }
      return rows;
    }

    private static String value(final RDFNode node) {
      if (node.isURIResource()) {
        return node.asResource().getURI();
      }
      return node.isLiteral() ? node.asLiteral().getLexicalForm() : node.toString();
    }

    @Override
    public boolean ask(final String query) {
      final JsonNode answer =
          JsonUtils.readTree(repository.executeSparqlQueryDirect(query, "json")).get("boolean");
      if (answer == null || !answer.isBoolean()) {
        throw new IllegalStateException("The RDF store returned no ASK answer");
      }
      return answer.asBoolean();
    }

    @Override
    public void update(final String update) {
      repository.executeSparqlUpdate(update);
    }
  }

  private record DatabaseMetadata(RdfRepository repository) implements OntologyClosures.Metadata {
    @Override
    public Optional<Glossary> glossary(final UUID glossaryId) {
      try {
        return Optional.of(
            Entity.getEntity(
                Entity.GLOSSARY, glossaryId, "ontologyConfiguration", Include.NON_DELETED));
      } catch (EntityNotFoundException missing) {
        return Optional.empty();
      }
    }

    @Override
    public long approvedAxiomCount(final UUID glossaryId) {
      final ListFilter filter = approved();
      filter.addQueryParam("glossaryId", glossaryId.toString());
      return repository(Entity.ONTOLOGY_AXIOM).getDao().listCount(filter);
    }

    @Override
    public long approvedTermCount(final Glossary glossary) {
      final ListFilter filter = approved();
      filter.addQueryParam("parent", glossary.getFullyQualifiedName());
      return repository(Entity.GLOSSARY_TERM).getDao().listCount(filter);
    }

    private static ListFilter approved() {
      final ListFilter filter = new ListFilter(Include.NON_DELETED);
      filter.addQueryParam("entityStatus", EntityStatus.APPROVED.value());
      return filter;
    }

    private static EntityRepository<?> repository(final String entityType) {
      return Entity.getEntityRepository(entityType);
    }

    @Override
    public boolean projectionReady() {
      // A rebuild is not a reason to refuse: a blue/green build leaves the serving graphs live, and
      // an in-place one that cleared them shows up as missing Approved graphs.
      return !RdfProjectionHealth.isDegraded();
    }

    @Override
    public Optional<RdfSourceRevision> sourceRevision() {
      final UUID generation = repository.servingGeneration();
      if (generation == null) {
        return Optional.empty();
      }
      return Optional.of(
          new RdfSourceRevision()
              .withDatasetGeneration(generation)
              .withLiveWriteWatermark(
                  new RdfLiveWriteStore(Entity.getJdbi(), Clock.systemUTC())
                      .acknowledgedWatermark()));
    }
  }
}
