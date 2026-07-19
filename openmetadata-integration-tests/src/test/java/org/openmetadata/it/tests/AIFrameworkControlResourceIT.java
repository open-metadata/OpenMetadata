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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.ai.CreateAIFrameworkControl;
import org.openmetadata.schema.api.ai.CreateAIGovernanceFramework;
import org.openmetadata.schema.entity.ai.AIFrameworkControl;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.sdk.network.HttpMethod;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AIFrameworkControlResourceIT {

  @Test
  void controlsWithTheSameNameAreScopedByFramework(TestNamespace namespace) throws Exception {
    AIGovernanceFramework firstFramework = createFramework(namespace.prefix("first_framework"));
    AIGovernanceFramework secondFramework = createFramework(namespace.prefix("second_framework"));
    String controlName = namespace.prefix("shared_control");

    AIFrameworkControl firstControl =
        createControl(controlName, firstFramework.getFullyQualifiedName());
    AIFrameworkControl secondControl =
        createControl(controlName, secondFramework.getFullyQualifiedName());

    assertNotEquals(firstControl.getId(), secondControl.getId());
    assertEquals(
        firstFramework.getFullyQualifiedName() + "." + controlName,
        firstControl.getFullyQualifiedName());
    assertEquals(
        secondFramework.getFullyQualifiedName() + "." + controlName,
        secondControl.getFullyQualifiedName());
    assertEquals(firstFramework.getId(), firstControl.getFramework().getId());
    assertEquals(secondFramework.getId(), secondControl.getFramework().getId());
  }

  private AIGovernanceFramework createFramework(String name) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/aiGovernanceFrameworks",
            new CreateAIGovernanceFramework().withName(name),
            AIGovernanceFramework.class);
  }

  private AIFrameworkControl createControl(String name, String frameworkFqn) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/aiFrameworkControls",
            new CreateAIFrameworkControl().withName(name).withFramework(frameworkFqn),
            AIFrameworkControl.class);
  }
}
