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
import { LandingPageWidgetKeys } from '../../../../enums/CustomizablePage.enum';
import EmptyWidgetPlaceholderV1 from './EmptyWidgetPlaceholderV1';
import { EmptyWidgetPlaceholderV1Props } from './EmptyWidgetPlaceholderV1.interface';

const mockProps: EmptyWidgetPlaceholderV1Props = {
  widgetKey: LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER,
  handleOpenAddWidgetModal: jest.fn(),
  handlePlaceholderWidgetKey: jest.fn(),
};

describe('EmptyWidgetPlaceholderV1 component', () => {
  it('EmptyWidgetPlaceholderV1 should render properly', async () => {
    await act(async () => {
      render(<EmptyWidgetPlaceholderV1 {...mockProps} />);
    });

    expect(screen.getByText('label.add-new-widget-plural')).toBeInTheDocument();
    expect(
      screen.getByText('message.tailor-experience-for-persona')
    ).toBeInTheDocument();
    expect(screen.getByTestId('add-widget-button')).toBeInTheDocument();
    expect(screen.getByText('label.add-widget-plural')).toBeInTheDocument();
  });

  it('EmptyWidgetPlaceholderV1 should call handleAddClick after clicking on add widget button', async () => {
    await act(async () => {
      render(<EmptyWidgetPlaceholderV1 {...mockProps} />);
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
});
