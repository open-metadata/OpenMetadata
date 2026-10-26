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

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.UUID;

public final class OntologyIriMinter {
  private OntologyIriMinter() {}

  public static URI mint(final URI namespace, final UUID entityId) {
    requireAbsoluteBaseIri(namespace);
    return requireAbsoluteIri(join(namespace.toString(), entityId.toString()));
  }

  private static String join(final String baseIri, final String suffix) {
    final boolean hasSeparator =
        baseIri.endsWith("/") || baseIri.endsWith("#") || baseIri.endsWith(":");
    final String separator =
        hasSeparator || suffix.startsWith("/") || suffix.startsWith("#") ? "" : "/";
    return baseIri + separator + suffix;
  }

  private static void requireAbsoluteBaseIri(final URI baseIri) {
    if (baseIri == null || !baseIri.isAbsolute()) {
      throw new BadRequestException("Ontology base IRI must be absolute");
    }
  }

  private static URI requireAbsoluteIri(final String value) {
    final URI iri;
    try {
      iri = URI.create(value);
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException("Ontology namespace produced an invalid IRI", exception);
    }
    if (!iri.isAbsolute()) {
      throw new BadRequestException("Ontology namespace must produce an absolute IRI");
    }
    return iri;
  }
}
