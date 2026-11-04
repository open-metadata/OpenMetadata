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

package org.openmetadata.service.rdf.inference;

import org.openmetadata.service.rdf.RdfRepository;

/** The triplestore operations materialization needs; every rule runs inside the store. */
public interface InferenceGraphStore {
  /** Whether rules can be materialized: RDF is enabled on Fuseki with materialization switched on. */
  boolean isAvailable();

  void update(String sparqlUpdate);

  long tripleCount(String graphUri);

  static InferenceGraphStore forRepository(final RdfRepository rdfRepository) {
    return new InferenceGraphStore() {
      @Override
      public boolean isAvailable() {
        return rdfRepository.isEnabled()
            && RdfRepository.supportsMaterializedInference(rdfRepository.getConfig());
      }

      @Override
      public void update(final String sparqlUpdate) {
        rdfRepository.executeInferenceMaterializationUpdate(sparqlUpdate);
      }

      @Override
      public long tripleCount(final String graphUri) {
        return rdfRepository.getGraphTripleCount(graphUri);
      }
    };
  }
}
