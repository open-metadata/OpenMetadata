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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.Objects;
import org.openmetadata.schema.api.data.InstallOntologyPack;
import org.openmetadata.schema.api.data.OntologyImportResult;
import org.openmetadata.schema.api.data.OntologyPackInstallResult;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.type.OntologyPackModule;
import org.openmetadata.service.monitoring.OntologyMetrics;
import org.openmetadata.service.rdf.GlossaryRdfImporter;

public final class OntologyPackInstaller {
  private final OntologyPackCatalog catalog;
  private final OntologyPackContentLoader contentLoader;
  private final ImporterFactory importerFactory;

  public OntologyPackInstaller(
      final OntologyPackCatalog catalog,
      final OntologyPackContentLoader contentLoader,
      final ImporterFactory importerFactory) {
    this.catalog = Objects.requireNonNull(catalog);
    this.contentLoader = Objects.requireNonNull(contentLoader);
    this.importerFactory = Objects.requireNonNull(importerFactory);
  }

  public static OntologyPackInstaller createDefault(final ClassLoader classLoader) {
    final OntologyPackCatalog catalog = new OntologyPackCatalog(classLoader);
    final OntologyPackContentLoader loader = new OntologyPackContentLoader(classLoader);
    return new OntologyPackInstaller(catalog, loader, OntologyPackInstaller::createImporter);
  }

  public OntologyPackCatalog catalog() {
    return catalog;
  }

  public OntologyPackInstallResult install(
      final String packId, final InstallOntologyPack request, final InstallationContext context) {
    final OntologyPackInstallResult result;
    try {
      result = installPack(packId, request, context);
      OntologyMetrics.recordPackImport(true);
    } catch (RuntimeException exception) {
      OntologyMetrics.recordPackImport(false);
      throw exception;
    }
    return result;
  }

  private OntologyPackInstallResult installPack(
      final String packId, final InstallOntologyPack request, final InstallationContext context) {
    final String targetGlossary = validatedTargetGlossary(request);
    final var selected = contentLoader.loadSelected(catalog, packId, request.getModuleIds());
    final OntologyImportResult importResult =
        importerFactory
            .create(context)
            .importRdf(
                selected.body(),
                selected.format(),
                targetGlossary,
                Boolean.TRUE.equals(request.getDryRun()));
    return result(selected.manifest(), selected.modules(), request, importResult);
  }

  public static String validatedTargetGlossary(final InstallOntologyPack request) {
    Objects.requireNonNull(request, "Ontology pack install request is required");
    final String target = request.getTargetGlossaryName();
    if (nullOrEmpty(target) || target.isBlank()) {
      throw new IllegalArgumentException("Target glossary name is required");
    }
    return target;
  }

  private static OntologyPackInstallResult result(
      final OntologyPackManifest manifest,
      final List<OntologyPackModule> modules,
      final InstallOntologyPack request,
      final OntologyImportResult importResult) {
    return new OntologyPackInstallResult()
        .withPackId(manifest.getId())
        .withVersion(manifest.getVersion())
        .withModuleIds(modules.stream().map(OntologyPackModule::getId).toList())
        .withTargetGlossaryName(request.getTargetGlossaryName())
        .withDryRun(Boolean.TRUE.equals(request.getDryRun()))
        .withConceptCount(sumConcepts(modules))
        .withRelationshipCount(sumRelationships(modules))
        .withImportResults(List.of(importResult));
  }

  private static int sumConcepts(final List<OntologyPackModule> modules) {
    return modules.stream().mapToInt(OntologyPackModule::getConceptCount).sum();
  }

  private static int sumRelationships(final List<OntologyPackModule> modules) {
    return modules.stream().mapToInt(OntologyPackModule::getRelationshipCount).sum();
  }

  private static OntologyPackImporter createImporter(final InstallationContext context) {
    final GlossaryRdfImporter importer =
        new GlossaryRdfImporter(
            context.uriInfo(), context.user(), context.canManageRelationshipTypes());
    return importer::importRdf;
  }

  public record InstallationContext(
      UriInfo uriInfo, String user, boolean canManageRelationshipTypes) {}

  @FunctionalInterface
  public interface ImporterFactory {
    OntologyPackImporter create(InstallationContext context);
  }

  @FunctionalInterface
  public interface OntologyPackImporter {
    OntologyImportResult importRdf(
        String rdf, String format, String targetGlossary, boolean dryRun);
  }
}
