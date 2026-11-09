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

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.type.OntologyPackModule;
import org.openmetadata.schema.utils.JsonUtils;

public final class OntologyPackCatalog {
  private static final class Bundled {
    private static final OntologyPackCatalog INSTANCE =
        new OntologyPackCatalog(OntologyPackCatalog.class.getClassLoader());
  }

  public static OntologyPackCatalog bundled() {
    return Bundled.INSTANCE;
  }

  private static final String PACKS_DIRECTORY = "json/data/ontology/packs/";
  private static final String INDEX_PATH = PACKS_DIRECTORY + "index.json";

  private final List<OntologyPackManifest> manifests;
  private final OntologyPackVerifier verifier;
  private final OntologyPackContentLoader contentLoader;

  public OntologyPackCatalog(final ClassLoader classLoader) {
    final ClassLoader requiredClassLoader = Objects.requireNonNull(classLoader);
    contentLoader = new OntologyPackContentLoader(requiredClassLoader);
    verifier = new OntologyPackVerifier(contentLoader);
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

  OntologyPackContentLoader.SelectedPack loadSelected(
      final String packId, final Collection<String> moduleIds) {
    return contentLoader.loadSelected(this, packId, moduleIds);
  }

  private static List<OntologyPackManifest> load(final ClassLoader classLoader) {
    return readIndex(classLoader).stream()
        .map(packId -> loadManifest(classLoader, packId))
        .toList();
  }

  private static List<String> readIndex(final ClassLoader classLoader) {
    try (InputStream input = requireResource(classLoader, INDEX_PATH)) {
      final JsonNode packs =
          JsonUtils.readTree(new String(input.readAllBytes(), StandardCharsets.UTF_8)).get("packs");
      if (packs == null || !packs.isArray() || packs.isEmpty()) {
        throw new IllegalStateException(
            "Ontology pack index '%s' lists no packs".formatted(INDEX_PATH));
      }
      final List<String> packIds = new ArrayList<>();
      packs.forEach(pack -> packIds.add(pack.asText()));
      return packIds;
    } catch (IOException exception) {
      throw new IllegalStateException(
          "Unable to load ontology pack index '%s'".formatted(INDEX_PATH), exception);
    }
  }

  private static OntologyPackManifest loadManifest(
      final ClassLoader classLoader, final String packId) {
    final String resourcePath = PACKS_DIRECTORY + packId + ".json";
    final String json;
    try (InputStream input = requireResource(classLoader, resourcePath)) {
      json = new String(input.readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException exception) {
      throw new IllegalStateException(
          "Unable to load ontology pack manifest '%s'".formatted(resourcePath), exception);
    }
    final OntologyPackManifest manifest;
    try {
      manifest = JsonUtils.readValue(json, OntologyPackManifest.class);
    } catch (RuntimeException exception) {
      throw new IllegalStateException(
          "Malformed ontology pack manifest '%s'".formatted(resourcePath), exception);
    }
    if (!packId.equals(manifest.getId())) {
      throw new IllegalStateException(
          "Ontology pack manifest '%s' declares id '%s'".formatted(resourcePath, manifest.getId()));
    }
    return manifest;
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
