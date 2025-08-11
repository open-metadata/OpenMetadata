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
import {
  mockWidget,
  mockWidgetSizes,
} from '../../../../mocks/AddWidgetTabContent.mock';
import { AddWidgetTabContentProps } from './AddWidgetModal.interface';
import AddWidgetTabContent from './AddWidgetTabContent';

const mockProps: AddWidgetTabContentProps = {
  getAddWidgetHandler: jest.fn(),
  maxGridSizeSupport: 4,
  widget: mockWidget,
  widgetSizeOptions: mockWidgetSizes,
};

jest.mock('../../../../utils/CustomizeMyDataPageClassBase', () => ({
  getWidgetImageFromKey: jest.fn().mockImplementation(() => ''),
}));

describe('AddWidgetTabContent component', () => {
  it('AddWidgetTabContent should render properly', async () => {
    await act(async () => {
      render(<AddWidgetTabContent {...mockProps} />);
    });

    expect(screen.getByTestId('size-selector-button')).toBeInTheDocument();
    expect(screen.getByTestId('widget-image')).toBeInTheDocument();
    expect(screen.getByTestId('widget-description')).toBeInTheDocument();
    expect(screen.getByTestId('add-widget-button')).toBeInTheDocument();
  });

  it('AddWidgetTabContent should display correct size selector buttons', async () => {
    await act(async () => {
      render(<AddWidgetTabContent {...mockProps} />);
    });

    expect(screen.getByText('Small')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.queryByText('Large')).toBeNull();
  });

  it('AddWidgetTabContent should send selected widget size to getAddWidgetHandler', async () => {
    await act(async () => {
      render(<AddWidgetTabContent {...mockProps} />);
    });

    expect(mockProps.getAddWidgetHandler).toHaveBeenCalledTimes(1);
    expect(mockProps.getAddWidgetHandler).toHaveBeenCalledWith(
      expect.objectContaining(mockProps.widget),
      1
    );

    const mediumButton = screen.getByText('Medium');

    fireEvent.click(mediumButton);

    expect(mockProps.getAddWidgetHandler).toHaveBeenCalledTimes(2);
    expect(mockProps.getAddWidgetHandler).toHaveBeenCalledWith(
      expect.objectContaining(mockProps.widget),
      2
    );
  });

  it('AddWidgetTabContent should disable the add widget button if widget size exceeds the maxGridSizeSupport', async () => {
    await act(async () => {
      render(<AddWidgetTabContent {...mockProps} maxGridSizeSupport={0} />);
    });

    expect(screen.getByTestId('add-widget-button')).toBeDisabled();
  });
});
