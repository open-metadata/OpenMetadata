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
package org.openmetadata.service.rdf.rebuild;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.openmetadata.service.rdf.RdfWriteMode;
import org.openmetadata.service.rdf.storage.RdfPayloadTooLargeException;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.storage.RdfStorageInterface.EntityWriteRequest;
import org.openmetadata.service.rdf.storage.RdfStorageInterface.RelationshipData;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "operation")
@JsonSubTypes({
  @JsonSubTypes.Type(value = RdfMutation.EntityWrite.class, name = "entity"),
  @JsonSubTypes.Type(value = RdfMutation.EntityBatch.class, name = "entities"),
  @JsonSubTypes.Type(value = RdfMutation.EntityDelete.class, name = "delete"),
  @JsonSubTypes.Type(value = RdfMutation.RelationshipWrite.class, name = "relationship"),
  @JsonSubTypes.Type(value = RdfMutation.RelationshipBatch.class, name = "relationships"),
  @JsonSubTypes.Type(value = RdfMutation.Sparql.class, name = "sparql"),
  @JsonSubTypes.Type(value = RdfMutation.Turtle.class, name = "turtle"),
  @JsonSubTypes.Type(value = RdfMutation.GraphClear.class, name = "clear")
})
public sealed interface RdfMutation {
  int MAX_MODEL_BYTES = 16 * 1024 * 1024;

  void apply(RdfStorageInterface storage);

  record EntityWrite(String entityType, UUID entityId, byte[] rdf) implements RdfMutation {
    public static EntityWrite capture(final String type, final UUID id, final Model model) {
      return new EntityWrite(type, id, encode(model));
    }

    @Override
    public void apply(final RdfStorageInterface storage) {
      withModel(rdf, model -> storage.storeEntity(entityType, entityId, model));
    }

    EntityWriteRequest request(final Model model) {
      return new EntityWriteRequest(entityType, entityId, model);
    }
  }

  record EntityBatch(List<EntityWrite> entities, RdfWriteMode mode) implements RdfMutation {
    public EntityBatch {
      entities = List.copyOf(entities);
    }

    public static EntityBatch capture(
        final List<EntityWriteRequest> requests, final RdfWriteMode mode) {
      final List<EntityWrite> entities = new ArrayList<>();
      long bytes = 0;
      for (EntityWriteRequest request : requests) {
        final EntityWrite entity =
            EntityWrite.capture(request.entityType(), request.entityId(), request.model());
        bytes += entity.rdf().length;
        if (bytes > MAX_MODEL_BYTES) {
          throw new RdfPayloadTooLargeException("RDF mutation exceeds journal capture limit");
        }
        entities.add(entity);
      }
      return new EntityBatch(entities, mode);
    }

    @Override
    public void apply(final RdfStorageInterface storage) {
      final List<EntityWriteRequest> requests = new ArrayList<>();
      try {
        for (EntityWrite entity : entities) {
          requests.add(entity.request(decode(entity.rdf())));
        }
        storage.bulkStoreEntities(requests, mode);
      } finally {
        requests.forEach(request -> request.model().close());
      }
    }
  }

  record EntityDelete(String entityType, UUID entityId) implements RdfMutation {
    @Override
    public void apply(final RdfStorageInterface storage) {
      storage.deleteEntity(entityType, entityId);
    }
  }

  record EntityKey(String type, UUID id) {}

  record Relation(EntityKey from, EntityKey to, String relationshipType, String predicateUri) {
    public static Relation capture(final RelationshipData relationship) {
      return new Relation(
          new EntityKey(relationship.getFromType(), relationship.getFromId()),
          new EntityKey(relationship.getToType(), relationship.getToId()),
          relationship.getRelationshipType(),
          relationship.getPredicateUri());
    }

    RelationshipData data() {
      return new RelationshipData(
          from.type(), from.id(), to.type(), to.id(), relationshipType, predicateUri);
    }
  }

  record RelationshipWrite(Relation relation) implements RdfMutation {
    @Override
    public void apply(final RdfStorageInterface storage) {
      storage.storeRelationship(
          relation.from().type(),
          relation.from().id(),
          relation.to().type(),
          relation.to().id(),
          relation.relationshipType());
    }
  }

  record RelationshipBatch(List<Relation> relationships, Set<String> sources)
      implements RdfMutation {
    public RelationshipBatch {
      relationships = List.copyOf(relationships);
      sources = sources != null ? Set.copyOf(sources) : Set.of();
    }

    public static RelationshipBatch capture(
        final List<RelationshipData> relationships, final Set<String> sources) {
      return new RelationshipBatch(relationships.stream().map(Relation::capture).toList(), sources);
    }

    @Override
    public void apply(final RdfStorageInterface storage) {
      storage.bulkStoreRelationships(relationships.stream().map(Relation::data).toList(), sources);
    }
  }

  record Sparql(String statement) implements RdfMutation {
    @Override
    public void apply(final RdfStorageInterface storage) {
      storage.executeSparqlUpdate(statement);
    }
  }

  record Turtle(byte[] rdf, String graph) implements RdfMutation {
    @Override
    public void apply(final RdfStorageInterface storage) {
      storage.loadTurtleFile(new ByteArrayInputStream(rdf), graph);
    }
  }

  record GraphClear(String graph) implements RdfMutation {
    @Override
    public void apply(final RdfStorageInterface storage) {
      storage.clearGraph(graph);
    }
  }

  private static byte[] encode(final Model model) {
    final ByteArrayOutputStream output =
        new ByteArrayOutputStream() {
          @Override
          public synchronized void write(final byte[] bytes, final int offset, final int length) {
            requireCapacity(length);
            super.write(bytes, offset, length);
          }

          @Override
          public synchronized void write(final int value) {
            requireCapacity(1);
            super.write(value);
          }

          private void requireCapacity(final int additional) {
            if (additional > MAX_MODEL_BYTES - count) {
              throw new RdfPayloadTooLargeException("RDF model exceeds journal capture limit");
            }
          }
        };
    RDFDataMgr.write(output, model, RDFFormat.RDF_THRIFT);
    return output.toByteArray();
  }

  private static Model decode(final byte[] rdf) {
    final Model model = ModelFactory.createDefaultModel();
    try {
      RDFDataMgr.read(model, new ByteArrayInputStream(rdf), Lang.RDFTHRIFT);
      return model;
    } catch (RuntimeException exception) {
      model.close();
      throw exception;
    }
  }

  private static void withModel(final byte[] rdf, final Consumer<Model> mutation) {
    final Model model = decode(rdf);
    try {
      mutation.accept(model);
    } finally {
      model.close();
    }
  }
}
