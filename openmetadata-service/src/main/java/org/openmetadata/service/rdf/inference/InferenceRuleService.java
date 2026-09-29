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

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import org.openmetadata.schema.api.configuration.rdf.InferenceMaterializationResult;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;

/** Application service shared by REST and scheduled inference execution. */
public final class InferenceRuleService {
  private final InferenceRuleRepository ruleRepository;
  private final InferenceMaterializer materializer;

  public InferenceRuleService(
      final InferenceRuleRepository ruleRepository, final InferenceMaterializer materializer) {
    this.ruleRepository = ruleRepository;
    this.materializer = materializer;
  }

  public List<InferenceRuleStatus> list() {
    return ruleRepository.list();
  }

  public InferenceRuleStatus get(final String name) {
    return ruleRepository.get(name);
  }

  public InferenceRuleStatus upsert(final String name, final InferenceRule rule) {
    final InferenceRuleStatus status = ruleRepository.upsert(name, rule);
    ruleRepository.markAllDirty();
    return status;
  }

  public void delete(final String name) {
    final InferenceRuleStatus status = ruleRepository.get(name);
    requireCustomRule(status);
    materializer.clear(status.getGraphUri().toString());
    ruleRepository.delete(name);
    ruleRepository.markAllDirty();
  }

  public InferenceMaterializationResult materialize(
      final boolean force, final String requestedRule) {
    return materializer.materialize(force, requestedRule);
  }

  private static void requireCustomRule(final InferenceRuleStatus status) {
    if (Boolean.TRUE.equals(status.getSystemRule())) {
      throw new BadRequestException(
          "System inference rule '" + status.getRule().getName() + "' cannot be deleted");
    }
  }
}
