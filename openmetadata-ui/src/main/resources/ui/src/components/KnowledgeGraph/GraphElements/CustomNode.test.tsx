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

import { NodeData } from '@antv/g6';
import { render, screen } from '@testing-library/react';
import React from 'react';
import CustomNode from './CustomNode';

jest.mock('@antv/g6', () => ({}));

jest.mock('../../../utils/TableUtils', () => ({
  getEntityIcon: jest.fn(() => <svg data-testid="entity-icon" />),
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const R = require('react');

  return {
    Box: ({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>) =>
      R.createElement('div', p, children),
    Typography: ({
      children,
      'data-testid': testId,
      style,
      ...p
    }: React.PropsWithChildren<{ 'data-testid'?: string; style?: React.CSSProperties }>) =>
      R.createElement('span', { 'data-testid': testId, style, ...p }, children),
  };
});

import { getEntityIcon } from '../../../utils/TableUtils';

function makeNodeData(
  overrides: Record<string, unknown> = {},
  id = 'node-1'
): NodeData {
  return {
    id,
    data: {
      label: 'TestNode',
      type: 'table',
      ...overrides,
    },
  } as NodeData;
}

describe('CustomNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getEntityIcon as jest.Mock).mockReturnValue(
      <svg data-testid="entity-icon" />
    );
  });

  describe('Basic rendering', () => {
    it('renders without crashing with minimal props', () => {
      render(<CustomNode nodeData={makeNodeData()} />);

      expect(screen.getByTestId('node-TestNode')).toBeInTheDocument();
    });

    it('renders label from nodeData.data.label', () => {
      render(<CustomNode nodeData={makeNodeData({ label: 'MyTable' })} />);

      expect(screen.getByTestId('label')).toHaveTextContent('MyTable');
    });

    it('renders type text in type-tag', () => {
      render(<CustomNode nodeData={makeNodeData({ type: 'pipeline' })} />);

      expect(screen.getByTestId('type-tag')).toHaveTextContent('pipeline');
    });

    it('sets data-node-id attribute to nodeData.id', () => {
      render(<CustomNode nodeData={makeNodeData({}, 'abc-123')} />);

      expect(screen.getByTestId('node-TestNode')).toHaveAttribute(
        'data-node-id',
        'abc-123'
      );
    });

    it('sets data-testid to "node-{label}" on root div', () => {
      render(<CustomNode nodeData={makeNodeData({ label: 'SomeLabel' })} />);

      expect(screen.getByTestId('node-SomeLabel')).toBeInTheDocument();
    });

    it('exposes data-testid="label" on the label element', () => {
      render(<CustomNode nodeData={makeNodeData()} />);

      expect(screen.getByTestId('label')).toBeInTheDocument();
    });

    it('exposes data-testid="type-tag" on the type element', () => {
      render(<CustomNode nodeData={makeNodeData()} />);

      expect(screen.getByTestId('type-tag')).toBeInTheDocument();
    });
  });

  describe('Highlighted state', () => {
    it('does NOT add highlighted class when highlighted is undefined', () => {
      render(<CustomNode nodeData={makeNodeData()} />);

      expect(screen.getByTestId('node-TestNode')).not.toHaveClass('highlighted');
    });

    it('does NOT add highlighted class when highlighted is false', () => {
      render(<CustomNode nodeData={makeNodeData({ highlighted: false })} />);

      expect(screen.getByTestId('node-TestNode')).not.toHaveClass('highlighted');
    });

    it('DOES add highlighted class when highlighted is true', () => {
      render(<CustomNode nodeData={makeNodeData({ highlighted: true })} />);

      expect(screen.getByTestId('node-TestNode')).toHaveClass('highlighted');
    });
  });

  describe('Custom color styles', () => {
    it('applies colorMain and colorLight as inline style on type-tag when both provided', () => {
      render(
        <CustomNode
          nodeData={makeNodeData({
            colorMain: '#1677ff',
            colorLight: '#e6f4ff',
          })}
        />
      );

      const tag = screen.getByTestId('type-tag');

      expect(tag).toHaveStyle({ color: '#1677ff', backgroundColor: '#e6f4ff' });
    });

    it('sets border:none on type-tag when both colors provided', () => {
      render(
        <CustomNode
          nodeData={makeNodeData({
            colorMain: '#1677ff',
            colorLight: '#e6f4ff',
          })}
        />
      );

      expect(screen.getByTestId('type-tag')).toHaveStyle({ border: 'none' });
    });

    it('does NOT apply inline style when only colorMain is provided', () => {
      render(
        <CustomNode nodeData={makeNodeData({ colorMain: '#1677ff' })} />
      );

      expect(screen.getByTestId('type-tag')).not.toHaveStyle({
        color: '#1677ff',
      });
    });

    it('does NOT apply inline style when only colorLight is provided', () => {
      render(
        <CustomNode nodeData={makeNodeData({ colorLight: '#e6f4ff' })} />
      );

      expect(screen.getByTestId('type-tag')).not.toHaveStyle({
        backgroundColor: '#e6f4ff',
      });
    });

    it('does NOT apply inline style when neither color is provided', () => {
      render(<CustomNode nodeData={makeNodeData()} />);
      const tag = screen.getByTestId('type-tag');

      expect(tag.getAttribute('style')).toBeFalsy();
    });
  });

  describe('Icon rendering', () => {
    it('calls getEntityIcon with the node type string', () => {
      render(<CustomNode nodeData={makeNodeData({ type: 'dashboard' })} />);

      expect(getEntityIcon).toHaveBeenCalledWith(
        'dashboard',
        '',
        expect.objectContaining({ width: 12, height: 12 })
      );
    });

    it('renders the icon returned by getEntityIcon', () => {
      render(<CustomNode nodeData={makeNodeData()} />);

      expect(screen.getByTestId('entity-icon')).toBeInTheDocument();
    });
  });
});
