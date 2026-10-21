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
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collection;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.type.OntologyPackModule;

public final class OntologyPackContentLoader {
  private static final String SHA_256 = "SHA-256";
  private final ClassLoader classLoader;

  public OntologyPackContentLoader(final ClassLoader classLoader) {
    this.classLoader = Objects.requireNonNull(classLoader);
  }

  public PackContent load(final String resourcePath) {
    final byte[] bytes = read(resourcePath);
    return new PackContent(new String(bytes, StandardCharsets.UTF_8), sha256(bytes));
  }

  public SelectedPack loadSelected(
      final OntologyPackCatalog catalog, final String packId, final Collection<String> moduleIds) {
    final OntologyPackManifest manifest = catalog.require(packId);
    if (!Boolean.TRUE.equals(manifest.getBundled())) {
      throw new IllegalArgumentException(
          "Ontology pack '%s' requires an independently licensed payload".formatted(packId));
    }
    final List<OntologyPackModule> modules = catalog.select(manifest, moduleIds);
    final String format = requireSingleFormat(modules);
    final String body =
        modules.stream()
            .map(OntologyPackModule::getResourcePath)
            .map(this::load)
            .map(PackContent::body)
            .collect(Collectors.joining(System.lineSeparator()));
    return new SelectedPack(manifest, modules, format, body);
  }

  private static String requireSingleFormat(final List<OntologyPackModule> modules) {
    final List<String> formats =
        modules.stream().map(module -> module.getFormat().value()).distinct().toList();
    if (formats.size() != 1) {
      throw new IllegalArgumentException("Selected ontology pack modules must use one RDF format");
    }
    return formats.getFirst();
  }

  private byte[] read(final String resourcePath) {
    try (InputStream input = requireResource(resourcePath)) {
      return input.readAllBytes();
    } catch (IOException exception) {
      throw new IllegalStateException(
          "Unable to read ontology pack resource '%s'".formatted(resourcePath), exception);
    }
  }

  private InputStream requireResource(final String resourcePath) {
    final InputStream input = classLoader.getResourceAsStream(Objects.requireNonNull(resourcePath));
    if (input == null) {
      throw new IllegalStateException(
          "Required ontology pack resource is missing: " + resourcePath);
    }
    return input;
  }

  private static String sha256(final byte[] bytes) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance(SHA_256).digest(bytes));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("JVM does not provide SHA-256", exception);
    }
  }

  public record PackContent(String body, String sha256) {}

  public record SelectedPack(
      OntologyPackManifest manifest,
      List<OntologyPackModule> modules,
      String format,
      String body) {}
}
