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

import jakarta.ws.rs.core.UriInfo;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyPackInstallation;
import org.openmetadata.schema.type.OntologyPackModule;
import org.openmetadata.schema.type.OntologyPackModuleInstallation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;

public final class OntologyPackInstallationService {
  private final InstallationStore store;
  private final Clock clock;

  public OntologyPackInstallationService(final InstallationStore store, final Clock clock) {
    this.store = Objects.requireNonNull(store);
    this.clock = Objects.requireNonNull(clock);
  }

  public static OntologyPackInstallationService createDefault() {
    return new OntologyPackInstallationService(new EntityInstallationStore(), Clock.systemUTC());
  }

  public OntologyPackInstallation record(
      final OntologyPackManifest manifest,
      final List<OntologyPackModule> modules,
      final String targetGlossary,
      final OntologyPackInstaller.InstallationContext context) {
    final Glossary glossary = requireGlossary(targetGlossary);
    final OntologyPackInstallation installation = installation(manifest, modules, context.user());
    applyInstallation(glossary, installation);
    store.save(context.uriInfo(), glossary, context.user());
    return installation;
  }

  private Glossary requireGlossary(final String glossaryName) {
    final Glossary glossary = store.find(glossaryName);
    if (glossary == null) {
      throw new IllegalStateException(
          "Ontology pack target glossary '%s' was not created".formatted(glossaryName));
    }
    return glossary;
  }

  private OntologyPackInstallation installation(
      final OntologyPackManifest manifest,
      final List<OntologyPackModule> modules,
      final String user) {
    return new OntologyPackInstallation()
        .withPackId(manifest.getId())
        .withVersion(manifest.getVersion())
        .withModules(modules.stream().map(this::moduleInstallation).toList())
        .withInstalledAt(clock.millis())
        .withInstalledBy(user)
        .withSourceUrl(manifest.getSourceUrl())
        .withLicense(manifest.getLicense())
        .withLicenseUrl(manifest.getLicenseUrl());
  }

  private OntologyPackModuleInstallation moduleInstallation(final OntologyPackModule module) {
    return new OntologyPackModuleInstallation()
        .withModuleId(module.getId())
        .withSha256(module.getSha256());
  }

  private static void applyInstallation(
      final Glossary glossary, final OntologyPackInstallation installation) {
    final OntologyConfiguration configuration = configuration(glossary);
    configuration.setInstalledPacks(replace(configuration, installation));
    // An installed pack is an editable working copy: the immutable template is
    // the library pack manifest (tracked via installedPacks), so edits to this
    // glossary never mutate the source pack.
    configuration.setReadOnly(false);
    glossary.setOntologyConfiguration(configuration);
  }

  private static OntologyConfiguration configuration(final Glossary glossary) {
    return glossary.getOntologyConfiguration() == null
        ? new OntologyConfiguration()
        : glossary.getOntologyConfiguration();
  }

  private static List<OntologyPackInstallation> replace(
      final OntologyConfiguration configuration, final OntologyPackInstallation installation) {
    final List<OntologyPackInstallation> installations =
        new ArrayList<>(listOrEmpty(configuration.getInstalledPacks()));
    installations.removeIf(existing -> existing.getPackId().equals(installation.getPackId()));
    installations.add(installation);
    return List.copyOf(installations);
  }

  interface InstallationStore {
    Glossary find(String glossaryName);

    void save(UriInfo uriInfo, Glossary glossary, String user);
  }

  private static final class EntityInstallationStore implements InstallationStore {
    @Override
    public Glossary find(final String glossaryName) {
      return repository().findByNameOrNull(glossaryName, Include.NON_DELETED);
    }

    @Override
    public void save(final UriInfo uriInfo, final Glossary glossary, final String user) {
      repository().createOrUpdate(uriInfo, glossary, user);
    }

    private static GlossaryRepository repository() {
      return (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
    }
  }
}
