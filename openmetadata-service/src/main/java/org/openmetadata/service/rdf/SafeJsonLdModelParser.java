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

package org.openmetadata.service.rdf;

import com.apicatalog.jsonld.JsonLd;
import com.apicatalog.jsonld.JsonLdError;
import com.apicatalog.jsonld.JsonLdErrorCode;
import com.apicatalog.jsonld.JsonLdOptions;
import com.apicatalog.jsonld.document.Document;
import com.apicatalog.jsonld.document.JsonDocument;
import com.apicatalog.jsonld.loader.DocumentLoader;
import com.apicatalog.jsonld.loader.DocumentLoaderOptions;
import com.apicatalog.rdf.nquads.NQuadsWriter;
import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.io.StringWriter;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.openmetadata.service.exception.BadRequestException;

public final class SafeJsonLdModelParser {
  private static final String CONTEXT_RESOURCE_ROOT = "/rdf/contexts/";
  private static final URI DOCUMENT_BASE =
      URI.create("https://open-metadata.org/rdf/contexts/import.jsonld");
  private static final Set<String> ALLOWED_CONTEXTS =
      Set.of(
          "ai.jsonld",
          "automation.jsonld",
          "base.jsonld",
          "dataAsset-complete.jsonld",
          "dataAsset.jsonld",
          "entityRelationship.jsonld",
          "governance.jsonld",
          "lineage.jsonld",
          "operations.jsonld",
          "quality.jsonld",
          "service.jsonld",
          "team.jsonld",
          "thread.jsonld");

  private final DocumentLoader documentLoader;

  public SafeJsonLdModelParser() {
    documentLoader = this::loadContext;
  }

  public Model parse(final String jsonLd) {
    try {
      final JsonDocument document = JsonDocument.of(new StringReader(jsonLd));
      document.setDocumentUrl(DOCUMENT_BASE);
      final String nQuads = toNQuads(document);
      return toModel(nQuads);
    } catch (JsonLdError exception) {
      throw new BadRequestException(
          "Failed to parse the JSON-LD ontology: " + exception.getMessage());
    }
  }

  private static void measure(
      final JsonValue value, final int depth, final long[] budget, final boolean context) {
    if (depth > 64 || ++budget[0] > 200_000) {
      throw new BadRequestException("JSON-LD exceeds its nesting or input budget");
    }
    requireExpansionBudget(budget);
    switch (value.getValueType()) {
      case OBJECT -> value
          .asJsonObject()
          .forEach(
              (key, child) -> {
                identifierBudget(key, budget);
                if (context) {
                  budget[2] += key.getBytes(StandardCharsets.UTF_8).length;
                  requireExpansionBudget(budget);
                  if ("@import".equals(key)) {
                    throw new BadRequestException("Native JSON-LD requires an inline context");
                  }
                }
                if ("@context".equals(key)
                    && (child.getValueType() == JsonValue.ValueType.STRING
                        || (child.getValueType() == JsonValue.ValueType.ARRAY
                            && child.asJsonArray().stream()
                                .anyMatch(
                                    item -> item.getValueType() == JsonValue.ValueType.STRING)))) {
                  throw new BadRequestException("Native JSON-LD requires an inline context");
                }
                measure(child, depth + 1, budget, context || "@context".equals(key));
                if (("@id".equals(key) || "@type".equals(key))
                    && child.getValueType() == JsonValue.ValueType.STRING) {
                  identifierBudget(((JsonString) child).getString(), budget);
                } else if ("@type".equals(key)
                    && child.getValueType() == JsonValue.ValueType.ARRAY) {
                  child
                      .asJsonArray()
                      .forEach(
                          type -> {
                            if (type.getValueType() == JsonValue.ValueType.STRING) {
                              identifierBudget(((JsonString) type).getString(), budget);
                            }
                          });
                }
              });
      case ARRAY -> value
          .asJsonArray()
          .forEach(child -> measure(child, depth + 1, budget, context));
      case STRING -> {
        if (context) {
          final String identifier = ((JsonString) value).getString();
          identifierBudget(identifier, budget);
          budget[2] += identifier.getBytes(StandardCharsets.UTF_8).length;
          requireExpansionBudget(budget);
        }
      }
      default -> {}
    }
  }

  private static void identifierBudget(final String identifier, final long[] budget) {
    final int bytes = identifier.getBytes(StandardCharsets.UTF_8).length;
    if (bytes > 2048) {
      throw new BadRequestException("JSON-LD identifier exceeds 2048 bytes");
    }
    budget[1] = Math.max(budget[1], bytes);
    requireExpansionBudget(budget);
  }

  private static void requireExpansionBudget(final long[] budget) {
    if (2L * budget[0] * (budget[1] + budget[2]) > 64L * 1024 * 1024) {
      throw new BadRequestException("JSON-LD could exceed its 64 MiB expansion budget");
    }
  }

  public Model parseStrict(final String jsonLd) {
    try {
      final JsonDocument document = JsonDocument.of(new StringReader(jsonLd));
      document.getJsonContent().ifPresent(raw -> measure(raw, 0, new long[] {0, 0, 0}, false));
      final JsonLdOptions options = new JsonLdOptions(documentLoader);
      options.setTimeout(Duration.ofSeconds(30));
      options.setUndefinedTermsPolicy(JsonLdOptions.ProcessingPolicy.Fail);
      final JsonArray expanded = JsonLd.expand(document).options(options).get();
      inspect(expanded, 0, new int[] {0, 0});
      final BoundedWriter writer = new BoundedWriter();
      final int[] statements = {0};
      final var nquads = new NQuadsWriter(writer);
      JsonLd.toRdf(JsonDocument.of(expanded))
          .options(options)
          .provide(
              (subject, predicate, object, datatype, language, direction, graph) -> {
                if (graph != null && !graph.isBlank()) {
                  throw new BadRequestException("Named RDF graphs are not supported");
                }
                if (++statements[0] > 100_000) {
                  throw new BadRequestException("Expanded JSON-LD exceeds 100000 statements");
                }
                return nquads.quad(
                    subject, predicate, object, datatype, language, direction, graph);
              });
      final Model model = toModel(writer.toString(), true);
      if (model.size() > 100_000) {
        model.close();
        throw new BadRequestException("Expanded JSON-LD exceeds 100000 triples");
      }
      return model;
    } catch (JsonLdError exception) {
      final String message = String.valueOf(exception.getMessage());
      throw new BadRequestException(
          "Failed to parse JSON-LD: " + message.substring(0, Math.min(200, message.length())));
    }
  }

  private static void inspect(final JsonValue value, final int depth, final int[] budget) {
    if (depth > 64 || ++budget[0] > 200_000) {
      throw new BadRequestException("JSON-LD exceeds its nesting or expansion budget");
    }
    switch (value.getValueType()) {
      case OBJECT -> {
        final JsonObject object = value.asJsonObject();
        if (object.containsKey("@direction")) {
          throw new BadRequestException("Native JSON-LD does not support @direction");
        }
        if (object.containsKey("@graph") && object.containsKey("@id")) {
          throw new BadRequestException("Named RDF graphs are not supported");
        }
        for (final var entry : object.entrySet()) {
          if (!entry.getKey().startsWith("@")) {
            requireAbsolute(entry.getKey());
          }
          if ("@id".equals(entry.getKey())) {
            requireAbsolute(object.getString("@id"));
          } else if ("@type".equals(entry.getKey())) {
            if (entry.getValue().getValueType() == JsonValue.ValueType.ARRAY) {
              entry
                  .getValue()
                  .asJsonArray()
                  .forEach(type -> requireAbsolute(((JsonString) type).getString()));
            } else {
              requireAbsolute(((JsonString) entry.getValue()).getString());
            }
          }
          inspect(entry.getValue(), depth + 1, budget);
        }
      }
      case ARRAY -> value.asJsonArray().forEach(child -> inspect(child, depth + 1, budget));
      case STRING -> {
        budget[1] += value.toString().getBytes(StandardCharsets.UTF_8).length;
        if (budget[1] > 64 * 1024 * 1024) {
          throw new BadRequestException("Expanded JSON-LD exceeds 64 MiB");
        }
      }
      default -> {}
    }
  }

  private static void requireAbsolute(final String value) {
    try {
      if (!value.startsWith("_:") && !URI.create(value).isAbsolute()) {
        throw new BadRequestException("JSON-LD contains a relative identifier");
      }
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException("JSON-LD contains an invalid identifier");
    }
  }

  private static final class BoundedWriter extends StringWriter {
    private long bytes;

    @Override
    public void write(final String text) {
      add(text.getBytes(StandardCharsets.UTF_8).length);
      super.write(text);
    }

    @Override
    public void write(final String text, final int offset, final int length) {
      add(text.substring(offset, offset + length).getBytes(StandardCharsets.UTF_8).length);
      super.write(text, offset, length);
    }

    @Override
    public void write(final int value) {
      add(String.valueOf((char) value).getBytes(StandardCharsets.UTF_8).length);
      super.write(value);
    }

    @Override
    public void write(final char[] chars, final int offset, final int length) {
      add(new String(chars, offset, length).getBytes(StandardCharsets.UTF_8).length);
      super.write(chars, offset, length);
    }

    private void add(final int count) {
      bytes += count;
      if (bytes > 64L * 1024 * 1024) {
        throw new BadRequestException("Expanded JSON-LD exceeds 64 MiB");
      }
    }
  }

  private String toNQuads(final JsonDocument document) throws JsonLdError {
    final StringWriter writer = new StringWriter();
    JsonLd.toRdf(document).loader(documentLoader).provide(new NQuadsWriter(writer));
    return writer.toString();
  }

  private static Model toModel(final String nQuads) {
    return toModel(nQuads, false);
  }

  private static Model toModel(final String nQuads, final boolean strict) {
    final Dataset dataset = DatasetFactory.createTxnMem();
    final Model model = ModelFactory.createDefaultModel();
    try {
      RDFParser.fromString(nQuads, Lang.NQUADS).parse(dataset.asDatasetGraph());
      if (strict && dataset.listNames().hasNext()) {
        throw new BadRequestException("Named RDF graphs are not supported");
      }
      model.add(dataset.getDefaultModel());
      if (!strict) {
        dataset.listNames().forEachRemaining(name -> model.add(dataset.getNamedModel(name)));
      }
      return model;
    } catch (RuntimeException exception) {
      model.close();
      throw exception;
    } finally {
      dataset.close();
    }
  }

  private Document loadContext(final URI uri, final DocumentLoaderOptions options)
      throws JsonLdError {
    final String contextName = contextName(uri);
    final InputStream stream =
        SafeJsonLdModelParser.class.getResourceAsStream(CONTEXT_RESOURCE_ROOT + contextName);
    if (stream == null) {
      throw loadingFailed(uri, "Classpath context was not found");
    }
    try (stream) {
      final JsonDocument document = JsonDocument.of(stream);
      document.setDocumentUrl(uri);
      return document;
    } catch (IOException exception) {
      throw new JsonLdError(
          JsonLdErrorCode.LOADING_DOCUMENT_FAILED,
          "Could not close classpath context '" + uri + "'",
          exception);
    }
  }

  private static String contextName(final URI uri) throws JsonLdError {
    final boolean isAllowedOrigin =
        "https".equals(uri.getScheme()) && "open-metadata.org".equals(uri.getHost());
    final String path = uri.getPath();
    final String contextName = path == null ? "" : path.substring(path.lastIndexOf('/') + 1);
    final boolean isAllowedPath = path != null && path.startsWith(CONTEXT_RESOURCE_ROOT);
    if (!isAllowedOrigin || !isAllowedPath || !ALLOWED_CONTEXTS.contains(contextName)) {
      throw loadingFailed(uri, "Only bundled OpenMetadata JSON-LD contexts are allowed");
    }
    return contextName;
  }

  private static JsonLdError loadingFailed(final URI uri, final String reason) {
    return new JsonLdError(JsonLdErrorCode.LOADING_REMOTE_CONTEXT_FAILED, reason);
  }
}
