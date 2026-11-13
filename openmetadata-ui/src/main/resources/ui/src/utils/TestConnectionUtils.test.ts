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
import {
  Status,
  TestConnectionStepResult,
} from '../generated/entity/automations/workflow';
import { TestConnectionStep } from '../generated/entity/services/connections/testConnectionDefinition';
import {
  getHasOptionalStepsFailing,
  partitionConnectionSteps,
} from './TestConnectionUtils';

const step = (name: string, category?: string): TestConnectionStep =>
  ({
    name,
    description: name,
    mandatory: true,
    category,
  } as TestConnectionStep);

describe('getHasOptionalStepsFailing', () => {
  it.each([
    [Status.Skipped, false],
    [Status.Warning, true],
    [undefined, true],
  ])(
    'handles optional status %s with and without definitions',
    (status, expected) => {
      const result: TestConnectionStepResult = {
        name: 'CheckSchemaKvBucket',
        passed: false,
        mandatory: false,
        status,
      };
      const definition: TestConnectionStep = {
        name: 'CheckSchemaKvBucket',
        description: 'Schemas',
        mandatory: false,
      };

      expect(getHasOptionalStepsFailing([result], [definition])).toBe(expected);
      expect(getHasOptionalStepsFailing([result], [])).toBe(expected);
    }
  );

  it('uses the definition to identify optional checks', () => {
    expect(
      getHasOptionalStepsFailing(
        [
          {
            name: 'CheckSchemaKvBucket',
            passed: false,
            mandatory: true,
            status: Status.Warning,
          },
        ],
        [
          {
            name: 'CheckSchemaKvBucket',
            description: 'Schemas',
            mandatory: false,
          },
        ]
      )
    ).toBe(true);
  });
});

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

  it('falls back to the CheckAccess step when no step is tagged (legacy definitions)', () => {
    const steps = [step('GetSchemas'), step('CheckAccess'), step('GetTables')];

    const { gateStep, capabilitySteps } = partitionConnectionSteps(steps);

    expect(gateStep?.name).toBe('CheckAccess');
    expect(capabilitySteps.map((s) => s.name)).toEqual([
      'GetSchemas',
      'GetTables',
    ]);
  });

  it('returns no gate when no step is tagged and none is named CheckAccess', () => {
    const steps = [step('GetSchemas'), step('GetTables')];

    const { gateStep, capabilitySteps } = partitionConnectionSteps(steps);

    expect(gateStep).toBeUndefined();
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
