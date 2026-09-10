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
package org.openmetadata.service.rdf.translator;

import org.apache.jena.rdf.model.ModelFactory;

/**
 * Entry point for a JVM whose very first Jena interaction is our translator, mirroring server
 * startup where {@code RdfResource.initialize} builds a {@link JsonLdTranslator} before anything
 * else has touched Jena. Run as a subprocess by {@link RdfJenaBootstrapTest}; a shared test JVM
 * cannot express "first touch" because earlier tests have already initialized Jena.
 */
public final class JenaFirstTouchProbe {

  private JenaFirstTouchProbe() {}

  public static void main(String[] args) {
    if (RdfPropertyMapper.TRANSLATOR_MANAGED_DIRECT_PREDICATES.isEmpty()) {
      throw new IllegalStateException("Translator-managed predicates must not be empty");
    }
    // Proves the shared Jena subsystem is usable afterwards, not just that the constants loaded.
    ModelFactory.createDefaultModel().close();
  }
}
