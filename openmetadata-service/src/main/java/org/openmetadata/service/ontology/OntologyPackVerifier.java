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

import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.type.OntologyPackModule;

public final class OntologyPackVerifier {
  private final OntologyPackContentLoader contentLoader;

  public OntologyPackVerifier(final OntologyPackContentLoader contentLoader) {
    this.contentLoader = Objects.requireNonNull(contentLoader);
  }

  public void verify(final OntologyPackManifest manifest) {
    Objects.requireNonNull(manifest, "Ontology pack manifest is required");
    requireUniqueModules(manifest.getModules());
    requireKnownDependencies(manifest.getModules());
    requireAcyclicDependencies(manifest.getModules());
    for (final OntologyPackModule module : manifest.getModules()) {
      verifyModule(Boolean.TRUE.equals(manifest.getBundled()), module);
    }
  }

  public List<OntologyPackModule> select(
      final OntologyPackManifest manifest, final Collection<String> requestedIds) {
    requireSelection(requestedIds);
    final LinkedHashSet<String> selectedIds = new LinkedHashSet<>();
    for (final String requestedId : requestedIds) {
      includeWithDependencies(manifest.getModules(), requestedId, selectedIds);
    }
    return manifest.getModules().stream()
        .filter(module -> selectedIds.contains(module.getId()))
        .toList();
  }

  private void verifyModule(final boolean bundled, final OntologyPackModule module) {
    if (bundled) {
      verifyBundledModule(module);
    } else if (module.getSourceUrl() == null) {
      throw invalidModule(module, "must declare an authoritative source URL");
    }
  }

  private void verifyBundledModule(final OntologyPackModule module) {
    if (nullOrEmpty(module.getResourcePath()) || nullOrEmpty(module.getSha256())) {
      throw invalidModule(module, "must declare a classpath resource and SHA-256");
    }
    final String actualHash = contentLoader.load(module.getResourcePath()).sha256();
    if (!module.getSha256().equals(actualHash)) {
      throw invalidModule(
          module, "has checksum '%s', expected '%s'".formatted(actualHash, module.getSha256()));
    }
  }

  private static void requireUniqueModules(final List<OntologyPackModule> modules) {
    if (nullOrEmpty(modules)) {
      throw new IllegalArgumentException("Ontology packs require at least one module");
    }
    final Set<String> identifiers = new HashSet<>();
    if (modules.stream().anyMatch(module -> !identifiers.add(module.getId()))) {
      throw new IllegalArgumentException("Ontology pack module IDs must be unique");
    }
  }

  private static void requireKnownDependencies(final List<OntologyPackModule> modules) {
    final Set<String> identifiers =
        modules.stream().map(OntologyPackModule::getId).collect(Collectors.toSet());
    final boolean hasUnknown =
        modules.stream()
            .flatMap(module -> module.getDependencies().stream())
            .anyMatch(dependency -> !identifiers.contains(dependency));
    if (hasUnknown) {
      throw new IllegalArgumentException("Ontology pack modules contain an unknown dependency");
    }
  }

  private static void requireAcyclicDependencies(final List<OntologyPackModule> modules) {
    final Set<String> visited = new HashSet<>();
    for (final OntologyPackModule module : modules) {
      visit(modules, module.getId(), visited, new HashSet<>());
    }
  }

  private static void visit(
      final List<OntologyPackModule> modules,
      final String moduleId,
      final Set<String> visited,
      final Set<String> active) {
    if (!visited.contains(moduleId)) {
      requireNotActive(moduleId, active);
      requireModule(modules, moduleId)
          .getDependencies()
          .forEach(dependency -> visit(modules, dependency, visited, active));
      active.remove(moduleId);
      visited.add(moduleId);
    }
  }

  private static void requireNotActive(final String moduleId, final Set<String> active) {
    if (!active.add(moduleId)) {
      throw new IllegalArgumentException(
          "Ontology pack dependencies contain a cycle at " + moduleId);
    }
  }

  private static void requireSelection(final Collection<String> requestedIds) {
    if (nullOrEmpty(requestedIds)) {
      throw new IllegalArgumentException("At least one ontology pack module is required");
    }
  }

  private static void includeWithDependencies(
      final List<OntologyPackModule> modules,
      final String moduleId,
      final Set<String> selectedIds) {
    final OntologyPackModule module = requireModule(modules, moduleId);
    module
        .getDependencies()
        .forEach(dependency -> includeWithDependencies(modules, dependency, selectedIds));
    selectedIds.add(moduleId);
  }

  private static OntologyPackModule requireModule(
      final List<OntologyPackModule> modules, final String moduleId) {
    return modules.stream()
        .filter(module -> module.getId().equals(moduleId))
        .findFirst()
        .orElseThrow(
            () -> new IllegalArgumentException("Unknown ontology pack module: " + moduleId));
  }

  private static IllegalArgumentException invalidModule(
      final OntologyPackModule module, final String message) {
    return new IllegalArgumentException(
        "Ontology pack module '%s' %s".formatted(module.getId(), message));
  }
}
