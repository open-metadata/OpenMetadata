/*
 *  Copyright 2026 Collate.
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
import { render, screen } from '@testing-library/react';
import {
  CheckType,
  OnboardingPlaybook,
  Operator,
  Requirement,
  TargetEntityType,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { CreationOutlook } from './CreationOutlook';

const playbook: OnboardingPlaybook = {
  id: 'playbook',
  name: 'dataProduct',
  displayName: 'Data Product playbook',
  entityType: TargetEntityType.DataProduct,
  version: 0.6,
  onboarding: {
    enabled: true,
    gates: [
      {
        stage: 'creation',
        steps: [
          {
            id: 'displayName',
            type: CheckType.Attribute,
            title: 'Name & display name',
            fieldPath: 'displayName',
            requirement: Requirement.Blocking,
          },
        ],
      },
      {
        stage: 'draft',
        steps: [
          {
            id: 'experts',
            type: CheckType.Responsibility,
            title: 'Experts',
            fieldPath: 'experts',
            requirement: Requirement.Optional,
          },
          {
            id: 'certification',
            type: CheckType.Attribute,
            title: 'Certification',
            fieldPath: 'certification',
            requirement: Requirement.Blocking,
            conditions: [
              {
                fieldPath: 'tags',
                operator: Operator.StartsWith,
                value: 'PII.',
              },
            ],
          },
        ],
        handoffWorkflow: {
          id: 'workflow',
          type: 'workflowDefinition',
          name: 'DataProductReviewApprovalWorkflow',
          displayName: 'Data Product Review & Approval',
        },
      },
    ],
  },
} as OnboardingPlaybook;

it('counts the checks this asset has actually earned and names the review workflow', () => {
  const { rerender } = render(
    <CreationOutlook customProperties={[]} playbook={playbook} values={{}} />
  );

  expect(screen.getByTestId('queued-after-creation')).toHaveTextContent(
    'message.checks-queued-after-creation'
  );
  expect(
    screen.getByTestId('message.when-gate-passes-workflow-starts')
  ).toHaveTextContent('Data Product Review & Approval');
  expect(screen.getByText('Name & display name')).toBeInTheDocument();

  rerender(
    <CreationOutlook
      customProperties={[]}
      playbook={playbook}
      values={{ tags: [{ tagFQN: 'PII.Sensitive' }] }}
    />
  );

  expect(screen.getByTestId('queued-after-creation')).toBeInTheDocument();
});

it('says who to ask when the gate has no review workflow', () => {
  const withoutWorkflow = {
    ...playbook,
    owners: [{ id: 'team', type: 'team', displayName: 'Data Management' }],
    onboarding: {
      ...playbook.onboarding,
      gates: playbook.onboarding?.gates?.map((gate) => ({
        ...gate,
        handoffWorkflow: undefined,
      })),
    },
  } as OnboardingPlaybook;
  render(
    <CreationOutlook
      customProperties={[]}
      playbook={withoutWorkflow}
      values={{}}
    />
  );

  expect(
    screen.getByText('message.no-review-workflow-on-gate')
  ).toBeInTheDocument();
});
