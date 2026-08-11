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
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { WorkflowType } from '../../../../constants/WorkflowBuilder.constants';
import { WorkflowModeProvider } from '../../../../contexts/WorkflowModeContext';
import { NodeConfig } from '../../../../interface/workflow-builder-components.interface';

jest.mock('./TriggerConfigSection', () => ({
  TriggerConfigSection: ({
    lockNonIncludeExcludeFields,
    lockPeriodicBatchFields,
  }: {
    lockNonIncludeExcludeFields?: boolean;
    lockPeriodicBatchFields?: boolean;
  }) => (
    <div
      data-lock-non-include-exclude={String(!!lockNonIncludeExcludeFields)}
      data-lock-periodic-batch={String(!!lockPeriodicBatchFields)}
      data-testid="trigger-config-section">
      <div data-testid="trigger-type-select" />
    </div>
  ),
}));

jest.mock('./MetadataFormSection', () => ({
  MetadataFormSection: ({ lockFields }: { lockFields?: boolean }) => (
    <div
      data-lock-fields={String(!!lockFields)}
      data-testid="metadata-form-section-mock"
    />
  ),
}));

jest.mock('./DataAssetFormSection', () => ({
  DataAssetFormSection: ({ lockFields }: { lockFields?: boolean }) => (
    <div
      data-lock-fields={String(!!lockFields)}
      data-testid="data-asset-form-section-mock"
    />
  ),
}));

jest.mock('./DataAssetFiltersSection', () => ({
  DataAssetFiltersSection: ({ lockFields }: { lockFields?: boolean }) => (
    <div
      data-lock-fields={String(!!lockFields)}
      data-testid="data-asset-filters-section-mock"
    />
  ),
}));

jest.mock('./EventTriggerFilterSection', () => ({
  EventTriggerFilterSection: ({ lockFields }: { lockFields?: boolean }) => (
    <div
      data-lock-fields={String(!!lockFields)}
      data-testid="event-trigger-filter-section-mock"
    />
  ),
}));

import { WorkflowConfigFormV1 } from './WorkflowConfigFormV1';

const noop = () => {
  return;
};

const baseHandlers = {
  updateConfig: noop as <K extends keyof NodeConfig>(
    key: K,
    value: NodeConfig[K]
  ) => void,
  removeFromArray: noop as <K extends keyof NodeConfig>(
    key: K,
    itemToRemove: string
  ) => void,
  handleEventTypeChange: noop as (event: {
    target: { value: string[] };
  }) => void,
  addDataAssetFilter: noop as (dataAsset?: string) => void,
  onUpdateDataAssetFilter: noop as (dataAssetId: number, value: string) => void,
  removeDataAssetFilter: noop as (dataAssetId: number) => void,
};

const renderWithWorkflowMode = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <WorkflowModeProvider>{ui}</WorkflowModeProvider>
    </MemoryRouter>
  );

describe('WorkflowConfigFormV1 OSS vs Collate start node', () => {
  it('OSS: locks metadata, data assets, and trigger type but allows filters and periodic schedule/batch when allowStartNodeFilterScheduleAndBatchEdit', () => {
    const config: NodeConfig = {
      name: 'W',
      description: '',
      dataAssets: ['table'],
      triggerType: WorkflowType.PERIODIC_BATCH,
      eventType: [],
      dataAssetFilters: [],
      excludeFields: [],
      include: [],
      scheduleType: 'OnDemand',
      cronExpression: '',
      batchSize: 100,
    };

    renderWithWorkflowMode(
      <WorkflowConfigFormV1
        {...baseHandlers}
        allowStartNodeFilterScheduleAndBatchEdit
        allowFullStartNodeConfiguration={false}
        availableEventTypes={[]}
        availableExcludeFields={[]}
        config={config}
      />
    );

    expect(screen.getByTestId('workflow-config-form-v1')).toBeInTheDocument();
    expect(screen.getByTestId('metadata-form-section-mock')).toHaveAttribute(
      'data-lock-fields',
      'true'
    );
    expect(screen.getByTestId('data-asset-form-section-mock')).toHaveAttribute(
      'data-lock-fields',
      'true'
    );
    expect(
      screen.getByTestId('data-asset-filters-section-mock')
    ).toHaveAttribute('data-lock-fields', 'false');
    expect(screen.getByTestId('trigger-config-section')).toHaveAttribute(
      'data-lock-non-include-exclude',
      'true'
    );
    expect(screen.getByTestId('trigger-config-section')).toHaveAttribute(
      'data-lock-periodic-batch',
      'false'
    );
  });

  it('locks filters and periodic batch when both start capabilities are false', () => {
    const config: NodeConfig = {
      name: 'W',
      description: '',
      dataAssets: ['table'],
      triggerType: WorkflowType.PERIODIC_BATCH,
      eventType: [],
      dataAssetFilters: [],
      excludeFields: [],
      include: [],
      scheduleType: 'OnDemand',
      cronExpression: '',
      batchSize: 100,
    };

    renderWithWorkflowMode(
      <WorkflowConfigFormV1
        {...baseHandlers}
        allowFullStartNodeConfiguration={false}
        allowStartNodeFilterScheduleAndBatchEdit={false}
        availableEventTypes={[]}
        availableExcludeFields={[]}
        config={config}
      />
    );

    expect(
      screen.getByTestId('data-asset-filters-section-mock')
    ).toHaveAttribute('data-lock-fields', 'true');
    expect(screen.getByTestId('trigger-config-section')).toHaveAttribute(
      'data-lock-periodic-batch',
      'true'
    );
  });

  it('passes lock flags off for Collate (allowFullStartNodeConfiguration true)', () => {
    const config: NodeConfig = {
      name: 'W',
      description: '',
      dataAssets: ['table'],
      triggerType: WorkflowType.EVENT_BASED,
      eventType: ['entityUpdated'],
      dataAssetFilters: [],
      excludeFields: [],
      include: [],
      scheduleType: '',
      cronExpression: '',
      batchSize: 0,
    };

    renderWithWorkflowMode(
      <WorkflowConfigFormV1
        {...baseHandlers}
        allowFullStartNodeConfiguration
        allowStartNodeFilterScheduleAndBatchEdit
        availableEventTypes={['entityUpdated']}
        availableExcludeFields={['description']}
        config={config}
      />
    );

    expect(screen.getByTestId('metadata-form-section-mock')).toHaveAttribute(
      'data-lock-fields',
      'false'
    );
    expect(screen.getByTestId('trigger-config-section')).toHaveAttribute(
      'data-lock-non-include-exclude',
      'false'
    );
    expect(screen.getByTestId('trigger-config-section')).toHaveAttribute(
      'data-lock-periodic-batch',
      'false'
    );
    expect(
      screen.getByTestId('event-trigger-filter-section-mock')
    ).toHaveAttribute('data-lock-fields', 'false');
  });
});
