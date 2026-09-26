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
import { act, render, screen } from '@testing-library/react';
import { DetailPageWidgetKeys } from '../../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../../enums/entity.enum';
import type { WidgetConfig } from '../../../../interface/customization.interface';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { DescriptionWidget } from './DescriptionWidget';

jest.mock('../../../Customization/GenericProvider/GenericContext');

const mockDescription = jest.fn();

jest.mock('../../../common/EntityDescription/DescriptionV1', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockDescription(props);

    return <div data-testid="description" />;
  },
}));

const mockOnUpdate = jest.fn();

const widgetConfig: WidgetConfig = {
  i: DetailPageWidgetKeys.DESCRIPTION,
  x: 0,
  y: 0,
  w: 1,
  h: 1,
};

const renderWidget = (
  data: Record<string, unknown>,
  entityType = EntityType.TABLE,
  config: WidgetConfig = widgetConfig
) => {
  (useGenericContext as jest.Mock).mockReturnValue({
    data: { id: 'id-1', name: 'entity', description: 'old', ...data },
    type: entityType,
    permissions: { EditAll: true },
    isVersionView: false,
    onUpdate: mockOnUpdate,
  });

  return render(
    <DescriptionWidget
      showTaskHandler
      entityType={entityType}
      widgetConfig={config}
    />
  );
};

const lastProps = () =>
  mockDescription.mock.calls[mockDescription.mock.calls.length - 1][0];

describe('DescriptionWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [EntityType.TABLE, { columns: [] }, true],
    [EntityType.TABLE, { columns: [{ name: 'id' }] }, false],
    [EntityType.DASHBOARD, { charts: [] }, true],
    [EntityType.DASHBOARD_DATA_MODEL, { columns: [{ name: 'id' }] }, false],
    [EntityType.MLMODEL, { mlFeatures: [] }, true],
    [EntityType.PIPELINE, { tasks: [{ name: 't' }] }, false],
    [EntityType.TOPIC, { messageSchema: { schemaFields: [] } }, true],
    [EntityType.SEARCH_INDEX, { fields: [{ name: 'f' }] }, false],
    [
      EntityType.STORED_PROCEDURE,
      { storedProcedureCode: { code: 'x' } },
      false,
    ],
    [EntityType.GLOSSARY, { termCount: 0 }, true],
    [EntityType.GLOSSARY, { termCount: 3 }, false],
    [EntityType.DOMAIN, {}, true],
    [EntityType.METRIC, {}, true],
    [EntityType.FILE, {}, true],
    [EntityType.WORKSHEET, {}, true],
    [EntityType.DIRECTORY, { children: [] }, true],
    [EntityType.SPREADSHEET, { worksheets: [{ name: 'w' }] }, false],
    [EntityType.CONTAINER, {}, false],
  ])(
    'opens expanded for %s with %j: %s',
    async (entityType, data, expanded) => {
      renderWidget(data, entityType);

      await screen.findByTestId('description');

      expect(lastProps().isDescriptionExpanded).toBe(expanded);
    }
  );

  it.each([
    ['a small widget', EntityType.CONTAINER, 'small', false],
    ['a large widget', EntityType.CONTAINER, 'large', true],
    ['a domain', EntityType.DOMAIN, undefined, true],
  ])('sets removeBlur for %s: %s', async (_, entityType, size, removeBlur) => {
    renderWidget({}, entityType, {
      ...widgetConfig,
      ...(size ? { config: { size } } : {}),
    });
    await screen.findByTestId('description');

    expect(lastProps().removeBlur).toBe(removeBlur);
  });

  it('saves a changed description and clears it when emptied', async () => {
    renderWidget({});
    await screen.findByTestId('description');

    await act(async () => {
      await lastProps().onDescriptionUpdate('new');
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'new' }),
      'description'
    );

    await act(async () => {
      await lastProps().onDescriptionUpdate('');
    });

    expect(mockOnUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: undefined }),
      'description'
    );
  });

  it('does not save when the description is unchanged', async () => {
    renderWidget({});
    await screen.findByTestId('description');

    await act(async () => {
      await lastProps().onDescriptionUpdate('old');
    });

    expect(mockOnUpdate).not.toHaveBeenCalled();
  });
});
