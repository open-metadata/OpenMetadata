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
import { render } from '@testing-library/react';
import {
  CENTER_PANEL_DEFAULT_WIDTH,
  CENTER_PANEL_PANEL_MARGIN,
} from 'constants/KnowledgeCenter.constant';
import { SizeAwareElement } from './SizeAwareElement';

describe('SizeAwareElement', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <SizeAwareElement
        isLeftPanelCollapsed={false}
        isRightPanelCollapsed={false}>
        Test
      </SizeAwareElement>
    );

    expect(getByText('Test')).toBeInTheDocument();
  });

  it('applies correct styles when isLeftPanelCollapsed is true', () => {
    const { getByText } = render(
      <SizeAwareElement isLeftPanelCollapsed isRightPanelCollapsed={false}>
        Test
      </SizeAwareElement>
    );

    expect(getByText('Test')).toHaveStyle(
      `max-width: ${CENTER_PANEL_DEFAULT_WIDTH + 20}px`
    );
  });

  it('applies correct styles when isRightPanelCollapsed is true', () => {
    const { getByText } = render(
      <SizeAwareElement isRightPanelCollapsed isLeftPanelCollapsed={false}>
        Test
      </SizeAwareElement>
    );

    expect(getByText('Test')).toHaveStyle(
      `max-width: ${CENTER_PANEL_DEFAULT_WIDTH + 20}px`
    );
  });

  it('applies correct styles when isRightPanelCollapsed and isLeftPanelCollapsed is true', () => {
    const { getByText } = render(
      <SizeAwareElement isLeftPanelCollapsed isRightPanelCollapsed>
        Test
      </SizeAwareElement>
    );

    expect(getByText('Test')).toHaveStyle(
      `max-width: ${CENTER_PANEL_DEFAULT_WIDTH + 100}px`
    );
  });

  it('applies correct styles when dimensions are provided', () => {
    const dimensions = { width: 800, height: 600 };
    const { getByText } = render(
      <SizeAwareElement
        dimensions={dimensions}
        isLeftPanelCollapsed={false}
        isRightPanelCollapsed={false}>
        Test
      </SizeAwareElement>
    );

    expect(getByText('Test')).toHaveStyle(
      `max-width: ${dimensions.width - CENTER_PANEL_PANEL_MARGIN}px`
    );
  });
});
