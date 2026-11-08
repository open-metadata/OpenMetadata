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

import java.util.List;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.openmetadata.schema.type.OntologyPackModule;
import org.openmetadata.service.rdf.RdfSerializationFormat;
import org.openmetadata.service.rdf.SafeRdfModelParser;

/** Reads each selected bundled module once, against its catalogue checksum, into one model. */
public final class OntologyPackModels implements OntologyPackInstallJobHandler.ModelSource {
  private final OntologyPackContentLoader contentLoader;
  private final SafeRdfModelParser parser = new SafeRdfModelParser();

  public OntologyPackModels(final OntologyPackContentLoader contentLoader) {
    this.contentLoader = contentLoader;
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
}
