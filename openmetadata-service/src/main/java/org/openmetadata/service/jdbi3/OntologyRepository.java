package org.openmetadata.service.jdbi3;

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.JsonPatch;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyReference;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.ontology.OntologyLayerValidator;
import org.openmetadata.service.ontology.OntologyPublicationStatusResolver;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FreshReadScope;

@Repository
public class OntologyRepository extends OntologyEntityRepository<Ontology> {
  public static final String COLLECTION_PATH = "/v1/ontologies/";

  private static final String PUBLICATION_STATUS = "publicationStatus";
  private final OntologyPublicationStatusResolver publication;

  public OntologyRepository() {
    super(
        Entity.ONTOLOGY,
        Ontology.class,
        Entity.getCollectionDAO().ontologyEntityDAO(),
        COLLECTION_PATH,
        "iri,namespace,layer,prefixes");
    fieldFetchers.put(PUBLICATION_STATUS, this::fetchPublicationStatus);
    publication = new OntologyPublicationStatusResolver(Entity.getCollectionDAO());
  }

  @Override
  public void setFields(
      final Ontology entity, final Fields fields, final RelationIncludes includes) {
    fetchPublicationStatus(List.of(entity), fields);
  }

  @Override
  public void clearFields(final Ontology entity, final Fields fields) {
    if (!fields.contains(PUBLICATION_STATUS)) {
      entity.setPublicationStatus(null);
    }
  }

  @Override
  protected void validatePatch(
      final Ontology original, final Ontology updated, final JsonPatch patch) {
    super.validatePatch(original, updated, patch);
    if (JsonUtils.extractPatchedFields(patch).contains(PUBLICATION_STATUS)) {
      throw new BadRequestException(
          "Ontology publicationStatus is derived by the server from ontology releases");
    }
  }

  @Override
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of(PUBLICATION_STATUS);
  }

  @Override
  protected String serializeForVersionHistory(final Ontology entity) {
    final ObjectNode node = (ObjectNode) JsonUtils.valueToTree(entity);
    node.remove(PUBLICATION_STATUS);
    return node.toString();
  }

  private void fetchPublicationStatus(final List<Ontology> ontologies, final Fields fields) {
    if (fields.contains(PUBLICATION_STATUS) && !ontologies.isEmpty()) {
      final var resolved = publication.resolve(ontologies);
      ontologies.forEach(ontology -> ontology.setPublicationStatus(resolved.get(ontology.getId())));
    }
  }

  @Override
  protected void validateDefinition(final Ontology entity) {
    entity.setPublicationStatus(null);
    requireAbsoluteIri(entity.getNamespace(), "namespace");
    OntologyLayerValidator.validatePrefixes(entity.getPrefixes());
  }

  @Override
  protected List<EntityRelationshipRecord> prepareChildrenForHardDeleteCascade(
      final UUID parentId, final List<EntityRelationshipRecord> children, final String updatedBy) {
    requireNoRetainedReleases(parentId);
    return children;
  }

  @Override
  protected List<EntityRelationshipObject> prepareChildrenForHardDeleteCascade(
      final List<Ontology> parents,
      final List<EntityRelationshipObject> children,
      final String updatedBy) {
    parents.forEach(parent -> requireNoRetainedReleases(parent.getId()));
    return children;
  }

  @Override
  protected void entitySpecificCleanup(final Ontology entity) {
    requireNoRetainedReleases(entity.getId());
  }

  private void requireNoRetainedReleases(final UUID id) {
    if (daoCollection.ontologyReleaseDAO().hasReleases(id)) {
      throw new BadRequestException(
          "Ontology "
              + id
              + " has retained releases; archive it instead of permanently deleting it");
    }
  }

  public <R> R applyWorkingChanges(
      final UUID id, final long expectedRevision, final Supplier<R> work) {
    return executeInTransaction(
        () -> {
          try (var ignored = FreshReadScope.enter()) {
            final OntologyStateDAO states = daoCollection.ontologyStateDAO();
            states.initialize(id);
            if (states.lock(id).getWorkingRevision() != expectedRevision) {
              throw new PreconditionFailedException(
                  "Ontology changed since this draft was created");
            }
            final Ontology root =
                JsonUtils.readValue(
                    dao.findJsonByIdForUpdate(id, Include.NON_DELETED), Ontology.class);
            return workingState.mutate(dao, List.of(root), work);
          }
        });
  }

  public OntologyState getState(final UUID id) {
    final OntologyState state = daoCollection.ontologyStateDAO().get(id);
    return state == null
        ? new OntologyState()
            .withOntologyId(id)
            .withWorkingRevision(0L)
            .withLastReleaseRevision(0L)
            .withActivationRevision(0L)
        : state;
  }

  public ResultList<OntologyReference> listReferences(
      final UUID id, final URI iri, final int limit, final String after) {
    return new OntologyReferenceIndex(daoCollection).list(id, iri, limit, after);
  }
}
