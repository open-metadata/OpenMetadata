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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RiotException;

/** Loads and serializes the canonical OpenMetadata ontology documents. */
public final class OntologyDocument {

  private static final List<String> RESOURCES =
      List.of("/rdf/ontology/openmetadata.ttl", "/rdf/ontology/openmetadata-prov.ttl");

  private OntologyDocument() {}

  private static final class Holder {
    private static final Model MODEL = loadModel(RESOURCES);
  }

  public static SerializedOntology serialize(String requestedFormat) {
    RdfSerializationFormat format = RdfSerializationFormat.parse(requestedFormat);
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    RDFDataMgr.write(output, Holder.MODEL, format.rdfFormat());
    return new SerializedOntology(
        format.externalName(),
        output.toString(StandardCharsets.UTF_8),
        format.mediaType(),
        format.extension());
  }

  static Model loadModel(List<String> resourcePaths) {
    List<String> requiredResourcePaths =
        List.copyOf(Objects.requireNonNull(resourcePaths, "resourcePaths"));
    Model model = ModelFactory.createDefaultModel();
    try {
      requiredResourcePaths.forEach(resourcePath -> readInto(model, resourcePath));
      return model;
    } catch (IllegalStateException exception) {
      model.close();
      throw exception;
    }
  }

  private static void readInto(Model model, String resourcePath) {
    URL resource =
        Optional.ofNullable(OntologyDocument.class.getResource(resourcePath))
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "Required ontology resource is missing: " + resourcePath));
    try (InputStream input = resource.openStream()) {
      RDFDataMgr.read(model, input, Lang.TURTLE);
    } catch (IOException exception) {
      throw new IllegalStateException(
          "Unable to read ontology resource: " + resourcePath, exception);
    } catch (RiotException exception) {
      throw new IllegalStateException(
          "Unable to parse ontology resource: " + resourcePath, exception);
    }
  }

  public record SerializedOntology(
      String format, String body, String mediaType, String extension) {}
}
