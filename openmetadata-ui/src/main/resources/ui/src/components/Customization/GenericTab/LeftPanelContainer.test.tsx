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
import { act, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { Layout } from 'react-grid-layout';
import { PageType } from '../../../generated/system/ui/page';
import { LeftPanelContainer } from './LeftPanelContainer';

const mockGridProps: {
  current?: {
    children?: ReactNode;
    layout?: Layout[];
    onLayoutChange?: (layout: Layout[]) => void;
  };
} = {};

jest.mock('../../../hooks/useGridLayoutDirection');

jest.mock('../../../utils/CustomizePage/CustomizePageDispatchUtils', () => ({
  getWidgetsFromKey: jest.fn(),
}));

jest.mock('../GenericWidget/GenericWidget', () => ({
  GenericWidget: () => null,
}));

jest.mock('react-grid-layout', () => ({
  WidthProvider: jest.fn().mockImplementation(() =>
    jest.fn().mockImplementation((props) => {
      mockGridProps.current = props;

      return (
        <div
          className={props.className}
          data-cols={props.cols}
          data-container-padding={props.containerPadding.join(',')}
          data-testid="react-grid-layout">
          {props.children}
        </div>
      );
    })
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

  it('shows widgets in view mode by row and then column, not saved order', () => {
    // Saved as the edit grid leaves a widget dropped below Description: first.
    const { container } = render(
      <LeftPanelContainer
        {...commonProps}
        isEditView={false}
        layout={[
          { i: 'KnowledgePanel.Domain', x: 0.5, y: 2, w: 0.5, h: 2 },
          { i: 'KnowledgePanel.Description', x: 0, y: 0, w: 1, h: 2 },
          { i: 'KnowledgePanel.Tags', x: 0, y: 2, w: 0.5, h: 2 },
        ]}
      />
    );

    expect(
      Array.from(container.firstElementChild?.children ?? [], ({ id }) => id)
    ).toEqual([
      'KnowledgePanel.Description',
      'KnowledgePanel.Tags',
      'KnowledgePanel.Domain',
    ]);
  });

  it('applies left panel padding in edit mode', () => {
    render(<LeftPanelContainer {...commonProps} isEditView />);

    expect(screen.getByTestId('react-grid-layout')).toHaveAttribute(
      'data-container-padding',
      '16,16'
    );
  });

  it('edits the card on the columns it spans, in the layout view mode draws', () => {
    const onUpdate = jest.fn();
    render(
      <LeftPanelContainer
        isEditView
        editColumns={6}
        layout={[
          { i: 'KnowledgePanel.Description', x: 0, y: 0, w: 1, h: 2 },
          { i: 'KnowledgePanel.Tags', x: 0.5, y: 2, w: 0.5, h: 2 },
        ]}
        type={PageType.GlossaryTerm}
        onUpdate={onUpdate}
      />
    );

    expect(screen.getByTestId('react-grid-layout')).toHaveAttribute(
      'data-cols',
      '6'
    );
    // Tags alone in the right half is a gap view mode cannot draw, so the
    // edit grid shows it on the left.
    expect(mockGridProps.current?.layout).toEqual([
      { i: 'KnowledgePanel.Description', x: 0, y: 0, w: 6, h: 2 },
      { i: 'KnowledgePanel.Tags', x: 0, y: 2, w: 3, h: 2 },
    ]);

    // Tags resized to four of the six columns and moved one column in.
    act(() =>
      mockGridProps.current?.onLayoutChange?.([
        { i: 'KnowledgePanel.Description', x: 0, y: 0, w: 6, h: 2 },
        { i: 'KnowledgePanel.Tags', x: 1, y: 2, w: 4, h: 2 },
      ])
    );

    expect(onUpdate).toHaveBeenCalledWith([
      { i: 'KnowledgePanel.Description', x: 0, y: 0, w: 1, h: 2 },
      { i: 'KnowledgePanel.Tags', x: 0, y: 2, w: 4 / 6, h: 2 },
    ]);
  });
});
