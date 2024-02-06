/*
 *  Copyright 2024 Collate.
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
import React from 'react';
import PanelContainer from './PanelContainer';

const mockProps = {
  className: 'test-class',
  dimensions: { width: 500, height: 500 },
  overlay: {
    displayThreshold: 400,
    header: 'Test Header',
  },
};

describe('PanelContainer', () => {
  it('should renders PanelContainer', () => {
    const { getByTestId } = render(
      <PanelContainer {...mockProps}>
        <div>Child Component</div>
      </PanelContainer>
    );

    expect(getByTestId('panel-container')).toBeInTheDocument();
  });

  it('should render overlay when dimensions width is less than displayThreshold', () => {
    const overlay = {
      displayThreshold: 500,
      header: 'Test Header',
    };
    const dimensions = { width: 400, height: 500 };

    const { getByText } = render(
      <PanelContainer dimensions={dimensions} overlay={overlay}>
        <div>Child Component</div>
      </PanelContainer>
    );

    expect(getByText('Test Header')).toBeInTheDocument();
  });

  it('should not render overlay when width is greater than displayThreshold', () => {
    const { queryByText } = render(
      <PanelContainer {...mockProps}>
        <div>Child Component</div>
      </PanelContainer>
    );

    expect(queryByText('Test Header')).toBeNull();
  });

  it('should pass className to div', () => {
    const { container } = render(
      <PanelContainer className="test-class">
        <div>Child Component</div>
      </PanelContainer>
    );

    expect(container.querySelector('.test-class')).toBeInTheDocument();
  });
});
