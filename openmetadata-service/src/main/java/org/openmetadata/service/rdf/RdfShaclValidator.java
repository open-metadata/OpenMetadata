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

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.Optional;
import org.apache.jena.graph.Graph;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RiotException;
import org.apache.jena.shacl.ShaclException;
import org.apache.jena.shacl.Shapes;
import org.apache.jena.shacl.ValidationReport;

/** Validates RDF models against the bundled OpenMetadata SHACL shapes. */
public final class RdfShaclValidator {

  private static final String SHAPES_RESOURCE = "/rdf/shapes/openmetadata-shapes.ttl";

  private RdfShaclValidator() {}

  private static final class Holder {
    private static final Shapes SHAPES = loadShapes(SHAPES_RESOURCE);
  }

  public static ValidationReport validate(Graph data) {
    return org.apache.jena.shacl.ShaclValidator.get().validate(Holder.SHAPES, data);
  }

  public static ValidationReport validate(Model data) {
    return validate(data.getGraph());
  }

  public static Shapes shapes() {
    return Holder.SHAPES;
  }

  static Shapes loadShapes(String resourcePath) {
    URL resource =
        Optional.ofNullable(RdfShaclValidator.class.getResource(resourcePath))
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "Required SHACL shapes resource is missing: " + resourcePath));
    Model shapesModel = ModelFactory.createDefaultModel();
    try (InputStream input = resource.openStream()) {
      RDFDataMgr.read(shapesModel, input, Lang.TURTLE);
      return Shapes.parse(shapesModel.getGraph());
    } catch (IOException | RiotException | ShaclException exception) {
      shapesModel.close();
      throw new IllegalStateException(
          "Unable to load SHACL shapes resource: " + resourcePath, exception);
    }
  }
}
