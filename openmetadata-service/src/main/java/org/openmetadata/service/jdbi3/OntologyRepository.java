package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.net.URI;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyApprovalRule;
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
import org.openmetadata.service.util.FreshReadScope;

@Repository
public class OntologyRepository extends OntologyEntityRepository<Ontology> {
  public static final String COLLECTION_PATH = "/v1/ontologies/";

  public OntologyRepository() {
    super(
        Entity.ONTOLOGY,
        Ontology.class,
        Entity.getCollectionDAO().ontologyEntityDAO(),
        COLLECTION_PATH,
        "iri,namespace,layer,prefixes,approvalRule");
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
      if (!Objects.equals(approvalRule(original), approvalRule(updated))) {
        requireNoOpenReview(original.getId());
      }
      super.entitySpecificUpdate(consolidatingChanges);
    }
  }

  @Override
  protected void validateDefinition(final Ontology entity) {
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
