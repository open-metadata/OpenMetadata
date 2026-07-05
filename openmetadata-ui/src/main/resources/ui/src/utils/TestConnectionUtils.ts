/*
 *  Copyright 2025 Collate.
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
import { TestConnectionStep } from '../generated/entity/services/connections/testConnectionDefinition';

export const CONNECTION_GATE_CATEGORY = 'ConnectionGate';

// `category` is an additive, optional field on the TestConnectionStep schema. We
// read it defensively here so the partition keeps working against definitions
// (and generated models) that predate the field.
type StepWithCategory = TestConnectionStep & { category?: string };

export interface ConnectionStepPhases {
  gateStep?: TestConnectionStep;
  capabilitySteps: TestConnectionStep[];
}

/**
 * Splits the ordered test-connection steps into the connection "gate" (the step
 * that establishes connectivity) and the capability checks that only run once
 * the gate passes. The gate is the first step flagged `category: ConnectionGate`;
 * when no step is tagged we fall back to the first step, since connectors
 * conventionally lead with the connection/auth check (e.g. `CheckAccess`).
 */
export const partitionConnectionSteps = (
  steps: TestConnectionStep[]
): ConnectionStepPhases => {
  let result: ConnectionStepPhases = {
    gateStep: undefined,
    capabilitySteps: [],
  };
  if (steps.length > 0) {
    const taggedGateIndex = steps.findIndex(
      (step) => (step as StepWithCategory).category === CONNECTION_GATE_CATEGORY
    );
    const gateIndex = taggedGateIndex >= 0 ? taggedGateIndex : 0;
    result = {
      gateStep: steps[gateIndex],
      capabilitySteps: steps.filter((_, index) => index !== gateIndex),
    };
  }

  return result;
};
