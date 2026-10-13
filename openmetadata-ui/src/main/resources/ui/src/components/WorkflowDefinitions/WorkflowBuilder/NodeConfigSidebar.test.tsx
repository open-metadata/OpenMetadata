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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Node } from 'reactflow';
import { WorkflowType } from '../../../constants/WorkflowBuilder.constants';
import { EntityType } from '../../../enums/entity.enum';
import { NodeType } from '../../../generated/governance/workflows/elements/nodeType';
import { NodeConfig } from '../../../interface/workflow-builder-components.interface';
import { NodeConfigSidebar } from './NodeConfigSidebar';

jest.mock('@openmetadata/ui-core-components', () => {
  const SlideoutMenu = ({
    children,
  }: {
    children: (state: { close: () => void }) => React.ReactNode;
  }) => <div>{children({ close: jest.fn() })}</div>;
  const Section = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  SlideoutMenu.Header = Section;
  SlideoutMenu.Content = Section;
  SlideoutMenu.Footer = Section;

  return { Divider: () => null, SlideoutMenu, Typography: Section };
});

jest.mock('./forms/WorkflowConfigFormV1', () => ({
  WorkflowConfigFormV1: ({ config }: { config: NodeConfig }) => (
    <div>
      <span data-testid="selected-data-assets">
        {config.dataAssets.join(',')}
      </span>
      <span data-testid="data-asset-filters">
        {config.dataAssetFilters.map((filter) => filter.dataAsset).join(',')}
      </span>
    </div>
  ),
}));

jest.mock('./forms/FormActionButtons', () => ({
  FormActionButtons: ({ onSave }: { onSave: () => void }) => (
    <button data-testid="save-node-configuration-button" onClick={onSave}>
      save
    </button>
  ),
}));

jest.mock('../../../contexts/WorkflowModeContext', () => ({
  useWorkflowModeContext: () => ({
    allowFullStartNodeConfiguration: true,
    allowStartNodeFilterScheduleAndBatchEdit: true,
    allowScheduledTrigger: true,
  }),
}));

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getCustomPropertiesByEntityType: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

// A trigger saved as "All" before the workflow had a Git sink.
const START_NODE: Node = {
  id: 'start',
  type: NodeType.StartEvent,
  position: { x: 0, y: 0 },
  data: {
    label: 'Start',
    name: 'GitSyncWorkflow',
    userModified: true,
    triggerType: WorkflowType.PERIODIC_BATCH,
    scheduleType: 'OnDemand',
    dataAssets: [EntityType.TABLE, EntityType.QUERY],
    dataAssetFilters: [
      { id: 1, dataAsset: EntityType.TABLE, filters: 'table-filter' },
      { id: 2, dataAsset: EntityType.QUERY, filters: 'query-filter' },
    ],
  },
};

const renderSidebar = async (hasGitSinkNode: boolean) => {
  const onSave = jest.fn();
  render(
    <NodeConfigSidebar
      isOpen
      hasGitSinkNode={hasGitSinkNode}
      node={START_NODE}
      triggerFieldsConfig={{ common: [], entitySpecific: {} }}
      workflowDefinition={null}
      onClose={jest.fn()}
      onSave={onSave}
      onWorkflowUpdate={jest.fn()}
    />
  );
  // Let the custom-property lookup for the selected data assets settle.
  await act(async () => undefined);

  return onSave;
};

const getSavedTriggerConfig = (onSave: jest.Mock) =>
  onSave.mock.calls[0][1] as Pick<
    NodeConfig,
    'dataAssets' | 'dataAssetFilters'
  >;

describe('NodeConfigSidebar trigger of a workflow with a Git sink', () => {
  it('drops query from data assets and filters selected before the sink was added', async () => {
    const onSave = await renderSidebar(true);

    expect(screen.getByTestId('selected-data-assets').textContent).toBe(
      EntityType.TABLE
    );
    expect(screen.getByTestId('data-asset-filters').textContent).toBe(
      EntityType.TABLE
    );

    fireEvent.click(screen.getByTestId('save-node-configuration-button'));

    expect(getSavedTriggerConfig(onSave)).toEqual(
      expect.objectContaining({
        dataAssets: [EntityType.TABLE],
        dataAssetFilters: [
          { id: 1, dataAsset: EntityType.TABLE, filters: 'table-filter' },
        ],
      })
    );
  });

  it('keeps query for a workflow without a Git sink', async () => {
    const onSave = await renderSidebar(false);

    fireEvent.click(screen.getByTestId('save-node-configuration-button'));

    expect(getSavedTriggerConfig(onSave)).toEqual(
      expect.objectContaining({
        dataAssets: [EntityType.TABLE, EntityType.QUERY],
      })
    );
  });
});
