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

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.List;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.openmetadata.schema.type.OntologyPackModule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.NativeOntologyRdfImporter;
import org.openmetadata.service.rdf.RdfSerializationFormat;
import org.openmetadata.service.rdf.SafeRdfModelParser;

/** Loads checksum-verified bundled models and caches detached native documents. */
public final class OntologyPackModels implements OntologyPackInstallJobHandler.ModelSource {
  private static final long MAX_CACHED_DOCUMENT_BYTES = 64L * 1024 * 1024;
  // The minimum charge bounds key overhead and entry count for tiny documents and samples.
  private static final int MIN_CACHE_ENTRY_BYTES = 16 * 1024;

  private static final class Bundled {
    private static final OntologyPackModels INSTANCE =
        new OntologyPackModels(
            new OntologyPackContentLoader(OntologyPackModels.class.getClassLoader()));
  }

  private final OntologyPackContentLoader contentLoader;
  private final SafeRdfModelParser parser = new SafeRdfModelParser();
  private final Cache<SourceKey, byte[]> documents;

  public static OntologyPackModels bundled() {
    return Bundled.INSTANCE;
  }

  public OntologyPackModels(final OntologyPackContentLoader contentLoader) {
    this(contentLoader, MAX_CACHED_DOCUMENT_BYTES);
  }

  OntologyPackModels(final OntologyPackContentLoader contentLoader, final long cacheBytes) {
    this.contentLoader = contentLoader;
    documents =
        Caffeine.newBuilder()
            .maximumWeight(cacheBytes)
            .<SourceKey, byte[]>weigher((key, value) -> cacheWeight(value))
            .executor(Runnable::run)
            .build();
  }

  /** Cached bytes never share mutable definitions with the returned document. */
  public NativeOntologyDocument document(final OntologyPackContentLoader.Selection selected) {
    final byte[] cached = documents.get(key(selected), ignored -> readDocument(selected.modules()));
    return JsonUtils.readValue(
        new String(cached, StandardCharsets.UTF_8), NativeOntologyDocument.class);
  }

  OntologyPackContentLoader.Selection select(
      final OntologyPackCatalog catalog, final String packId, final Collection<String> moduleIds) {
    return contentLoader.select(catalog, packId, moduleIds);
  }

  private byte[] readDocument(final List<OntologyPackModule> modules) {
    final Model model = load(modules);
    try {
      return JsonUtils.pojoToJson(NativeOntologyRdfImporter.read(model))
          .getBytes(StandardCharsets.UTF_8);
    } finally {
      model.close();
    }
  }

  static SourceKey key(final OntologyPackContentLoader.Selection selected) {
    return new SourceKey(
        selected.manifest().getId(),
        selected.manifest().getVersion(),
        selected.modules().stream()
            .map(
                module ->
                    new ModuleKey(
                        module.getId(),
                        module.getResourcePath(),
                        module.getFormat().value(),
                        module.getSha256()))
            .toList());
  }

  static int cacheWeight(final byte[] value) {
    return Math.max(MIN_CACHE_ENTRY_BYTES, value.length);
  }

  @Override
  public Model load(final List<OntologyPackModule> modules) {
    final Model union = ModelFactory.createDefaultModel();
    try {
      for (final OntologyPackModule module : modules) {
        addModule(union, module);
      }
    } catch (RuntimeException exception) {
      union.close();
      throw exception;
    }
    return union;
  }

  private void addModule(final Model union, final OntologyPackModule module) {
    final String body = contentLoader.load(module.getResourcePath()).body();
    final Model parsed =
        parser.parseTrusted(
            body, RdfSerializationFormat.parse(module.getFormat().value()), module.getSha256());
    try {
      union.add(parsed);
    } finally {
      parsed.close();
    }
  }

  record SourceKey(String packId, String version, List<ModuleKey> modules) {
    SourceKey {
      modules = List.copyOf(modules);
    }
  }

  record ModuleKey(String id, String resourcePath, String format, String sha256) {}
}
