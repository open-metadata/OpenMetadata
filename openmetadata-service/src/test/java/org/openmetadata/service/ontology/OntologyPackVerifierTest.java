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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.type.OntologyPackModule;
import org.openmetadata.service.ontology.OntologyPackContentLoader.PackContent;

class OntologyPackVerifierTest {
  private static final String RESOURCE_PATH = "rdf/ontology-packs/fhir/core.ttl";
  private static final String HASH_A = "a".repeat(64);
  private static final String HASH_B = "b".repeat(64);
  private static final URI SOURCE_URL = URI.create("https://spec.example.org/ontology.ttl");

  private final OntologyPackContentLoader contentLoader = mock(OntologyPackContentLoader.class);
  private final OntologyPackVerifier verifier = new OntologyPackVerifier(contentLoader);

  @Test
  void verifyRejectsNullModules() {
    final OntologyPackManifest manifest = new OntologyPackManifest().withBundled(false);
    manifest.setModules(null);

    final IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> verifier.verify(manifest));

    assertTrue(exception.getMessage().contains("require at least one module"));
  }

  @Test
  void verifyRejectsEmptyModules() {
    final OntologyPackManifest manifest = manifest(false);

    final IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> verifier.verify(manifest));

    assertTrue(exception.getMessage().contains("require at least one module"));
  }

  @Test
  void verifyRejectsDuplicateModuleIds() {
    final OntologyPackManifest manifest =
        manifest(
            false, module("a").withSourceUrl(SOURCE_URL), module("a").withSourceUrl(SOURCE_URL));

    final IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> verifier.verify(manifest));

    assertTrue(exception.getMessage().contains("module IDs must be unique"));
  }

  @Test
  void verifyRejectsUnknownDependency() {
    final OntologyPackManifest manifest = manifest(false, module("a", "ghost"));

    final IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> verifier.verify(manifest));

    assertTrue(exception.getMessage().contains("unknown dependency"));
  }

  @Test
  void verifyRejectsMutualDependencyCycle() {
    final OntologyPackManifest manifest = manifest(false, module("a", "b"), module("b", "a"));

    final IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> verifier.verify(manifest));

    assertTrue(exception.getMessage().contains("dependencies contain a cycle at "));
  }

  @Test
  void verifyRejectsSelfDependencyCycle() {
    final OntologyPackManifest manifest = manifest(false, module("a", "a"));

    final IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> verifier.verify(manifest));

    assertTrue(exception.getMessage().contains("dependencies contain a cycle at a"));
  }

  @Test
  void verifyRejectsBundledModuleMissingResourcePath() {
    final OntologyPackModule module = module("a").withSha256(HASH_A);
    final OntologyPackManifest manifest = manifest(true, module);

    final IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> verifier.verify(manifest));

    assertTrue(exception.getMessage().contains("must declare a classpath resource and SHA-256"));
  }

  @Test
  void verifyRejectsBundledModuleMissingSha256() {
    final OntologyPackModule module = module("a").withResourcePath(RESOURCE_PATH);
    final OntologyPackManifest manifest = manifest(true, module);

    final IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> verifier.verify(manifest));

    assertTrue(exception.getMessage().contains("must declare a classpath resource and SHA-256"));
  }

  @Test
  void verifyRejectsBundledModuleWithChecksumMismatch() {
    final OntologyPackModule module =
        module("a").withResourcePath(RESOURCE_PATH).withSha256(HASH_A);
    final OntologyPackManifest manifest = manifest(true, module);
    when(contentLoader.load(RESOURCE_PATH)).thenReturn(new PackContent("body", HASH_B));

    final IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> verifier.verify(manifest));

    assertTrue(
        exception
            .getMessage()
            .contains("has checksum '%s', expected '%s'".formatted(HASH_B, HASH_A)));
  }

  @Test
  void verifyAcceptsBundledModuleWithMatchingChecksum() {
    final OntologyPackModule module =
        module("a").withResourcePath(RESOURCE_PATH).withSha256(HASH_A);
    final OntologyPackManifest manifest = manifest(true, module);
    when(contentLoader.load(RESOURCE_PATH)).thenReturn(new PackContent("body", HASH_A));

    verifier.verify(manifest);
  }

  @Test
  void verifyRejectsNonBundledModuleWithoutSourceUrl() {
    final OntologyPackManifest manifest = manifest(false, module("a"));

    final IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> verifier.verify(manifest));

    assertTrue(exception.getMessage().contains("must declare an authoritative source URL"));
  }

  @Test
  void verifyAcceptsNonBundledModuleWithSourceUrl() {
    final OntologyPackManifest manifest = manifest(false, module("a").withSourceUrl(SOURCE_URL));

    verifier.verify(manifest);
  }

  @Test
  void selectRejectsNullRequestedIds() {
    final OntologyPackManifest manifest = manifest(false, module("a"));

    final IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> verifier.select(manifest, null));

    assertTrue(exception.getMessage().contains("At least one ontology pack module is required"));
  }

  @Test
  void selectRejectsEmptyRequestedIds() {
    final OntologyPackManifest manifest = manifest(false, module("a"));

    final IllegalArgumentException exception =
        assertThrows(IllegalArgumentException.class, () -> verifier.select(manifest, List.of()));

    assertTrue(exception.getMessage().contains("At least one ontology pack module is required"));
  }

  @Test
  void selectRejectsUnknownRequestedId() {
    final OntologyPackManifest manifest = manifest(false, module("a"));

    final IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class, () -> verifier.select(manifest, List.of("ghost")));

    assertTrue(exception.getMessage().contains("Unknown ontology pack module: ghost"));
  }

  @Test
  void selectPullsTransitiveDependenciesOfRequestedModule() {
    final OntologyPackManifest manifest = manifest(false, module("a"), module("b", "a"));

    final List<OntologyPackModule> selected = verifier.select(manifest, List.of("b"));

    assertEquals(List.of("a", "b"), moduleIds(selected));
  }

  @Test
  void selectReturnsSharedDependencyOnlyOnceForDiamond() {
    final OntologyPackManifest manifest =
        manifest(false, module("a"), module("b", "a"), module("c", "a"), module("d", "b", "c"));

    final List<OntologyPackModule> selected = verifier.select(manifest, List.of("d"));

    assertEquals(List.of("a", "b", "c", "d"), moduleIds(selected));
  }

  @Test
  void selectReturnsResultsInManifestDeclarationOrder() {
    final OntologyPackManifest manifest = manifest(false, module("a"), module("b"), module("c"));

    final List<OntologyPackModule> selected = verifier.select(manifest, List.of("c", "a"));

    assertEquals(List.of("a", "c"), moduleIds(selected));
  }

  private static List<String> moduleIds(final List<OntologyPackModule> modules) {
    return modules.stream().map(OntologyPackModule::getId).toList();
  }

  private static OntologyPackModule module(final String id, final String... dependencies) {
    return new OntologyPackModule()
        .withId(id)
        .withDependencies(new LinkedHashSet<>(List.of(dependencies)));
  }

  private static OntologyPackManifest manifest(
      final boolean bundled, final OntologyPackModule... modules) {
    return new OntologyPackManifest()
        .withBundled(bundled)
        .withModules(new ArrayList<>(List.of(modules)));
  }
}
