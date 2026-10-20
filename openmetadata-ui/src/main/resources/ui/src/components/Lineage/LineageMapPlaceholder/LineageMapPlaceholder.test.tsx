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
import { AxiosError } from 'axios';
import {
  LineageBand,
  LineageLens,
  LineageScene,
} from '../../../generated/api/lineage/lineageScene';
import LineageMapPlaceholder from './LineageMapPlaceholder';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../LineageSkeleton.component', () =>
  jest.fn(() => <div data-testid="lineage-skeleton" />)
);

const emptyScene = {
  lens: LineageLens.Service,
  band: LineageBand.Asset,
  nodes: [],
  edges: [],
} as unknown as LineageScene;

describe('LineageMapPlaceholder', () => {
  it('shows the skeleton while the first scene loads', () => {
    render(<LineageMapPlaceholder loading onRetry={jest.fn()} />);

    expect(screen.getByTestId('lineage-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-placeholder')).not.toBeInTheDocument();
  });

  it('shows the no-data placeholder for an empty scene', () => {
    render(
      <LineageMapPlaceholder
        loading={false}
        scene={emptyScene}
        onRetry={jest.fn()}
      />
    );

    expect(
      screen.getByText('message.no-lineage-data-available')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('lineage-map-retry')).not.toBeInTheDocument();
  });

  it('offers a retry when the scene request fails', () => {
    const onRetry = jest.fn();

    render(
      <LineageMapPlaceholder
        error={new AxiosError('boom')}
        loading={false}
        onRetry={onRetry}
      />
    );

    expect(
      screen.getByText('message.something-went-wrong')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('lineage-map-retry'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
