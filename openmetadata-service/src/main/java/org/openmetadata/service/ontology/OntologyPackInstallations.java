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

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyPackInstallation;
import org.openmetadata.schema.type.OntologyPackInstallationRecord;
import org.openmetadata.schema.type.OntologyPackModule;
import org.openmetadata.schema.type.OntologyPackModuleInstallation;
import org.openmetadata.schema.type.OntologyPackSource;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;

public final class OntologyPackInstallations {
  private OntologyPackInstallations() {}

  public static OntologyPackSource sourcePack(
      final OntologyPackContentLoader.SelectedPack selected) {
    return new OntologyPackSource()
        .withPackId(selected.manifest().getId())
        .withVersion(selected.manifest().getVersion())
        .withModuleIds(
            new LinkedHashSet<>(
                selected.modules().stream().map(OntologyPackModule::getId).toList()));
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

  public record PreparedPackInstall(
      UUID ontologyId, OntologyPackInstallation installation, List<String> moduleOrder) {}

  private record Match(OntologyPackManifest manifest, List<OntologyPackModule> modules) {}
}
