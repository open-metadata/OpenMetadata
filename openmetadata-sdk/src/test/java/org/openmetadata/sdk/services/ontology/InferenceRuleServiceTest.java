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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.configuration.rdf.InferenceMaterializationResult;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

class InferenceRuleServiceTest {
  @Test
  void routesTypedRuleAndMaterializationRequests() {
    final HttpClient httpClient = mock(HttpClient.class);
    final InferenceRuleService service = new InferenceRuleService(httpClient);
    final InferenceRule rule = new InferenceRule().withName("custom-rule");
    final InferenceRuleStatus status = new InferenceRuleStatus();
    final InferenceMaterializationResult result = new InferenceMaterializationResult();
    when(httpClient.execute(
            HttpMethod.PUT, "/v1/rdf/rules/custom-rule", rule, InferenceRuleStatus.class))
        .thenReturn(status);
    when(httpClient.execute(
            eq(HttpMethod.POST),
            eq("/v1/rdf/rules/materialize"),
            isNull(),
            eq(InferenceMaterializationResult.class),
            any(RequestOptions.class)))
        .thenReturn(result);

    assertSame(status, service.upsert("custom-rule", rule));
    assertSame(result, service.materialize(true, "custom-rule"));

    final ArgumentCaptor<RequestOptions> options = ArgumentCaptor.forClass(RequestOptions.class);
    verify(httpClient)
        .execute(
            eq(HttpMethod.POST),
            eq("/v1/rdf/rules/materialize"),
            isNull(),
            eq(InferenceMaterializationResult.class),
            options.capture());
    assertEquals("true", options.getValue().getQueryParams().get("force"));
    assertEquals("custom-rule", options.getValue().getQueryParams().get("ruleName"));
  }
}
