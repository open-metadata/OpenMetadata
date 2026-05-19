/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.codegen;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Entry point for the index-mapping codegen, invoked from {@code openmetadata-spec}
 * during {@code generate-sources}. For every entity, language and engine it emits the
 * index mapping; it also emits one typed {@code *IndexDoc} class per entity. When a
 * committed mapping exists, the generated Elasticsearch mapping is diffed against it
 * and the build fails on any drift.
 */
public final class IndexCodegen {
  private static final List<String> ENGINES = List.of("elasticsearch", "opensearch");
  private static final List<String> LANGUAGES = List.of("en", "jp", "ru", "zh");
  private static final String DOC_PACKAGE_PATH = "org/openmetadata/schema/search";
  private static final String ELASTICSEARCH = "elasticsearch";
  private static final String MAPPING_SUFFIX = "_index_mapping.json";

  private IndexCodegen() {}

  public static void main(String[] args) {
    if (args.length < 3) {
      throw new IllegalArgumentException(
          "usage: IndexCodegen <specDir> <mappingOutDir> <docOutDir> [committedRootDir]");
    }
    Path committedRoot = args.length > 3 ? Path.of(args[3]) : null;
    generate(Path.of(args[0]), Path.of(args[1]), Path.of(args[2]), committedRoot);
  }

  /**
   * When {@code committedRoot} is given, each generated Elasticsearch mapping is diffed
   * against {@code committedRoot/<language>/<entity>_index_mapping.json}; the build fails
   * on any drift.
   */
  public static void generate(
      Path specDir, Path mappingOutDir, Path docOutDir, Path committedRoot) {
    Spec spec = new Spec(specDir);
    MappingGenerator mappingGenerator = new MappingGenerator(spec);
    IndexDocGenerator docGenerator = new IndexDocGenerator(spec);
    Map<String, EngineProfile> profiles = loadProfiles(spec);
    for (String entity : spec.entityNames()) {
      for (String language : LANGUAGES) {
        emitMappings(mappingGenerator, profiles, language, entity, mappingOutDir, committedRoot);
      }
      writeDocClass(entity, docGenerator.generate(entity), docOutDir);
    }
  }

  private static void emitMappings(
      MappingGenerator mappingGenerator,
      Map<String, EngineProfile> profiles,
      String language,
      String entity,
      Path mappingOutDir,
      Path committedRoot) {
    ObjectNode canonical = mappingGenerator.generate(language, entity);
    profiles.forEach(
        (engine, profile) -> {
          ObjectNode mapping = profile.apply(canonical);
          verifyParity(engine, language, entity, mapping, committedRoot);
          Path file =
              mappingOutDir.resolve(engine).resolve(language).resolve(entity + MAPPING_SUFFIX);
          Json.writeJson(file, mapping);
        });
  }

  private static Map<String, EngineProfile> loadProfiles(Spec spec) {
    Map<String, EngineProfile> profiles = new LinkedHashMap<>();
    for (String engine : ENGINES) {
      profiles.put(engine, new EngineProfile(spec.engine(engine)));
    }
    return profiles;
  }

  private static void verifyParity(
      String engine, String language, String entity, ObjectNode mapping, Path committedRoot) {
    if (!ELASTICSEARCH.equals(engine) || committedRoot == null) {
      return;
    }
    Path committed = committedRoot.resolve(language).resolve(entity + MAPPING_SUFFIX);
    if (!Files.exists(committed)) {
      return;
    }
    List<String> drift = Json.diff(Json.loadFile(committed), mapping);
    if (!drift.isEmpty()) {
      throw new IllegalStateException(
          "Generated mapping for '"
              + entity
              + "/"
              + language
              + "' drifted from committed: "
              + drift);
    }
  }

  private static void writeDocClass(String entity, String source, Path docOutDir) {
    Path file =
        docOutDir.resolve(DOC_PACKAGE_PATH).resolve(IndexDocGenerator.className(entity) + ".java");
    Json.writeText(file, source);
  }
}
