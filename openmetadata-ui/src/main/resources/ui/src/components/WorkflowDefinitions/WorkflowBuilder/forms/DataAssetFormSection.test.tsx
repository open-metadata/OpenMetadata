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

import { fireEvent, render, screen } from '@testing-library/react';
import { ALL_DATA_ASSETS_OPTION_VALUE } from '../../../../constants/WorkflowBuilder.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { getTriggerDataAssets } from '../../../../utils/WorkflowConfigUtils';
import { DataAssetFormSection } from './DataAssetFormSection';

jest.mock('@openmetadata/ui-core-components', () => {
  const Autocomplete = ({
    items,
    onItemInserted,
  }: {
    items: { id: string; label: string }[];
    onItemInserted: (key: string) => void;
  }) => (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <button
            data-testid={`option-${item.id}`}
            onClick={() => onItemInserted(item.id)}>
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
  Autocomplete.Item = () => null;

  return { Autocomplete };
});

jest.mock('../../../../contexts/WorkflowModeContext', () => ({
  useWorkflowModeContext: () => ({ isFormDisabled: false }),
}));

const ENTITY_TYPES = [EntityType.TABLE, EntityType.QUERY, EntityType.TOPIC];

const renderSection = (hasGitSinkNode: boolean) => {
  const onDataAssetsChange = jest.fn();
  render(
    <DataAssetFormSection
      availableDataAssets={getTriggerDataAssets(ENTITY_TYPES, hasGitSinkNode)}
      dataAssets={[]}
      onDataAssetsChange={onDataAssetsChange}
      onRemoveDataAsset={jest.fn()}
    />
  );

  return onDataAssetsChange;
};

describe('DataAssetFormSection', () => {
  it('offers no query option and an "All" without query for a workflow with a git sink', () => {
    const onDataAssetsChange = renderSection(true);

    expect(
      screen.queryByTestId(`option-${EntityType.QUERY}`)
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByTestId(`option-${ALL_DATA_ASSETS_OPTION_VALUE}`)
    );

    expect(onDataAssetsChange).toHaveBeenCalledWith([
      EntityType.TABLE,
      EntityType.TOPIC,
    ]);
  });

  it('offers query and an "All" with it for a workflow without a git sink', () => {
    const onDataAssetsChange = renderSection(false);

    expect(
      screen.getByTestId(`option-${EntityType.QUERY}`)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByTestId(`option-${ALL_DATA_ASSETS_OPTION_VALUE}`)
    );

    expect(onDataAssetsChange).toHaveBeenCalledWith(ENTITY_TYPES);
  });
});
