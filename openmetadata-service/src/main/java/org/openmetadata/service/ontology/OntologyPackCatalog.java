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

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.type.OntologyPackModule;
import org.openmetadata.schema.utils.JsonUtils;

public final class OntologyPackCatalog {
  private static final List<String> MANIFEST_PATHS =
      List.of(
          "json/data/ontology/packs/epcis.json",
          "json/data/ontology/packs/fhir.json",
          "json/data/ontology/packs/fibo.json",
          "json/data/ontology/packs/gs1.json",
          "json/data/ontology/packs/hr-open.json",
          "json/data/ontology/packs/isa-95.json");

  private final List<OntologyPackManifest> manifests;
  private final OntologyPackVerifier verifier;

  public OntologyPackCatalog(final ClassLoader classLoader) {
    final ClassLoader requiredClassLoader = Objects.requireNonNull(classLoader);
    verifier = new OntologyPackVerifier(new OntologyPackContentLoader(requiredClassLoader));
    manifests = load(requiredClassLoader);
    requireUniquePackIds(manifests);
    manifests.forEach(verifier::verify);
  }

  public List<OntologyPackManifest> list() {
    return manifests;
  }

  public OntologyPackManifest require(final String packId) {
    return manifests.stream()
        .filter(manifest -> manifest.getId().equals(packId))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Unknown ontology pack: " + packId));
  }

  public List<OntologyPackModule> select(
      final OntologyPackManifest manifest, final Collection<String> moduleIds) {
    return verifier.select(manifest, moduleIds);
  }

  private static List<OntologyPackManifest> load(final ClassLoader classLoader) {
    return MANIFEST_PATHS.stream().map(path -> loadManifest(classLoader, path)).toList();
  }

  private static OntologyPackManifest loadManifest(
      final ClassLoader classLoader, final String resourcePath) {
    try (InputStream input = requireResource(classLoader, resourcePath)) {
      final String json = new String(input.readAllBytes(), StandardCharsets.UTF_8);
      return JsonUtils.readValue(json, OntologyPackManifest.class);
    } catch (IOException exception) {
      throw new IllegalStateException(
          "Unable to load ontology pack manifest '%s'".formatted(resourcePath), exception);
    }
  }

  private static InputStream requireResource(
      final ClassLoader classLoader, final String resourcePath) {
    final InputStream input = classLoader.getResourceAsStream(resourcePath);
    if (input == null) {
      throw new IllegalStateException(
          "Required ontology pack manifest is missing: " + resourcePath);
    }
    return input;
  }

  private static void requireUniquePackIds(final List<OntologyPackManifest> manifests) {
    final Set<String> identifiers = new HashSet<>();
    if (manifests.stream().anyMatch(manifest -> !identifiers.add(manifest.getId()))) {
      throw new IllegalStateException("Ontology pack manifest IDs must be unique");
    }
  }
}
