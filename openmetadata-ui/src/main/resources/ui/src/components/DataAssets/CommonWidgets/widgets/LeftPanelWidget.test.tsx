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
import { render, screen } from '@testing-library/react';
import { DetailPageWidgetKeys } from '../../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { PageType } from '../../../../generated/system/ui/page';
import type { WidgetConfig } from '../../../../interface/customization.interface';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { LeftPanelWidget } from './LeftPanelWidget';

jest.mock('../../../Customization/GenericProvider/GenericContext');

const mockLeftPanel = jest.fn();

jest.mock('../../../Customization/GenericTab/LeftPanelContainer', () => ({
  LeftPanelContainer: (props: Record<string, unknown>) => {
    mockLeftPanel(props);

    return <div data-testid="left-panel" />;
  },
}));

const renderWidget = (children?: WidgetConfig[]) =>
  render(
    <LeftPanelWidget
      showTaskHandler
      entityType={EntityType.TABLE}
      widgetConfig={{
        i: DetailPageWidgetKeys.LEFT_PANEL,
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        ...(children ? { children } : {}),
      }}
    />
  );

describe('LeftPanelWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useGenericContext as jest.Mock).mockReturnValue({
      type: EntityType.TABLE,
    });
  });

  it('renders its child widgets for the entity page type in read-only mode', async () => {
    const children = [
      { i: DetailPageWidgetKeys.DESCRIPTION, x: 0, y: 0, w: 1, h: 1 },
    ];
    renderWidget(children);
    await screen.findByTestId('left-panel');

    expect(mockLeftPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        isEditView: false,
        layout: children,
        type: PageType.Table,
      })
    );
  });

  it('renders an empty layout when the panel has no children', async () => {
    renderWidget();
    await screen.findByTestId('left-panel');

    expect(mockLeftPanel).toHaveBeenCalledWith(
      expect.objectContaining({ layout: [] })
    );
  });
});
