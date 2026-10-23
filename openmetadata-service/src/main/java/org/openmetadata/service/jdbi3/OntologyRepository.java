package org.openmetadata.service.jdbi3;

import jakarta.json.JsonPatch;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyPackInstallation;
import org.openmetadata.schema.type.OntologyReference;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.ontology.OntologyLayerValidator;
import org.openmetadata.service.ontology.OntologyPackInstallations;
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
        "iri,namespace,layer,prefixes");
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
      final int pageSize, final Predicate<Ontology> include) {
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
      for (final Ontology ontology : page) {
        if (include.test(ontology)) {
          included.add(ontology);
        }
      }
      if (!page.isEmpty()) {
        afterId = page.getLast().getId().toString();
      }
    } while (page.size() == pageSize);
    return included;
  }

  @Override
  protected void validatePatch(
      final Ontology original, final Ontology updated, final JsonPatch patch) {
    super.validatePatch(original, updated, patch);
    if (!Objects.equals(original.getInstalledPacks(), updated.getInstalledPacks())) {
      throw new BadRequestException(
          "installedPacks is recorded by the server when a library pack installs");
    }
  }

  @Override
  protected OntologyUpdater newUpdater(
      final Ontology original,
      final Ontology updated,
      final Operation operation,
      final ChangeSource source) {
    return new OntologyRootUpdater(original, updated, operation, source);
  }

  private final class OntologyRootUpdater extends OntologyUpdater {
    private OntologyRootUpdater(
        final Ontology original,
        final Ontology updated,
        final Operation operation,
        final ChangeSource source) {
      super(original, updated, operation, source);
    }

    @Override
    protected void entitySpecificUpdate(final boolean consolidatingChanges) {
      updated.setInstalledPacks(original.getInstalledPacks());
      super.entitySpecificUpdate(consolidatingChanges);
    }
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
