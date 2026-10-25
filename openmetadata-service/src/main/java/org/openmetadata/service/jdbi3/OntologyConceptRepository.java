package org.openmetadata.service.jdbi3;

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.JsonPatch;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.BiConsumer;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyReferenceRole;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyClassHierarchy;
import org.openmetadata.service.ontology.OntologyDefinitionStatusResolver;
import org.openmetadata.service.ontology.OntologyReleaseManifest;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Repository
public class OntologyConceptRepository extends OntologyEntityRepository<OntologyConcept> {
  public static final String COLLECTION_PATH = "/v1/ontologyConcepts/";
  private static final String SUPER_CLASSES = "superClasses";
  private static final String SUB_CLASSES = "subClasses";
  private static final String LIFECYCLE_STATUS = "lifecycleStatus";
  private static final List<String> HIERARCHY_FIELDS = List.of(SUPER_CLASSES, SUB_CLASSES);
  private static final List<String> DERIVED_FIELDS =
      List.of(SUPER_CLASSES, SUB_CLASSES, LIFECYCLE_STATUS);

  private final OntologyDefinitionStatusResolver statuses;

  public OntologyConceptRepository() {
    super(
        Entity.ONTOLOGY_CONCEPT,
        OntologyConcept.class,
        Entity.getCollectionDAO().ontologyConceptDAO(),
        COLLECTION_PATH,
        "ontology,iri,conceptType,synonyms,conceptMappings,abstract,definitionSource,deprecated,replacedBy");
    fieldFetchers.put(SUPER_CLASSES, this::fetchSuperClasses);
    fieldFetchers.put(SUB_CLASSES, this::fetchSubClasses);
    fieldFetchers.put(LIFECYCLE_STATUS, this::fetchLifecycleStatus);
    statuses = new OntologyDefinitionStatusResolver(Entity.getCollectionDAO());
  }

  @Override
  protected void validateDefinition(final OntologyConcept entity) {
    if (entity.getConceptType() == null) {
      throw new BadRequestException("Ontology concept type is required");
    }
    if (entity.getDefinitionSource() != null) {
      requireAbsoluteIri(entity.getDefinitionSource(), "definitionSource");
    }
    if (entity.getReplacedBy() != null) {
      requireAbsoluteIri(entity.getReplacedBy(), "replacedBy");
    }
    entity.withSuperClasses(null).withSubClasses(null).withLifecycleStatus(null);
  }

  @Override
  public void setFields(
      final OntologyConcept entity, final Fields fields, final RelationIncludes includes) {
    if (fields.contains(SUPER_CLASSES)) {
      fetchSuperClasses(List.of(entity), fields);
    }
    if (fields.contains(SUB_CLASSES)) {
      fetchSubClasses(List.of(entity), fields);
    }
    if (fields.contains(LIFECYCLE_STATUS)) {
      fetchLifecycleStatus(List.of(entity), fields);
    }
  }

  @Override
  public void clearFields(final OntologyConcept entity, final Fields fields) {
    if (!fields.contains(SUPER_CLASSES)) {
      entity.setSuperClasses(null);
    }
    if (!fields.contains(SUB_CLASSES)) {
      entity.setSubClasses(null);
    }
    if (!fields.contains(LIFECYCLE_STATUS)) {
      entity.setLifecycleStatus(null);
    }
  }

  @Override
  protected void validatePatch(
      final OntologyConcept original, final OntologyConcept updated, final JsonPatch patch) {
    super.validatePatch(original, updated, patch);
    final Set<String> patchedFields = JsonUtils.extractPatchedFields(patch);
    if (patchedFields.stream().anyMatch(HIERARCHY_FIELDS::contains)) {
      throw new BadRequestException(
          "Concept superClasses and subClasses are derived from ontology axioms");
    }
    if (patchedFields.contains(LIFECYCLE_STATUS)) {
      throw new BadRequestException(
          "Concept lifecycleStatus is derived by the server from ontology releases");
    }
  }

  @Override
  protected List<String> getFieldsStrippedFromStorageJson() {
    return DERIVED_FIELDS;
  }

  @Override
  protected String serializeForVersionHistory(final OntologyConcept entity) {
    final ObjectNode node = (ObjectNode) JsonUtils.valueToTree(entity);
    node.remove(DERIVED_FIELDS);
    return node.toString();
  }

  private void fetchLifecycleStatus(final List<OntologyConcept> concepts, final Fields fields) {
    if (fields.contains(LIFECYCLE_STATUS) && !concepts.isEmpty()) {
      final var resolved = statuses.resolve(concepts, MemberKind.CONCEPT);
      concepts.forEach(concept -> concept.setLifecycleStatus(resolved.get(concept.getId())));
    }
  }

  private void fetchSuperClasses(final List<OntologyConcept> concepts, final Fields fields) {
    if (fields.contains(SUPER_CLASSES)) {
      fetchHierarchy(
          concepts, OntologyReferenceRole.AXIOM_SUBJECT, OntologyConcept::setSuperClasses);
    }
  }

  private void fetchSubClasses(final List<OntologyConcept> concepts, final Fields fields) {
    if (fields.contains(SUB_CLASSES)) {
      fetchHierarchy(concepts, OntologyReferenceRole.SUPER_CLASS, OntologyConcept::setSubClasses);
    }
  }

  private void fetchHierarchy(
      final List<OntologyConcept> concepts,
      final OntologyReferenceRole role,
      final BiConsumer<OntologyConcept, List<URI>> setter) {
    if (concepts.isEmpty()) {
      return;
    }
    final var json =
        daoCollection
            .ontologyReferenceDAO()
            .listHierarchyAxioms(
                concepts.stream()
                    .map(concept -> concept.getOntology().getId().toString())
                    .distinct()
                    .toList(),
                concepts.stream()
                    .map(concept -> DigestUtils.sha256Hex(concept.getIri().toString()))
                    .distinct()
                    .toList(),
                role.value(),
                OntologyReleaseManifest.MAX_MEMBERS + 1);
    if (json.size() > OntologyReleaseManifest.MAX_MEMBERS) {
      throw new BadRequestException("Concept hierarchy lookup exceeds the 10000 axiom limit");
    }
    final Map<ClassKey, Set<String>> edges = new HashMap<>();
    for (final String value : json) {
      final var axiom = JsonUtils.readValue(value, OntologyAxiom.class);
      for (final URI parent : OntologyClassHierarchy.namedParents(axiom)) {
        final String source =
            role == OntologyReferenceRole.AXIOM_SUBJECT
                ? axiom.getSubjectIri().toString()
                : parent.toString();
        final String target =
            role == OntologyReferenceRole.AXIOM_SUBJECT
                ? parent.toString()
                : axiom.getSubjectIri().toString();
        edges
            .computeIfAbsent(
                new ClassKey(axiom.getOntology().getId(), source), ignored -> new TreeSet<>())
            .add(target);
      }
    }
    concepts.forEach(
        concept ->
            setter.accept(
                concept,
                edges
                    .getOrDefault(
                        new ClassKey(concept.getOntology().getId(), concept.getIri().toString()),
                        Set.of())
                    .stream()
                    .map(URI::create)
                    .toList()));
  }

  private record ClassKey(UUID ontologyId, String iri) {}
}
