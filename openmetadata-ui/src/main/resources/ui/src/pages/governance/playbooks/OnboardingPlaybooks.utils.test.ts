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

import {
  CheckType,
  OnboardingPlaybook,
  Requirement,
  TargetEntityType,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { buildPlaybookRows } from './OnboardingPlaybooks.utils';

// Echoes the key and its interpolation so assertions read as the contract, not the copy.
const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key;

const playbook: OnboardingPlaybook = {
  id: 'p1',
  name: 'metricPlaybook',
  entityType: TargetEntityType.Metric,
  version: 0.2,
  onboarding: {
    enabled: true,
    gates: [
      {
        stage: 'creation',
        steps: [
          {
            id: 'display-name',
            type: CheckType.Attribute,
            requirement: Requirement.Blocking,
            fieldPath: 'displayName',
          },
          {
            id: 'tags',
            type: CheckType.Relationship,
            requirement: Requirement.Recommended,
            fieldPath: 'tags',
          },
        ],
      },
      {
        stage: 'draft',
        steps: [
          {
            id: 'description',
            type: CheckType.Attribute,
            requirement: Requirement.Blocking,
            fieldPath: 'description',
          },
        ],
      },
    ],
  },
};

describe('playbook manager rows', () => {
  it('lists every supported asset type, configured or not', () => {
    const rows = buildPlaybookRows([playbook], t);

    expect(rows).toHaveLength(4);
    expect(rows.filter((row) => row.isConfigured)).toHaveLength(1);
  });

  it('counts only blocking Creation checks as enforced at creation', () => {
    const [row] = buildPlaybookRows([playbook], t).filter(
      (candidate) => candidate.isConfigured
    );

    // One of the two Creation checks is recommended, so it does not gate creation.
    expect(row.enforcedAtCreation).toBe(
      'message.fields-enforced-at-creation:{"count":1}'
    );
  });

  it('labels asset counts with the asset type noun', () => {
    const [row] = buildPlaybookRows([playbook], t, { metric: 96 }).filter(
      (candidate) => candidate.isConfigured
    );

    expect(row.assets).toBe('message.metric-count:{"count":96}');
  });

  it('shows a dash for an asset type whose count could not be resolved', () => {
    const [row] = buildPlaybookRows([playbook], t).filter(
      (candidate) => candidate.isConfigured
    );

    expect(row.assets).toBe('—');
  });

  it('reads as never configured for an asset type without a playbook', () => {
    const row = buildPlaybookRows([playbook], t).find(
      (candidate) => candidate.entityType === TargetEntityType.Domain
    );

    expect(row?.versionLabel).toBe('— · label.never-configured');
    expect(row?.enforcedAtCreation).toBe('message.no-checks-enforced-yet');
    expect(row?.structure).toBe('—');
  });

  it('dates a configured playbook by when it was last edited', () => {
    const [row] = buildPlaybookRows(
      [{ ...playbook, updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000 }],
      t
    ).filter((candidate) => candidate.entityType === TargetEntityType.Metric);

    expect(row.versionLabel).toBe(
      'v0.2 · message.edited-relative:{"time":"2 days ago"}'
    );
  });

  it('omits the edited date when the playbook has never been written', () => {
    const [row] = buildPlaybookRows(
      [{ ...playbook, updatedAt: undefined }],
      t
    ).filter((candidate) => candidate.entityType === TargetEntityType.Metric);

    expect(row.versionLabel).toBe('v0.2');
  });

  it('summarises structure as gates and checks', () => {
    const [row] = buildPlaybookRows([playbook], t).filter(
      (candidate) => candidate.isConfigured
    );

    expect(row.structure).toBe(
      'message.gates-and-checks:{"gates":2,"checks":3}'
    );
  });
});
