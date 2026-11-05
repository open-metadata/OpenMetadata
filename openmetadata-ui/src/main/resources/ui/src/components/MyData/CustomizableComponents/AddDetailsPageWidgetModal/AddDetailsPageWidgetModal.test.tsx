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
import userEvent from '@testing-library/user-event';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  CUSTOM_PROPERTIES_WIDGET,
  DESCRIPTION_WIDGET,
  TAB_GRID_MAX_COLUMNS,
} from '../../../../constants/CustomizeWidgets.constants';
import { WidgetWidths } from '../../../../enums/CustomizablePage.enum';
import AddDetailsPageWidgetModal from './AddDetailsPageWidgetModal';

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

jest.mock('../../../../hooks/useEntityTypeCustomProperties', () => ({
  useEntityTypeCustomProperties: () => ({
    customProperties: [],
    isLoading: false,
  }),
}));

const renderModal = () => {
  const handleAddWidget = jest.fn();
  const handleCloseAddWidgetModal = jest.fn();

  render(
    <DndProvider backend={HTML5Backend}>
      <AddDetailsPageWidgetModal
        open
        entityType="table"
        handleAddWidget={handleAddWidget}
        handleCloseAddWidgetModal={handleCloseAddWidgetModal}
        maxGridSizeSupport={TAB_GRID_MAX_COLUMNS}
        placeholderWidgetKey="placeholder"
        widgetsList={[DESCRIPTION_WIDGET, CUSTOM_PROPERTIES_WIDGET]}
      />
    </DndProvider>
  );

  return { handleAddWidget, handleCloseAddWidgetModal };
};

describe('AddDetailsPageWidgetModal', () => {
  it('lists the widgets as tabs under the dialog title', () => {
    renderModal();

    expect(screen.getByTestId('add-widget-modal')).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: CUSTOM_PROPERTIES_WIDGET.name })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: DESCRIPTION_WIDGET.name })
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.choose-widget-to-add-to-tab')
    ).toBeInTheDocument();
  });

  it('adds a plain widget at the picked size from the footer', async () => {
    const { handleAddWidget } = renderModal();

    await user.click(screen.getByTestId(`${DESCRIPTION_WIDGET.name}-widget`));
    await user.click(screen.getByTestId('large-size-selector'));
    await user.click(screen.getByTestId('add-widget-button'));

    expect(handleAddWidget).toHaveBeenCalledWith(
      DESCRIPTION_WIDGET,
      'placeholder',
      WidgetWidths.large,
      undefined
    );
  });

  it('closes from the footer Cancel button', async () => {
    const { handleCloseAddWidgetModal } = renderModal();

    await user.click(screen.getByText('label.cancel'));

    expect(handleCloseAddWidgetModal).toHaveBeenCalled();
  });
});
