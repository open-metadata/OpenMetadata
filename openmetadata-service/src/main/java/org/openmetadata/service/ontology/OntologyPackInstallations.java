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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.api.data.OntologyPackInstallPlan;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyPackInstallation;
import org.openmetadata.schema.type.OntologyPackInstallationRecord;
import org.openmetadata.schema.type.OntologyPackModule;
import org.openmetadata.schema.type.OntologyPackModuleInstallation;
import org.openmetadata.schema.type.OntologyPackSlice;
import org.openmetadata.schema.type.OntologyPackSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.rdf.NativeOntologyRdfImporter;
import org.openmetadata.service.rdf.RdfSerializationFormat;

public final class OntologyPackInstallations {
  private OntologyPackInstallations() {}

  public static OntologyPackSource sourcePack(
      final OntologyPackContentLoader.SelectedPack selected) {
    return sourcePack(selected.manifest(), selected.modules());
  }

  public static OntologyPackSource sourcePack(
      final OntologyPackManifest manifest, final List<OntologyPackModule> modules) {
    return new OntologyPackSource()
        .withPackId(manifest.getId())
        .withVersion(manifest.getVersion())
        .withModuleIds(
            new LinkedHashSet<>(modules.stream().map(OntologyPackModule::getId).toList()));
  }

  /** One digest over the verified selection, so a queued job refuses to run on changed content. */
  public static String packDigest(
      final OntologyPackSource source, final List<OntologyPackModule> modules) {
    final String checksums =
        modules.stream()
            .map(module -> module.getId() + ":" + module.getSha256())
            .collect(Collectors.joining(","));
    return DigestUtils.sha256Hex(
        source.getPackId() + "\n" + source.getVersion() + "\n" + checksums);
  }

  /** The catalogue modules a source names, or an exception when the catalogue no longer serves it. */
  static List<OntologyPackModule> verifiedModules(
      final OntologyPackCatalog catalog, final OntologyPackSource source) {
    return match(catalog, source).modules();
  }

  public static void requireCurrent(
      final OntologyPackCatalog catalog, final OntologyChangeSet changeSet) {
    if (changeSet.getSourcePack() != null) {
      requireNative(changeSet);
      try {
        match(catalog, changeSet.getSourcePack());
      } catch (IllegalArgumentException exception) {
        throw new BadRequestException(exception.getMessage());
      }
    }
  }

  public static PreparedPackInstall prepare(
      final OntologyPackCatalog catalog,
      final OntologyWorkingSnapshot.Snapshot working,
      final OntologyChangeSet changeSet,
      final String user,
      final long now) {
    if (changeSet.getSourcePack() == null) {
      return null;
    }
    final Match match;
    try {
      requireNative(changeSet);
      match = match(catalog, changeSet.getSourcePack());
    } catch (IllegalArgumentException | BadRequestException exception) {
      throw new PreconditionFailedException(exception.getMessage());
    }
    requireMatchingPlan(catalog, working, changeSet);
    return prepared(changeSet, match, user, now);
  }

  /**
   * A slice of a library install job. Its operations must be the ones the job planned, so the
   * check reads the job's recorded digest instead of parsing the pack again, and it costs the same
   * for every slice. Only the last slice records the installation, so a half-applied pack never
   * shows as installed.
   */
  public static PreparedPackInstall prepareSlice(
      final OntologyPackCatalog catalog,
      final PlanLedger ledger,
      final OntologyChangeSet changeSet,
      final String user,
      final long now) {
    final Match match;
    try {
      requireNative(changeSet);
      match = match(catalog, changeSet.getSourcePack());
    } catch (IllegalArgumentException | BadRequestException exception) {
      throw new PreconditionFailedException(exception.getMessage());
    }
    final OntologyPackSlice slice = changeSet.getSourcePack().getSlice();
    requireCompleteActivePlan(changeSet);
    requireRecordedSlice(ledger, changeSet, slice);
    final boolean isLast = slice.getIndex() == slice.getCount() - 1;
    return isLast ? prepared(changeSet, match, user, now) : null;
  }

  private static void requireRecordedSlice(
      final PlanLedger ledger, final OntologyChangeSet changeSet, final OntologyPackSlice slice) {
    final OntologyPackInstallPlan recorded =
        ledger.find(slice.getJobId(), changeSet.getOntology().getId());
    final boolean isRecorded =
        recorded != null
            && recorded.getPlanDigest().equals(slice.getPlanDigest())
            && recorded.getSliceDigests().size() == slice.getCount()
            && slice.getIndex() < slice.getCount()
            && recorded
                .getSliceDigests()
                .get(slice.getIndex())
                .equals(OntologyPackSlicePlan.sliceDigest(changeSet.getOperations()));
    if (!isRecorded) {
      throw new PreconditionFailedException(
          "Library slice operations differ from the install job's plan");
    }
  }

  private static PreparedPackInstall prepared(
      final OntologyChangeSet changeSet, final Match match, final String user, final long now) {
    final OntologyPackManifest manifest = match.manifest();
    final OntologyPackInstallation installation =
        new OntologyPackInstallation()
            .withPackId(manifest.getId())
            .withVersion(manifest.getVersion())
            .withModules(
                match.modules().stream()
                    .map(
                        module ->
                            new OntologyPackModuleInstallation()
                                .withModuleId(module.getId())
                                .withSha256(module.getSha256()))
                    .toList())
            .withInstalledAt(now)
            .withInstalledBy(user)
            .withSourceUrl(manifest.getSourceUrl())
            .withLicense(manifest.getLicense())
            .withLicenseUrl(manifest.getLicenseUrl());
    return new PreparedPackInstall(
        changeSet.getOntology().getId(),
        installation,
        manifest.getModules().stream().map(OntologyPackModule::getId).toList());
  }

  private static void requireMatchingPlan(
      final OntologyPackCatalog catalog,
      final OntologyWorkingSnapshot.Snapshot working,
      final OntologyChangeSet changeSet) {
    requireCompleteActivePlan(changeSet);
    final List<OntologyChangeOperation> operations = changeSet.getOperations();
    if (!Objects.equals(working.root().getId(), changeSet.getOntology().getId())
        || !Objects.equals(
            working.state().getWorkingRevision(), changeSet.getBaseWorkingRevision())) {
      throw new PreconditionFailedException(
          "Ontology changed since this library draft was created");
    }
    final var source = changeSet.getSourcePack();
    final var selected = catalog.loadSelected(source.getPackId(), source.getModuleIds());
    final var importer = new NativeOntologyRdfImporter();
    final var model =
        importer.parse(selected.body(), RdfSerializationFormat.parse(selected.format()));
    try {
      final var expected = importer.reconcile(model, working).getOperations();
      requireMatchingOperations(expected, operations);
    } finally {
      model.close();
    }
  }

  private static void requireCompleteActivePlan(final OntologyChangeSet changeSet) {
    final List<OntologyChangeOperation> operations = listOrEmpty(changeSet.getOperations());
    if (operations.isEmpty() || !Objects.equals(changeSet.getUndoCursor(), operations.size())) {
      throw new PreconditionFailedException(
          "A library installation requires its complete active plan");
    }
  }

  static void requireMatchingOperations(
      final List<OntologyChangeOperation> expected,
      final List<OntologyChangeOperation> operations) {
    if (!normalizedPlan(expected).equals(normalizedPlan(operations))) {
      throw new PreconditionFailedException(
          "Library draft operations differ from the bundled import plan");
    }
  }

  private static Map<JsonNode, Long> normalizedPlan(
      final List<OntologyChangeOperation> operations) {
    return operations.stream()
        .map(OntologyPackInstallations::normalizedOperation)
        .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
  }

  static JsonNode normalizedOperation(final OntologyChangeOperation operation) {
    final var copy = JsonUtils.deepCopy(operation, OntologyChangeOperation.class);
    copy.setId(null);
    if (copy.getTargetId() == null && NativeOntologyChanges.definition(copy) != null) {
      NativeOntologyChanges.definition(copy).setId(null);
    }
    final JsonNode tree = JsonUtils.getObjectMapper().valueToTree(copy);
    dropEmptyOwners(tree);
    return tree;
  }

  private static void dropEmptyOwners(final JsonNode node) {
    if (node instanceof ObjectNode object) {
      final JsonNode owners = object.get("owners");
      if (owners != null && owners.isArray() && owners.isEmpty()) {
        object.remove("owners");
      }
    }
    node.forEach(OntologyPackInstallations::dropEmptyOwners);
  }

  public static List<OntologyPackInstallation> record(
      final List<OntologyPackInstallation> existing,
      final OntologyPackInstallation next,
      final List<String> moduleOrder) {
    final List<OntologyPackInstallation> result = new ArrayList<>();
    boolean replaced = false;
    for (final OntologyPackInstallation current : listOrEmpty(existing)) {
      if (current.getPackId().equals(next.getPackId())) {
        result.add(
            current.getVersion().equals(next.getVersion())
                ? merge(current, next, moduleOrder)
                : next);
        replaced = true;
      } else {
        result.add(current);
      }
    }
    if (!replaced) {
      result.add(next);
    }
    return List.copyOf(result);
  }

  private static OntologyPackInstallation merge(
      final OntologyPackInstallation current,
      final OntologyPackInstallation next,
      final List<String> moduleOrder) {
    final Map<String, OntologyPackModuleInstallation> modules =
        java.util.stream.Stream.concat(current.getModules().stream(), next.getModules().stream())
            .collect(
                Collectors.toMap(
                    OntologyPackModuleInstallation::getModuleId,
                    Function.identity(),
                    (oldModule, newModule) -> newModule));
    return new OntologyPackInstallation()
        .withPackId(next.getPackId())
        .withVersion(next.getVersion())
        .withModules(moduleOrder.stream().map(modules::get).filter(Objects::nonNull).toList())
        .withInstalledAt(next.getInstalledAt())
        .withInstalledBy(next.getInstalledBy())
        .withSourceUrl(next.getSourceUrl())
        .withLicense(next.getLicense())
        .withLicenseUrl(next.getLicenseUrl());
  }

  public static List<OntologyPackInstallationRecord> records(final List<Ontology> ontologies) {
    return ontologies.stream()
        .flatMap(
            ontology ->
                listOrEmpty(ontology.getInstalledPacks()).stream()
                    .map(
                        installation ->
                            new OntologyPackInstallationRecord()
                                .withOntology(ontology.getEntityReference())
                                .withInstallation(installation)))
        .sorted(
            Comparator.comparing(
                    (OntologyPackInstallationRecord record) -> record.getInstallation().getPackId())
                .thenComparing(record -> record.getOntology().getFullyQualifiedName()))
        .toList();
  }

  private static Match match(final OntologyPackCatalog catalog, final OntologyPackSource source) {
    final OntologyPackManifest manifest = catalog.require(source.getPackId());
    if (!Boolean.TRUE.equals(manifest.getBundled())) {
      throw new IllegalArgumentException("Ontology pack is not bundled: " + source.getPackId());
    }
    if (!manifest.getVersion().equals(source.getVersion())) {
      throw new IllegalArgumentException("Ontology pack version changed: " + source.getPackId());
    }
    final List<OntologyPackModule> modules = catalog.select(manifest, source.getModuleIds());
    if (!modules.stream()
        .map(OntologyPackModule::getId)
        .toList()
        .equals(new ArrayList<>(source.getModuleIds()))) {
      throw new IllegalArgumentException(
          "Ontology pack modules are not dependency-expanded in catalogue order");
    }
    return new Match(manifest, modules);
  }

  private static void requireNative(final OntologyChangeSet changeSet) {
    if (changeSet.getOntology() == null) {
      throw new BadRequestException("Library pack source requires a native ontology");
    }
  }

  /** The plan a library install job recorded, by job id, or null when the job has none. */
  @FunctionalInterface
  public interface PlanLedger {
    OntologyPackInstallPlan find(long jobId, UUID ontologyId);
  }

  public record PreparedPackInstall(
      UUID ontologyId, OntologyPackInstallation installation, List<String> moduleOrder) {}

  private record Match(OntologyPackManifest manifest, List<OntologyPackModule> modules) {}
}
