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
import { partitionConnectionSteps } from './TestConnectionUtils';

const step = (name: string, category?: string): TestConnectionStep =>
  ({
    name,
    description: name,
    mandatory: true,
    category,
  } as TestConnectionStep);

describe('partitionConnectionSteps', () => {
  it('uses the step tagged ConnectionGate as the gate', () => {
    const steps = [
      step('GetSchemas'),
      step('CheckAccess', 'ConnectionGate'),
      step('GetTables'),
    ];

    const { gateStep, capabilitySteps } = partitionConnectionSteps(steps);

    expect(gateStep?.name).toBe('CheckAccess');
    expect(capabilitySteps.map((s) => s.name)).toEqual([
      'GetSchemas',
      'GetTables',
    ]);
  });

  it('falls back to the first step when no step is tagged (legacy definitions)', () => {
    const steps = [step('CheckAccess'), step('GetSchemas'), step('GetTables')];

    const { gateStep, capabilitySteps } = partitionConnectionSteps(steps);

    expect(gateStep?.name).toBe('CheckAccess');
    expect(capabilitySteps.map((s) => s.name)).toEqual([
      'GetSchemas',
      'GetTables',
    ]);
  });

  it('returns no gate for an empty step list', () => {
    const { gateStep, capabilitySteps } = partitionConnectionSteps([]);

    expect(gateStep).toBeUndefined();
    expect(capabilitySteps).toEqual([]);
  });
});
