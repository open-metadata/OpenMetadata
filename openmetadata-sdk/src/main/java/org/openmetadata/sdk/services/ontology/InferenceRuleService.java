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

package org.openmetadata.sdk.services.ontology;

import org.openmetadata.schema.api.configuration.rdf.InferenceMaterializationResult;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleList;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/** Typed SDK client for durable RDF inference rules and materialization. */
public final class InferenceRuleService {
  private static final String BASE_PATH = "/v1/rdf/rules";
  private final HttpClient httpClient;

  public InferenceRuleService(final HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public InferenceRuleList list() throws OpenMetadataException {
    return httpClient.execute(HttpMethod.GET, BASE_PATH, null, InferenceRuleList.class);
  }

  public InferenceRuleStatus get(final String name) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.GET, rulePath(name), null, InferenceRuleStatus.class);
  }

  public InferenceRuleStatus upsert(final String name, final InferenceRule rule)
      throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, rulePath(name), rule, InferenceRuleStatus.class);
  }

  public void delete(final String name) throws OpenMetadataException {
    httpClient.execute(HttpMethod.DELETE, rulePath(name), null, Void.class);
  }

  public InferenceMaterializationResult materialize(final boolean force, final String ruleName)
      throws OpenMetadataException {
    final RequestOptions.Builder options =
        RequestOptions.builder().queryParam("force", Boolean.toString(force));
    if (ruleName != null) {
      options.queryParam("ruleName", ruleName);
    }
    return httpClient.execute(
        HttpMethod.POST,
        BASE_PATH + "/materialize",
        null,
        InferenceMaterializationResult.class,
        options.build());
  }

  private static String rulePath(final String name) {
    return BASE_PATH + "/" + name;
  }
}
