/*
 *  Copyright 2025 Collate.
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { getLineagePagingData } from '../../../rest/lineageAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import LineageSection from './LineageSection';

jest.mock('../../../assets/svg/lineage-upstream-icon.svg', () => ({
  ReactComponent: () => <div data-testid="upstream-icon">Upstream</div>,
}));

jest.mock('../../../assets/svg/lineage-downstream-icon.svg', () => ({
  ReactComponent: () => <div data-testid="downstream-icon">Downstream</div>,
}));

jest.mock('../../../rest/lineageAPI', () => ({
  getLineagePagingData: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../Loader/Loader', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="loader">Loading...</div>);
});

describe('LineageSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and "no lineage available" when entity is not provided', () => {
    render(<LineageSection />);

    expect(screen.getByText('label.lineage')).toBeInTheDocument();
    expect(
      screen.getByText('message.no-lineage-available')
    ).toBeInTheDocument();
    expect(getLineagePagingData).not.toHaveBeenCalled();
  });

  it('shows loader while lineage paging info is being fetched', async () => {
    let resolvePromise: (value: unknown) => void = () => {
      throw new Error('resolvePromise was not initialized');
    };
    const pending = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    (getLineagePagingData as jest.Mock).mockReturnValue(pending);

    render(
      <LineageSection
        entityFqn="service.db.schema.table"
        entityType={EntityType.TABLE}
      />
    );

    expect(await screen.findByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByTestId('upstream-lineage')).not.toBeInTheDocument();
    expect(screen.queryByTestId('downstream-lineage')).not.toBeInTheDocument();

    resolvePromise({
      upstreamDepthInfo: [{ depth: 1, entityCount: 0 }],
      downstreamDepthInfo: [{ depth: 1, entityCount: 0 }],
      maxDownstreamDepth: 1,
      maxUpstreamDepth: 1,
      totalDownstreamEntities: 0,
      totalUpstreamEntities: 0,
    });

    await waitFor(() =>
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument()
    );
  });

  it('renders "no lineage available" when both counts are zero', async () => {
    (getLineagePagingData as jest.Mock).mockResolvedValue({
      upstreamDepthInfo: [{ depth: 1, entityCount: 0 }],
      downstreamDepthInfo: [{ depth: 1, entityCount: 0 }],
      maxDownstreamDepth: 1,
      maxUpstreamDepth: 1,
      totalDownstreamEntities: 0,
      totalUpstreamEntities: 0,
    });

    render(
      <LineageSection
        entityFqn="service.db.schema.table"
        entityType={EntityType.TABLE}
      />
    );

    expect(screen.getByText('label.lineage')).toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.getByText('message.no-lineage-available')
      ).toBeInTheDocument()
    );
  });

  it('renders upstream/downstream sections and counts when lineage exists', async () => {
    (getLineagePagingData as jest.Mock).mockResolvedValue({
      upstreamDepthInfo: [{ depth: 1, entityCount: 22 }],
      downstreamDepthInfo: [{ depth: 1, entityCount: 12 }],
      maxDownstreamDepth: 2,
      maxUpstreamDepth: 2,
      totalDownstreamEntities: 12,
      totalUpstreamEntities: 22,
    });

    const { container } = render(
      <LineageSection
        entityFqn="service.db.schema.table"
        entityType={EntityType.TABLE}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('upstream-lineage')).toBeInTheDocument()
    );

    expect(screen.getByTestId('downstream-lineage')).toBeInTheDocument();
    expect(screen.getByTestId('upstream-count')).toHaveTextContent('22');
    expect(screen.getByTestId('downstream-count')).toHaveTextContent('12');

    // Divider exists between sections
    expect(container.querySelector('.MuiDivider-root')).toBeInTheDocument();
  });

  it('renders both sections even when one side is zero', async () => {
    (getLineagePagingData as jest.Mock).mockResolvedValue({
      upstreamDepthInfo: [{ depth: 1, entityCount: 15 }],
      downstreamDepthInfo: [{ depth: 1, entityCount: 0 }],
      maxDownstreamDepth: 1,
      maxUpstreamDepth: 2,
      totalDownstreamEntities: 0,
      totalUpstreamEntities: 15,
    });

    render(
      <LineageSection
        entityFqn="service.db.schema.table"
        entityType={EntityType.TABLE}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('upstream-lineage')).toBeInTheDocument()
    );

    expect(screen.getByTestId('downstream-lineage')).toBeInTheDocument();
    expect(screen.getByTestId('upstream-count')).toHaveTextContent('15');
    expect(screen.getByTestId('downstream-count')).toHaveTextContent('0');
  });

  it('calls onLineageClick when either lineage section is clicked', async () => {
    (getLineagePagingData as jest.Mock).mockResolvedValue({
      upstreamDepthInfo: [{ depth: 1, entityCount: 10 }],
      downstreamDepthInfo: [{ depth: 1, entityCount: 5 }],
      maxDownstreamDepth: 1,
      maxUpstreamDepth: 1,
      totalDownstreamEntities: 5,
      totalUpstreamEntities: 10,
    });

    const onLineageClick = jest.fn();

    render(
      <LineageSection
        entityFqn="service.db.schema.table"
        entityType={EntityType.TABLE}
        onLineageClick={onLineageClick}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('upstream-lineage')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('upstream-lineage'));
    fireEvent.click(screen.getByTestId('downstream-lineage'));

    expect(onLineageClick).toHaveBeenCalled();
  });

  it('shows error toast and falls back to "no lineage available" when API fails', async () => {
    (getLineagePagingData as jest.Mock).mockRejectedValueOnce(
      new Error('boom')
    );

    render(
      <LineageSection
        entityFqn="service.db.schema.table"
        entityType={EntityType.TABLE}
      />
    );

    await waitFor(() =>
      expect(showErrorToast as unknown as jest.Mock).toHaveBeenCalled()
    );

    expect(
      screen.getByText('message.no-lineage-available')
    ).toBeInTheDocument();
  });

  it('calls getLineagePagingData with fqn and type', async () => {
    (getLineagePagingData as jest.Mock).mockResolvedValue({
      upstreamDepthInfo: [{ depth: 1, entityCount: 0 }],
      downstreamDepthInfo: [{ depth: 1, entityCount: 0 }],
      maxDownstreamDepth: 1,
      maxUpstreamDepth: 1,
      totalDownstreamEntities: 0,
      totalUpstreamEntities: 0,
    });

    render(
      <LineageSection
        entityFqn="service.db.schema.table"
        entityType={EntityType.TABLE}
      />
    );

    await waitFor(() =>
      expect(getLineagePagingData).toHaveBeenCalledWith({
        fqn: 'service.db.schema.table',
        type: EntityType.TABLE,
      })
    );
  });
});
