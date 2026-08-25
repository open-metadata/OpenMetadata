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
import { PageType } from '../../../generated/system/ui/page';
import { LeftPanelContainer } from './LeftPanelContainer';

jest.mock('../../../hooks/useGridLayoutDirection');

jest.mock('../../../utils/CustomizePage/CustomizePageDispatchUtils', () => ({
  getWidgetsFromKey: jest.fn(),
}));

jest.mock('react-grid-layout', () => ({
  WidthProvider: jest.fn().mockImplementation(() =>
    jest
      .fn()
      .mockImplementation(({ children, className, containerPadding }) => (
        <div
          className={className}
          data-container-padding={containerPadding.join(',')}
          data-testid="react-grid-layout">
          {children}
        </div>
      ))
  ),
  __esModule: true,
  default: jest.fn(),
}));

describe('LeftPanelContainer', () => {
  const commonProps = {
    layout: [],
    onUpdate: jest.fn(),
    type: PageType.Table,
  };

  it('applies the content class in non-edit mode', () => {
    const { container } = render(
      <LeftPanelContainer {...commonProps} isEditView={false} />
    );

    expect(container.firstElementChild).toHaveClass('left-panel-content');
  });

  it('applies left panel padding in edit mode', () => {
    render(<LeftPanelContainer {...commonProps} isEditView />);

    expect(screen.getByTestId('react-grid-layout')).toHaveAttribute(
      'data-container-padding',
      '16,16'
    );
  });
});
