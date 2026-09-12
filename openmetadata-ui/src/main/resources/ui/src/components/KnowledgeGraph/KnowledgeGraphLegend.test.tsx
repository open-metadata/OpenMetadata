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

import { fireEvent, render, screen } from '@testing-library/react';
import { RelationCategory } from './KnowledgeGraph.relations';
import KnowledgeGraphLegend from './KnowledgeGraphLegend';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(() => ({ t: (key: string) => key })),
}));

const noCounts: Record<RelationCategory, number> = {
  lineage: 0,
  structure: 0,
  ontology: 0,
  governance: 0,
  ownership: 0,
  quality: 0,
  other: 0,
};

const renderLegend = (
  counts: Partial<Record<RelationCategory, number>> = {},
  isCollapsed = false,
  hiddenCount = 0
) => {
  const onToggleCollapsed = jest.fn();
  const result = render(
    <KnowledgeGraphLegend
      counts={{ ...noCounts, ...counts }}
      hiddenCount={hiddenCount}
      isCollapsed={isCollapsed}
      onToggleCollapsed={onToggleCollapsed}
    />
  );

  return { ...result, onToggleCollapsed };
};

describe('KnowledgeGraphLegend', () => {
  it('renders nothing when the graph has no relations', () => {
    renderLegend();

    expect(screen.queryByTestId('knowledge-graph-legend')).toBeNull();
  });

  it('lists only the relation families present in the graph', () => {
    renderLegend({ lineage: 3, ownership: 1 });

    expect(screen.getByTestId('legend-item-lineage')).toBeInTheDocument();
    expect(screen.getByTestId('legend-item-ownership')).toBeInTheDocument();
    expect(screen.queryByTestId('legend-item-quality')).toBeNull();
    expect(screen.queryByTestId('legend-item-structure')).toBeNull();
  });

  it('shows the edge count for each listed family', () => {
    renderLegend({ lineage: 3, ontology: 12 });

    expect(screen.getByTestId('legend-count-lineage')).toHaveTextContent('3');
    expect(screen.getByTestId('legend-count-ontology')).toHaveTextContent('12');
  });

  it('draws a colour sample for each family so the encoding is decodable', () => {
    renderLegend({ lineage: 1, ontology: 1 });
    const lines = screen
      .getByTestId('knowledge-graph-legend-items')
      .querySelectorAll('svg line');

    expect(lines).toHaveLength(2);
    expect(lines[0].getAttribute('stroke')).not.toBe(
      lines[1].getAttribute('stroke')
    );
  });

  it('gives a dashed family a dash array and lineage none', () => {
    const first = renderLegend({ lineage: 1 });

    expect(
      screen
        .getByTestId('legend-item-lineage')
        .querySelector('svg line')
        ?.getAttribute('stroke-dasharray')
    ).toBeNull();

    first.unmount();
    renderLegend({ ontology: 1 });

    expect(
      screen
        .getByTestId('legend-item-ontology')
        .querySelector('svg line')
        ?.getAttribute('stroke-dasharray')
    ).toBeTruthy();
  });

  it('hides the item list when collapsed but keeps the toggle reachable', () => {
    renderLegend({ lineage: 1 }, true);

    expect(screen.queryByTestId('knowledge-graph-legend-items')).toBeNull();
    expect(
      screen.getByTestId('knowledge-graph-legend-toggle')
    ).toBeInTheDocument();
  });

  it('reports its expanded state to assistive technology', () => {
    renderLegend({ lineage: 1 }, true);

    expect(screen.getByTestId('knowledge-graph-legend-toggle')).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('calls back when the header is pressed', () => {
    const { onToggleCollapsed } = renderLegend({ lineage: 1 });

    fireEvent.click(screen.getByTestId('knowledge-graph-legend-toggle'));

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });
});

describe('KnowledgeGraphLegend label', () => {
  it('counts the families on screen and only mentions the total once some are hidden', () => {
    const { unmount } = renderLegend({ lineage: 3, ownership: 1 });

    expect(
      screen.getByTestId('knowledge-graph-legend-toggle')
    ).toHaveTextContent('label.kg-family-count');

    unmount();

    renderLegend({ lineage: 3 }, false, 1);

    expect(
      screen.getByTestId('knowledge-graph-legend-toggle')
    ).toHaveTextContent('label.kg-family-of-count');
  });
});
