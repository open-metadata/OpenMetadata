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
import { useIsAiMode } from '../../../../hooks/useAppMode';
import OntologyStudioSubBar from './OntologyStudioSubBar';

jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

const surfaces = [
  { id: 'graph', label: 'Graph' },
  { id: 'tree', label: 'Tree' },
];

const renderSubBar = (onSurfaceChange = jest.fn()) =>
  render(
    <OntologyStudioSubBar
      caption="Explore"
      surface="graph"
      surfaces={surfaces}
      trailing={<span data-testid="subbar-stats">3 concepts</span>}
      onSurfaceChange={onSurfaceChange}>
      <input aria-label="Find a term" data-testid="subbar-search" />
    </OntologyStudioSubBar>
  );

describe('OntologyStudioSubBar', () => {
  afterEach(() => {
    (useIsAiMode as jest.Mock).mockReturnValue(false);
  });

  it('shows the visible caption in classic mode', () => {
    renderSubBar();

    expect(screen.getByText('Explore')).toBeInTheDocument();
  });

  it('keeps surfaces, children and trailing content in AI mode', () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    const onSurfaceChange = jest.fn();
    renderSubBar(onSurfaceChange);

    expect(screen.queryByText('Explore')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Explore' })).toBeVisible();
    expect(screen.getByTestId('subbar-search')).toBeInTheDocument();
    expect(screen.getByTestId('subbar-stats')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('submode-tab-tree'));

    expect(onSurfaceChange).toHaveBeenCalledWith('tree');
  });
});
