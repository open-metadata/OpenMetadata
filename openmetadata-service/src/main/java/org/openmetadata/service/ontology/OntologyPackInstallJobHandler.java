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

package org.openmetadata.service.ontology;

import java.sql.SQLException;
import java.sql.SQLTransactionRollbackException;
import java.time.Clock;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import java.util.function.UnaryOperator;
import org.apache.jena.rdf.model.Model;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.OntologyPackInstallJobArguments;
import org.openmetadata.schema.api.data.OntologyPackInstallPlan;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.OntologyPackModule;
import org.openmetadata.schema.type.OntologyPackSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.jdbi3.OntologyRepository;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.jobs.JobHandler;
import org.openmetadata.service.rdf.NativeOntologyRdfImporter;

/**
 * Installs a verified library pack into a native ontology: parse once, reconcile once, cut the
 * result into dependency-ordered slices, and apply each as its own change set. A failed or
 * cancelled job leaves the slices that landed; running the install again reconciles against them,
 * and the importer's identical-definition classification leaves them out of the new plan.
 */
public final class OntologyPackInstallJobHandler implements JobHandler {
  private static final int MAX_SLICE_ATTEMPTS = 3;

  private final OntologyPackCatalog catalog;
  private final ModelSource models;
  private final OntologyWorkingSnapshot snapshot;
  private final SliceApplier applier;
  private final OntologyPackInstallJobManager manager;
  private final int sliceMembers;

  public static OntologyPackInstallJobHandler createDefault() {
    return create(
        new OntologyPackModels(
            new OntologyPackContentLoader(OntologyPackCatalog.class.getClassLoader())),
        NativeOntologyRdfImporter.MAX_CHANGED_DEFINITIONS,
        applier -> applier);
  }

  /** The production wiring with the model source, slice size and slice applier chosen by the caller. */
  public static OntologyPackInstallJobHandler create(
      final ModelSource models,
      final int sliceMembers,
      final UnaryOperator<SliceApplier> applierWrapper) {
    return create(OntologyPackCatalog.bundled(), models, sliceMembers, applierWrapper);
  }

  /** As above, installing the packs of the given catalogue. */
  public static OntologyPackInstallJobHandler create(
      final OntologyPackCatalog catalog,
      final ModelSource models,
      final int sliceMembers,
      final UnaryOperator<SliceApplier> applierWrapper) {
    final OntologyChangeSetRepository changeSets =
        (OntologyChangeSetRepository) Entity.getEntityRepository(Entity.ONTOLOGY_CHANGE_SET);
    final OntologyRepository ontologies =
        (OntologyRepository) Entity.getEntityRepository(Entity.ONTOLOGY);
    final Clock clock = Clock.systemUTC();
    final OntologyChangeApplicationService applications =
        new OntologyChangeApplicationService(
            changeSets,
            (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM),
            clock);
    return new OntologyPackInstallJobHandler(
        catalog,
        models,
        OntologyWorkingSnapshot.production(),
        applierWrapper.apply(new OntologyPackSliceApplier(changeSets, applications, ontologies)),
        new OntologyPackInstallJobManager(Entity.getJobDAO(), clock),
        sliceMembers);
  }

  public OntologyPackInstallJobHandler(
      final OntologyPackCatalog catalog,
      final ModelSource models,
      final OntologyWorkingSnapshot snapshot,
      final SliceApplier applier,
      final OntologyPackInstallJobManager manager,
      final int sliceMembers) {
    this.catalog = catalog;
    this.models = models;
    this.snapshot = snapshot;
    this.applier = applier;
    this.manager = manager;
    this.sliceMembers = sliceMembers;
  }

  @Override
  public void runJob(final BackgroundJob job) throws BackgroundJobException {
    try {
      manager.markRunning(job.getId());
      manager.checkpoint(job.getId());
      install(job);
    } catch (OntologyPackInstallCancelledException exception) {
      manager.cancel(job.getId());
    } catch (RuntimeException exception) {
      final String message = failureMessage(exception);
      manager.fail(job.getId(), message);
      throw new BackgroundJobException(job.getId(), message, exception);
    }
  }

  @Override
  public boolean sendStatusToWebSocket() {
    return false;
  }

  private void install(final BackgroundJob job) {
    final OntologyPackInstallJobArguments arguments = manager.arguments(job);
    final Selection selection = verifiedSelection(arguments);
    final CreateOntologyChangeSet reconciled = reconcile(arguments, selection.modules());
    final OntologyPackSlicePlan plan =
        OntologyPackSlicePlan.of(
            reconciled.getOperations(), sliceMembers, arguments.getPackDigest());
    final Progress progress =
        new Progress(
            job.getId(), job.getCreatedBy(), arguments, selection.source(), reconciled, plan);
    manager.recordPlan(
        job.getId(), progress.ledger(0), "Planned %d slices.".formatted(plan.slices().size()));
    applySlices(progress);
    manager.complete(job.getId(), progress.ledger(plan.memberCount()));
  }

  private Selection verifiedSelection(final OntologyPackInstallJobArguments arguments) {
    final OntologyPackSource source =
        new OntologyPackSource()
            .withPackId(arguments.getPackId())
            .withVersion(arguments.getVersion())
            .withModuleIds(new LinkedHashSet<>(arguments.getModuleIds()));
    final List<OntologyPackModule> modules =
        OntologyPackInstallations.verifiedModules(catalog, source);
    final String digest = OntologyPackInstallations.packDigest(source, modules);
    if (!digest.equals(arguments.getPackDigest())) {
      throw new IllegalStateException(
          "Ontology pack '%s' changed after the install was queued"
              .formatted(arguments.getPackId()));
    }
    return new Selection(source, modules);
  }

  private CreateOntologyChangeSet reconcile(
      final OntologyPackInstallJobArguments arguments, final List<OntologyPackModule> modules) {
    final Model model = models.load(modules);
    try {
      return snapshot.readUnlocked(
          arguments.getOntologyId(),
          ignored -> {},
          working -> new NativeOntologyRdfImporter().reconcileUnbounded(model, working));
    } finally {
      model.close();
    }
  }

  private void applySlices(final Progress progress) {
    int membersApplied = 0;
    for (final OntologyPackSlicePlan.Slice slice : progress.plan().slices()) {
      manager.checkpoint(progress.jobId());
      applyOnce(progress.jobId(), progress.request(slice));
      membersApplied += slice.operations().size();
      manager.recordProgress(progress.jobId(), progress.ledger(membersApplied), slice.index() + 1);
    }
  }

  /**
   * A slice is one transaction, so a database that picks it as a deadlock victim has rolled it
   * back whole and running it again is safe. Concurrent writes to the reference index of other
   * ontologies can cause it.
   */
  private void applyOnce(final long jobId, final SliceRequest request) {
    for (int attempt = 1; ; attempt++) {
      try {
        applier.apply(request);
        return;
      } catch (RuntimeException exception) {
        if (attempt == MAX_SLICE_ATTEMPTS || !isRolledBackByDatabase(exception)) {
          throw exception;
        }
        manager.checkpoint(jobId);
      }
    }
  }

  private static boolean isRolledBackByDatabase(final Throwable failure) {
    for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
      if (cause instanceof SQLException sql
          && (sql instanceof SQLTransactionRollbackException
              || (sql.getSQLState() != null && sql.getSQLState().startsWith("40")))) {
        return true;
      }
    }
    return false;
  }

  private static String failureMessage(final RuntimeException exception) {
    final String message = exception.getMessage();
    return message == null || message.isBlank() ? "Library install failed" : message;
  }

  /** The verified modules of one selection, read into a single model. */
  @FunctionalInterface
  public interface ModelSource {
    Model load(List<OntologyPackModule> modules);
  }

  /** Applies one slice and returns only when it has landed, or throws. */
  @FunctionalInterface
  public interface SliceApplier {
    void apply(SliceRequest request);
  }

  public record SliceRequest(
      long jobId,
      UUID ontologyId,
      String ontologyFqn,
      OntologyPackSource source,
      OntologyPackSlicePlan.Slice slice,
      int count,
      String planDigest,
      String user) {}

  private record Selection(OntologyPackSource source, List<OntologyPackModule> modules) {}

  private record Progress(
      long jobId,
      String user,
      OntologyPackInstallJobArguments arguments,
      OntologyPackSource source,
      CreateOntologyChangeSet reconciled,
      OntologyPackSlicePlan plan) {
    OntologyPackInstallPlan ledger(final int membersApplied) {
      return new OntologyPackInstallPlan()
          .withPlanDigest(plan.planDigest())
          .withSliceDigests(plan.sliceDigests())
          .withMemberCount(plan.memberCount())
          .withMembersApplied(membersApplied);
    }

    SliceRequest request(final OntologyPackSlicePlan.Slice slice) {
      return new SliceRequest(
          jobId,
          arguments.getOntologyId(),
          reconciled.getOntology(),
          source,
          slice,
          plan.slices().size(),
          plan.planDigest(),
          user);
    }
  }
}
