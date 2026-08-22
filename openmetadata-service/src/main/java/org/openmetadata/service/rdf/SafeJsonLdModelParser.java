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
import com.apicatalog.jsonld.document.Document;
import com.apicatalog.jsonld.document.JsonDocument;
import com.apicatalog.jsonld.loader.DocumentLoader;
import com.apicatalog.jsonld.loader.DocumentLoaderOptions;
import com.apicatalog.rdf.nquads.NQuadsWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.io.StringWriter;
import java.net.URI;
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

  private String toNQuads(final JsonDocument document) throws JsonLdError {
    final StringWriter writer = new StringWriter();
    JsonLd.toRdf(document).loader(documentLoader).provide(new NQuadsWriter(writer));
    return writer.toString();
  }

  private static Model toModel(final String nQuads) {
    final Dataset dataset = DatasetFactory.createTxnMem();
    final Model model = ModelFactory.createDefaultModel();
    try {
      RDFParser.fromString(nQuads).lang(Lang.NQUADS).parse(dataset.asDatasetGraph());
      model.add(dataset.getDefaultModel());
      dataset.listNames().forEachRemaining(name -> model.add(dataset.getNamedModel(name)));
    } finally {
      dataset.close();
    }
    return model;
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
    return new JsonLdError(JsonLdErrorCode.LOADING_REMOTE_CONTEXT_FAILED, reason + ": " + uri);
  }
}
