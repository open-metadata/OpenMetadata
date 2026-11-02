package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.JsonPatch;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyApprovalRule;
import org.openmetadata.schema.type.OntologyPackInstallation;
import org.openmetadata.schema.type.OntologyReference;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.exception.TaskStateConflictException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.ontology.OntologyLayerValidator;
import org.openmetadata.service.ontology.OntologyPackInstallations;
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
        "iri,namespace,layer,prefixes,approvalRule");
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
    if (!Objects.equals(original.getInstalledPacks(), updated.getInstalledPacks())) {
      throw new BadRequestException(
          "installedPacks is recorded by the server when a library pack installs");
    }
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
  protected OntologyUpdater newUpdater(
      final Ontology original,
      final Ontology updated,
      final Operation operation,
      final ChangeSource source) {
    return new ReviewLockingUpdater(original, updated, operation, source);
  }

  /**
   * Releases inherit the ontology's reviewers and freeze its approval rule when a review starts, so
   * neither may change while a release is in review: a removed reviewer would fail every later
   * vote and a changed rule would move the threshold under an open task. Cancel the review and
   * resubmit it to change them. The check runs under the ontology state lock that starting,
   * deciding and cancelling a review also take.
   */
  private void requireNoOpenReview(final UUID ontologyId) {
    final List<String> versions =
        daoCollection
            .ontologyReleaseDAO()
            .listByStatus(ontologyId, EntityStatus.IN_REVIEW.value())
            .stream()
            .map(json -> JsonUtils.readValue(json, OntologyRelease.class))
            .map(
                release ->
                    release.getSemanticVersion() == null
                        ? release.getName()
                        : release.getSemanticVersion())
            .toList();
    if (versions.size() == 1) {
      throw TaskStateConflictException.of(
          "Reviewers and the approval rule are locked while release "
              + versions.getFirst()
              + " is in review");
    }
    if (!versions.isEmpty()) {
      throw TaskStateConflictException.of(
          "Reviewers and the approval rule are locked while releases "
              + String.join(", ", versions)
              + " are in review");
    }
  }

  private static Set<UUID> reviewerIds(final List<EntityReference> reviewers) {
    return listOrEmpty(reviewers).stream()
        .filter(reviewer -> !Boolean.TRUE.equals(reviewer.getInherited()))
        .map(EntityReference::getId)
        .collect(Collectors.toSet());
  }

  private static OntologyApprovalRule approvalRule(final Ontology ontology) {
    return ontology.getApprovalRule() == null
        ? OntologyApprovalRule.AnyReviewer
        : ontology.getApprovalRule();
  }

  private final class ReviewLockingUpdater extends OntologyUpdater {
    ReviewLockingUpdater(
        final Ontology original,
        final Ontology updated,
        final Operation operation,
        final ChangeSource source) {
      super(original, updated, operation, source);
    }

    @Override
    protected void updateReviewers() {
      if (!reviewerIds(original.getReviewers()).equals(reviewerIds(updated.getReviewers()))) {
        requireNoOpenReview(original.getId());
      }
      super.updateReviewers();
    }

    @Override
    protected void entitySpecificUpdate(final boolean consolidatingChanges) {
      updated.setInstalledPacks(original.getInstalledPacks());
      if (!Objects.equals(approvalRule(original), approvalRule(updated))) {
        requireNoOpenReview(original.getId());
      }
      super.entitySpecificUpdate(consolidatingChanges);
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

  public Ontology recordPackInstallation(
      final UUID id,
      final OntologyPackInstallation installation,
      final List<String> moduleOrder,
      final String user) {
    if (!FreshReadScope.isActive()) {
      throw new IllegalStateException("A library installation requires the ontology write scope");
    }
    final Ontology original =
        JsonUtils.readValue(dao.findJsonByIdForUpdate(id, Include.NON_DELETED), Ontology.class);
    final Ontology updated = JsonUtils.deepCopy(original, Ontology.class);
    updated.setInstalledPacks(
        OntologyPackInstallations.record(original.getInstalledPacks(), installation, moduleOrder));
    updated.setUpdatedBy(user);
    updated.setUpdatedAt(installation.getInstalledAt());
    new PackInstallationUpdater(original, updated).update();
    return updated;
  }

  public List<Ontology> listWithInstalledPacks(
      final int pageSize, final Function<List<Ontology>, List<Ontology>> filterPage) {
    if (pageSize <= 0) {
      throw new IllegalArgumentException("pageSize must be positive");
    }
    final List<Ontology> included = new ArrayList<>();
    String afterId = "";
    List<Ontology> page;
    do {
      page =
          daoCollection.ontologyEntityDAO().listJsonWithInstalledPacks(pageSize, afterId).stream()
              .map(json -> JsonUtils.readValue(json, Ontology.class))
              .toList();
      if (!page.isEmpty()) {
        included.addAll(filterPage.apply(page));
        afterId = page.getLast().getId().toString();
      }
    } while (page.size() == pageSize);
    return included;
  }

  private final class PackInstallationUpdater extends OntologyUpdater {
    private PackInstallationUpdater(final Ontology original, final Ontology updated) {
      super(original, updated, Operation.PUT, null);
    }

    @Override
    protected void entitySpecificUpdate(final boolean consolidatingChanges) {
      super.entitySpecificUpdate(consolidatingChanges);
      recordChange(
          "installedPacks", original.getInstalledPacks(), updated.getInstalledPacks(), true);
    }
  }

  public ResultList<OntologyReference> listReferences(
      final UUID id, final URI iri, final int limit, final String after) {
    return new OntologyReferenceIndex(daoCollection).list(id, iri, limit, after);
  }
}
