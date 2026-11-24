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

import java.net.URI;
import java.util.Set;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

/** Stable dataset identities, independent of the endpoint currently serving traffic. */
public record RdfDatasetNames(String base) {
  private static final String DEFAULT_DATASET = "openmetadata";
  private static final Set<String> ENDPOINTS = Set.of("sparql", "query", "update", "data", "get");

  public RdfDatasetNames {
    if (base == null || base.isBlank() || base.contains("/")) {
      throw new IllegalArgumentException("RDF dataset name must be a nonempty path segment");
    }
  }

  public static RdfDatasetNames from(final RdfConfiguration configuration) {
    final URI endpoint = configuration.getRemoteEndpoint();
    return new RdfDatasetNames(endpoint == null ? DEFAULT_DATASET : datasetName(endpoint));
  }

  private static String datasetName(final URI endpoint) {
    final String path = endpoint.getPath().replaceAll("/+$", "");
    final String last = path.substring(path.lastIndexOf('/') + 1);
    final String datasetPath =
        ENDPOINTS.contains(last) ? path.substring(0, path.lastIndexOf('/')) : path;
    final String name = datasetPath.substring(datasetPath.lastIndexOf('/') + 1);
    if (name.isBlank()) {
      throw new IllegalArgumentException("RDF endpoint must include a dataset name");
    }
    return name;
  }

  public String alternate(final String active) {
    return (base + "_a").equals(active) ? base + "_b" : base + "_a";
  }

  public void requireKnown(final String dataset) {
    if (dataset == null || !Set.of(base, base + "_a", base + "_b").contains(dataset)) {
      throw new IllegalArgumentException("Dataset is outside the configured RDF dataset family");
    }
  }
}
