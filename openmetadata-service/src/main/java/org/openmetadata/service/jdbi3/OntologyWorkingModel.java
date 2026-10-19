package org.openmetadata.service.jdbi3;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.OntologyEntityInterface;
import org.openmetadata.schema.api.data.OntologyProfileReport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyClassHierarchy;
import org.openmetadata.service.ontology.OntologyReferences;
import org.openmetadata.service.ontology.OntologyReleaseManifest;
import org.openmetadata.service.ontology.OntologyReleaseReader;
import org.openmetadata.service.ontology.OntologyStructureValidator;

/** Reads only affected definitions and their semantic context under the ontology's write lock. */
final class OntologyWorkingModel {
  private static final List<String> STRUCTURE =
      List.of(
          "iri",
          "deleted",
          "conceptType",
          "conceptMappings",
          "kind",
          "domain",
          "range",
          "inverse",
          "propertyChain",
          "disjointWith",
          "characteristics",
          "enumValues",
          "axiomType",
          "subjectIri",
          "expressions",
          "propertyIri",
          "targetIri",
          "literal");
  private static final int LIMIT = OntologyReleaseManifest.MAX_MEMBERS;
  private final CollectionDAO dao;

  record Change(OntologyDefinition before, OntologyDefinition after) {}

  OntologyWorkingModel(final CollectionDAO dao) {
    this.dao = dao;
  }

  void requireValid(final UUID ontologyId, final List<Change> changes) {
    final var context = new Context(ontologyId, true);
    for (final var change : changes) {
      if (!structure(change.before()).equals(structure(change.after()))) {
        if (change.after() != null) {
          context.add(change.after(), true);
        }
        if (change.before() instanceof OntologyEntityInterface declaration) {
          context.dependents(Set.of(declaration.getIri().toString()));
        } else if (change.after() instanceof OntologyEntityInterface declaration) {
          context.dependents(Set.of(declaration.getIri().toString()));
        }
      }
    }
    context.expand();
    OntologyStructureValidator.requireValidWorking(context.values(), context.affected);
  }

  OntologyProfileReport validate(final OntologyAxiom proposed) {
    final var context = new Context(proposed.getOntology().getId(), false);
    context.add(proposed, true);
    context.expand();
    return OntologyStructureValidator.validateWorking(context.values(), context.affected);
  }

  private static ObjectNode structure(final OntologyDefinition value) {
    return value == null || value instanceof Ontology
        ? JsonUtils.getObjectMapper().createObjectNode()
        : ((ObjectNode) JsonUtils.getObjectMapper().valueToTree(value)).retain(STRUCTURE);
  }

  private final class Context {
    private final UUID ontologyId;
    private final String locking;
    private final Map<UUID, OntologyDefinition> definitions = new LinkedHashMap<>();
    private final Set<UUID> affected = new HashSet<>();
    private final Set<String> dependentIris = new HashSet<>();
    private final Set<String> declaredIris = new HashSet<>();
    private final Set<String> ancestorIris = new HashSet<>();
    private long bytes;

    Context(final UUID ontologyId, final boolean forUpdate) {
      this.ontologyId = ontologyId;
      this.locking = forUpdate ? "FOR UPDATE" : "";
    }

    List<OntologyDefinition> values() {
      return List.copyOf(definitions.values());
    }

    void add(final OntologyDefinition value, final boolean validate) {
      if (Boolean.TRUE.equals(value.getDeleted()) || value instanceof Ontology) {
        return;
      }
      if (validate) {
        affected.add(value.getId());
      }
      if (definitions.putIfAbsent(value.getId(), value) == null) {
        final int size = JsonUtils.pojoToJson(value).getBytes(StandardCharsets.UTF_8).length;
        if (size > OntologyReleaseManifest.MAX_MEMBER_BYTES) {
          throw new BadRequestException("An ontology definition exceeds the 1 MiB member limit");
        }
        bytes += size;
        OntologyReleaseReader.requireBounds(definitions.size(), bytes);
      }
    }

    void dependents(final Set<String> iris) {
      final var pending = new HashSet<>(iris);
      while (!pending.isEmpty()) {
        pending.removeAll(dependentIris);
        if (pending.isEmpty()) {
          return;
        }
        dependentIris.addAll(pending);
        requireBound(dependentIris.size());
        final var references =
            dao.ontologyReferenceDAO()
                .referencingForUpdate(
                    ontologyId, pending.stream().map(DigestUtils::sha256Hex).toList(), LIMIT + 1);
        requireBound(references.size());
        final var next = new HashSet<String>();
        includeInversePartners(pending, next);
        for (final var reference : references) {
          if (!pending.contains(reference.getIri().toString())) {
            continue;
          }
          final var source = reference.getSource();
          if (affected.contains(source.getId())) {
            continue;
          }
          final EntityDAO<? extends OntologyDefinition> entities =
              switch (source.getType()) {
                case Entity.ONTOLOGY_CONCEPT -> dao.ontologyConceptDAO();
                case Entity.ONTOLOGY_PROPERTY -> dao.ontologyPropertyDAO();
                case Entity.ONTOLOGY_AXIOM -> dao.ontologyAxiomDAO();
                default -> throw new BadRequestException("Unsupported ontology reference source");
              };
          final String json = entities.findJsonByIdForUpdate(source.getId(), Include.NON_DELETED);
          if (json != null) {
            final var value = JsonUtils.readValue(json, entities.getEntityClass());
            add(value, true);
            if (value instanceof OntologyEntityInterface declaration) {
              next.add(declaration.getIri().toString());
            }
          }
        }
        pending.clear();
        pending.addAll(next);
      }
    }

    private void includeInversePartners(final Set<String> iris, final Set<String> next) {
      final var entities = dao.ontologyPropertyDAO();
      final var rows =
          entities.findDeclarations(
              entities.getTableName(),
              ontologyId,
              iris.stream().map(DigestUtils::md5Hex).toList(),
              LIMIT + 1,
              locking);
      requireBound(rows.size());
      for (final var json : rows) {
        final var property = JsonUtils.readValue(json, OntologyProperty.class);
        if (iris.contains(property.getIri().toString())) {
          add(property, true);
          if (property.getInverse() != null) {
            next.add(property.getInverse().toString());
          }
        }
      }
    }

    void expand() {
      final Set<UUID> expanded = new HashSet<>();
      while (expanded.size() < definitions.size()) {
        final var iris = new HashSet<String>();
        final var parents = new HashSet<String>();
        for (final var value : values()) {
          if (expanded.add(value.getId())) {
            OntologyReferences.collect(value).forEach(ref -> iris.add(ref.getIri().toString()));
            if (value instanceof OntologyProperty property) {
              iris.add(property.getIri().toString());
            }
            if (value instanceof OntologyAxiom axiom) {
              OntologyClassHierarchy.namedParents(axiom).stream()
                  .map(URI::toString)
                  .forEach(parents::add);
            }
          }
        }
        iris.removeAll(declaredIris);
        parents.removeAll(ancestorIris);
        declaredIris.addAll(iris);
        ancestorIris.addAll(parents);
        requireBound(declaredIris.size());
        if (!iris.isEmpty()) {
          final var hashes = iris.stream().map(DigestUtils::md5Hex).toList();
          for (final var entities : List.of(dao.ontologyConceptDAO(), dao.ontologyPropertyDAO())) {
            final var rows =
                entities.findDeclarations(
                    entities.getTableName(), ontologyId, hashes, LIMIT + 1, locking);
            requireBound(rows.size());
            rows.stream()
                .map(json -> JsonUtils.readValue(json, entities.getEntityClass()))
                .forEach(value -> add(value, false));
          }
          final var inverses =
              dao.ontologyReferenceDAO()
                  .incomingInverses(
                      ontologyId,
                      iris.stream().map(DigestUtils::sha256Hex).toList(),
                      LIMIT + 1,
                      locking);
          requireBound(inverses.size());
          inverses.stream()
              .map(json -> JsonUtils.readValue(json, OntologyProperty.class))
              .forEach(value -> add(value, false));
        }
        if (!parents.isEmpty()) {
          final var rows =
              dao.ontologyReferenceDAO()
                  .ancestors(
                      ontologyId,
                      parents.stream().map(DigestUtils::sha256Hex).toList(),
                      LIMIT + 1,
                      locking);
          requireBound(rows.size());
          rows.stream()
              .map(json -> JsonUtils.readValue(json, OntologyAxiom.class))
              .forEach(value -> add(value, false));
        }
      }
    }
  }

  private static void requireBound(final int size) {
    if (size > LIMIT) {
      throw new BadRequestException("Ontology validation exceeds the 10000 reference limit");
    }
  }
}
