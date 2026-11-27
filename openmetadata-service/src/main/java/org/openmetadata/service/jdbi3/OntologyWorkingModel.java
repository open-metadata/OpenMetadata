package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.common.collect.Lists;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
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
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.NativeOntologyDocument;
import org.openmetadata.service.ontology.OntologyClassHierarchy;
import org.openmetadata.service.ontology.OntologyReferences;
import org.openmetadata.service.ontology.OntologyReleaseManifest;
import org.openmetadata.service.ontology.OntologyReleaseReader;
import org.openmetadata.service.ontology.OntologyStructureValidator;
import org.openmetadata.service.ontology.OntologyWriteClosureLimits;

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
          "superProperties",
          "characteristics",
          "enumValues",
          "replacedBy",
          "axiomType",
          "subjectIri",
          "expressions",
          "propertyIri",
          "targetIri",
          "literal");
  private static final int LIMIT = OntologyWriteClosureLimits.WORKING_MODEL_CLOSURE;
  private static final int SUBJECTS_PER_RULE_QUERY = 20;
  // A current read: on MySQL REPEATABLE READ a plain SELECT could miss a rule a concurrent writer
  // just committed. ADR:2026-10-14-ontology-definitions-have-independent-entity-storage
  private static final String FOR_UPDATE = "FOR UPDATE";
  private final CollectionDAO dao;

  record Change(OntologyDefinition before, OntologyDefinition after) {}

  OntologyWorkingModel(final CollectionDAO dao) {
    this.dao = dao;
  }

  void requireValid(final UUID ontologyId, final List<Change> changes) {
    final var context = new Context(ontologyId, true, false);
    final List<OntologyAxiom> changedRules = new ArrayList<>();
    for (final var change : changes) {
      if (!structure(change.before()).equals(structure(change.after()))) {
        if (change.after() != null) {
          context.add(change.after(), true);
        }
        if (change.after() instanceof OntologyAxiom axiom
            && !Boolean.TRUE.equals(axiom.getDeleted())) {
          changedRules.add(axiom);
        }
        if (change.before() instanceof OntologyEntityInterface declaration) {
          context.dependents(Set.of(declaration.getIri().toString()));
        } else if (change.after() instanceof OntologyEntityInterface declaration) {
          context.dependents(Set.of(declaration.getIri().toString()));
        }
      }
    }
    requireDistinctRules(ontologyId, changedRules);
    context.expand();
    OntologyStructureValidator.requireValidWorking(context.values(), context.affected);
  }

  /**
   * A second rule that states exactly what a live one states adds nothing and lists twice in the
   * Studio, so the save is refused. Signatures compare the normalized content, not names. One
   * query reads the live rules of a chunk of the changed subjects, and each rule is signed once,
   * so a large install slice costs a query per chunk rather than per rule.
   * ADR:2026-11-16-a-live-rule-is-stated-once
   */
  private void requireDistinctRules(final UUID ontologyId, final List<OntologyAxiom> changed) {
    final Set<UUID> changedIds = new HashSet<>();
    changed.forEach(rule -> changedIds.add(rule.getId()));
    final List<String> subjects =
        changed.stream()
            .map(rule -> DigestUtils.sha256Hex(rule.getSubjectIri().toString()))
            .distinct()
            .toList();
    Lists.partition(subjects, SUBJECTS_PER_RULE_QUERY)
        .forEach(chunk -> requireDistinctRules(ontologyId, chunk, changedIds));
  }

  /**
   * The working-model bound applies per subject: a chunk whose subjects together hold more rules is
   * halved until each part fits, and only a single subject past the bound is refused.
   */
  private void requireDistinctRules(
      final UUID ontologyId, final List<String> subjectHashes, final Set<UUID> changedIds) {
    final List<String> rules =
        dao.ontologyReferenceDAO()
            .axiomsOfSubjects(ontologyId, subjectHashes, LIMIT + 1, FOR_UPDATE);
    if (rules.size() > LIMIT && subjectHashes.size() > 1) {
      final int half = subjectHashes.size() / 2;
      requireDistinctRules(ontologyId, subjectHashes.subList(0, half), changedIds);
      requireDistinctRules(
          ontologyId, subjectHashes.subList(half, subjectHashes.size()), changedIds);
    } else {
      requireBound(rules.size());
      requireNoDuplicate(
          rules.stream().map(json -> JsonUtils.readValue(json, OntologyAxiom.class)).toList(),
          changedIds);
    }
  }

  private static void requireNoDuplicate(
      final List<OntologyAxiom> rules, final Set<UUID> changedIds) {
    final Map<String, OntologyAxiom> bySignature = new HashMap<>();
    for (final OntologyAxiom rule : rules) {
      final OntologyAxiom earlier =
          bySignature.putIfAbsent(NativeOntologyDocument.signature(rule), rule);
      if (earlier != null
          && (changedIds.contains(rule.getId()) || changedIds.contains(earlier.getId()))) {
        throw duplicateRule(changedIds.contains(rule.getId()) ? earlier : rule);
      }
    }
  }

  private static BadRequestException duplicateRule(final OntologyAxiom existing) {
    return new BadRequestException(
        String.format(
            "The rule '%s' already states this; a duplicate rule adds nothing",
            existing.getDisplayName() == null ? existing.getName() : existing.getDisplayName()));
  }

  OntologyProfileReport validate(final OntologyAxiom proposed) {
    requireNotADuplicate(proposed);
    final var context = new Context(proposed.getOntology().getId(), false, true);
    context.add(proposed, true);
    context.expand();
    return OntologyStructureValidator.validateWorking(context.values(), context.affected);
  }

  /**
   * A dry run refuses a duplicate the way the save would, so the Studio never shows a rule as
   * valid that create then rejects. A plain read: a validation holds no locks. The proposed rule
   * replaces its own stored revision, so re-validating an unchanged rule is not a duplicate.
   */
  private void requireNotADuplicate(final OntologyAxiom proposed) {
    final List<OntologyAxiom> rules = new ArrayList<>(List.of(proposed));
    dao
        .ontologyReferenceDAO()
        .axiomsOfSubjects(
            proposed.getOntology().getId(),
            List.of(DigestUtils.sha256Hex(proposed.getSubjectIri().toString())),
            LIMIT + 1,
            "")
        .stream()
        .map(json -> JsonUtils.readValue(json, OntologyAxiom.class))
        .filter(rule -> !rule.getId().equals(proposed.getId()))
        .forEach(rules::add);
    requireNoDuplicate(rules, Set.of(proposed.getId()));
  }

  private static ObjectNode structure(final OntologyDefinition value) {
    return value == null || value instanceof Ontology
        ? JsonUtils.getObjectMapper().createObjectNode()
        : ((ObjectNode) JsonUtils.getObjectMapper().valueToTree(value)).retain(STRUCTURE);
  }

  private final class Context {
    private final UUID ontologyId;
    private final String locking;
    private final boolean withDisjointness;
    private final Map<UUID, OntologyDefinition> definitions = new LinkedHashMap<>();
    private final Set<UUID> affected = new HashSet<>();
    private final Set<String> dependentIris = new HashSet<>();
    private final Set<String> declaredIris = new HashSet<>();
    private final Set<String> ancestorIris = new HashSet<>();
    private long bytes;

    Context(final UUID ontologyId, final boolean forUpdate, final boolean withDisjointness) {
      this.ontologyId = ontologyId;
      this.withDisjointness = withDisjointness;
      this.locking = forUpdate ? FOR_UPDATE : "";
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
              if (withDisjointness) {
                disjointnessSeeds(axiom).forEach(parents::add);
              }
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
          if (withDisjointness) {
            final var disjoint =
                dao.ontologyReferenceDAO()
                    .disjointAxioms(
                        ontologyId,
                        parents.stream().map(DigestUtils::sha256Hex).toList(),
                        LIMIT + 1,
                        locking);
            requireBound(disjoint.size());
            disjoint.stream()
                .map(json -> JsonUtils.readValue(json, OntologyAxiom.class))
                .forEach(value -> add(value, false));
          }
        }
      }
    }

    /** Classes whose own parents must load so a disjointness clash through them is visible. */
    private static List<String> disjointnessSeeds(final OntologyAxiom axiom) {
      if (axiom.getSubjectIri() == null
          || (axiom.getAxiomType() != OntologyAxiomType.SUBCLASS_OF
              && axiom.getAxiomType() != OntologyAxiomType.DISJOINT_WITH)) {
        return List.of();
      }
      final var seeds = new ArrayList<String>();
      seeds.add(axiom.getSubjectIri().toString());
      if (axiom.getAxiomType() == OntologyAxiomType.DISJOINT_WITH) {
        listOrEmpty(axiom.getExpressions()).stream()
            .filter(expression -> expression != null && expression.getClassIri() != null)
            .forEach(expression -> seeds.add(expression.getClassIri().toString()));
      }
      return seeds;
    }
  }

  private static void requireBound(final int size) {
    if (size > LIMIT) {
      throw new BadRequestException("Ontology validation exceeds the 10000 reference limit");
    }
  }
}
