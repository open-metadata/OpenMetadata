/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

class ResourceContextTest {

  @Test
  void requestedResponseFieldsAlwaysIncludeAttributesRequiredForPolicyEvaluation() {
    MetricRepository repository = mock(MetricRepository.class);
    when(repository.isSupportsOwners()).thenReturn(true);
    when(repository.isSupportsTags()).thenReturn(true);
    when(repository.isSupportsDomains()).thenReturn(false);
    when(repository.isSupportsReviewers()).thenReturn(true);
    ResourceContext<Metric> context =
        new ResourceContext<>(Entity.METRIC, new Metric(), repository);
    Fields requested = new Fields(Set.of("parent"));

    Fields policyFields = context.withPolicyEvaluationFields(requested);

    assertEquals(
        Set.of("parent", Entity.FIELD_OWNERS, Entity.FIELD_TAGS, Entity.FIELD_REVIEWERS),
        policyFields.getFieldList());
    assertEquals(Set.of("parent"), requested.getFieldList());
  }
}
