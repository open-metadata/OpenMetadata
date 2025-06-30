/*
 *  Copyright 2023 Collate.
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
import { SIZE } from '../../../../enums/common.enum';
import { LandingPageWidgetKeys } from '../../../../enums/CustomizablePage.enum';
import EmptyWidgetPlaceholder from './EmptyWidgetPlaceholder';
import { EmptyWidgetPlaceholderProps } from './EmptyWidgetPlaceholder.interface';

const mockProps: EmptyWidgetPlaceholderProps = {
  iconHeight: SIZE.MEDIUM,
  iconWidth: SIZE.MEDIUM,
  widgetKey: LandingPageWidgetKeys.ACTIVITY_FEED,
  handleOpenAddWidgetModal: jest.fn(),
  handlePlaceholderWidgetKey: jest.fn(),
  handleRemoveWidget: jest.fn(),
  isEditable: true,
};

describe('EmptyWidgetPlaceholder component', () => {
  it('EmptyWidgetPlaceholder should render properly', async () => {
    await act(async () => {
      render(
        <EmptyWidgetPlaceholder
          {...mockProps}
          iconHeight={undefined}
          iconWidth={undefined}
        />
      );
    });

    expect(
      screen.getByTestId(LandingPageWidgetKeys.ACTIVITY_FEED)
    ).toBeInTheDocument();
    expect(screen.getByTestId('drag-widget-button')).toBeInTheDocument();
    expect(screen.getByTestId('remove-widget-button')).toBeInTheDocument();
    expect(screen.getByTestId('no-data-image')).toBeInTheDocument();
    expect(
      screen.getByText('message.adding-new-entity-is-easy-just-give-it-a-spin')
    ).toBeInTheDocument();
    expect(screen.getByTestId('add-widget-button')).toBeInTheDocument();
  });

  it('EmptyWidgetPlaceholder should display drag and remove buttons when isEditable is not passed', async () => {
    await act(async () => {
      render(<EmptyWidgetPlaceholder {...mockProps} isEditable={undefined} />);
    });

    expect(screen.getByTestId('drag-widget-button')).toBeInTheDocument();
    expect(screen.getByTestId('remove-widget-button')).toBeInTheDocument();
  });

  it('EmptyWidgetPlaceholder should not display drag and remove buttons when isEditable is false', async () => {
    await act(async () => {
      render(<EmptyWidgetPlaceholder {...mockProps} isEditable={false} />);
    });

    expect(screen.queryByTestId('drag-widget-button')).toBeNull();
    expect(screen.queryByTestId('remove-widget-button')).toBeNull();
  });

  it('EmptyWidgetPlaceholder should call handleAddClick after clicking on add widget button', async () => {
    await act(async () => {
      render(<EmptyWidgetPlaceholder {...mockProps} />);
    });

    expect(mockProps.handleOpenAddWidgetModal).toHaveBeenCalledTimes(0);
    expect(mockProps.handlePlaceholderWidgetKey).toHaveBeenCalledTimes(0);

    const addButton = screen.getByTestId('add-widget-button');

    fireEvent.click(addButton);

    expect(mockProps.handleOpenAddWidgetModal).toHaveBeenCalledTimes(1);
    expect(mockProps.handlePlaceholderWidgetKey).toHaveBeenCalledTimes(1);
    expect(mockProps.handlePlaceholderWidgetKey).toHaveBeenCalledWith(
      mockProps.widgetKey
    );
  });

  it('EmptyWidgetPlaceholder should call handleRemoveWidget when clicked on remove widget button', async () => {
    await act(async () => {
      render(<EmptyWidgetPlaceholder {...mockProps} />);
    });

    expect(mockProps.handleRemoveWidget).toHaveBeenCalledTimes(0);

    const removeButton = screen.getByTestId('remove-widget-button');

    fireEvent.click(removeButton);

    expect(mockProps.handleRemoveWidget).toHaveBeenCalledTimes(1);
    expect(mockProps.handleRemoveWidget).toHaveBeenCalledWith(
      mockProps.widgetKey
    );
  });
});
