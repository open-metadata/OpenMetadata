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
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import AssetHealthWidget from './AssetHealthWidget.component';
import { AssetHealthState, HealthRow } from './AssetHealthWidget.interface';

const mockUseGenericContext = jest.fn();
const mockUseAssetHealth = jest.fn();

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: () => mockUseGenericContext(),
}));

jest.mock('./useAssetHealth', () => ({
  useAssetHealth: (...args: unknown[]) => mockUseAssetHealth(...args),
}));

const baseRow = (
  overrides: Partial<HealthRow> & Pick<HealthRow, 'key'>
): HealthRow => ({
  label: 'Row',
  status: 'Healthy',
  tone: 'success',
  icon: <svg data-testid={`icon-${overrides.key}`} />,
  ...overrides,
});

const renderWidget = (state: AssetHealthState) => {
  mockUseGenericContext.mockReturnValue({
    data: {
      id: 'entity-1',
      fullyQualifiedName: 'service.db.schema.table',
    },
    type: EntityType.TABLE,
  });
  mockUseAssetHealth.mockReturnValue(state);

  return render(<AssetHealthWidget />, { wrapper: MemoryRouter });
};

describe('AssetHealthWidget', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders a row for every health row provided by the hook', () => {
    renderWidget({
      rows: [
        baseRow({ key: 'contract', label: 'Contract' }),
        baseRow({ key: 'dataQuality', label: 'Data Quality', tone: 'error' }),
      ],
      header: { label: 'Attention', tone: 'error' },
      loading: false,
    });

    expect(screen.getByTestId('asset-health-widget')).toBeInTheDocument();
    expect(screen.getByTestId('asset-health-row-contract')).toBeInTheDocument();
    expect(
      screen.getByTestId('asset-health-row-dataQuality')
    ).toBeInTheDocument();
    expect(screen.getByTestId('asset-health-header-pill')).toHaveTextContent(
      'Attention'
    );
  });

  it('renders muted rows with their CTA pill instead of a status pill', () => {
    renderWidget({
      rows: [
        baseRow({
          key: 'dataQuality',
          label: 'Data Quality',
          status: 'No tests',
          cta: 'Add tests',
          tone: 'muted',
          href: '/dq',
        }),
      ],
      header: { label: 'Not set up', tone: 'muted' },
      loading: false,
    });

    expect(screen.getByText('Add tests')).toBeInTheDocument();
    expect(screen.queryByText('No tests')).not.toBeInTheDocument();
  });

  it('renders nothing when no rows are returned and loading is finished', () => {
    const { container } = renderWidget({
      rows: [],
      header: { label: 'Not set up', tone: 'muted' },
      loading: false,
    });

    expect(container.firstChild).toBeNull();
  });

  it('uses external link target when the row is marked external', () => {
    renderWidget({
      rows: [
        baseRow({
          key: 'pipeline',
          label: 'Pipeline',
          href: 'https://snowflake.example/pipeline/123',
          external: true,
        }),
      ],
      header: { label: 'All clear', tone: 'success' },
      loading: false,
    });

    const link = screen.getByTestId('asset-health-row-pipeline').closest('a');

    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute(
      'href',
      'https://snowflake.example/pipeline/123'
    );
  });
});
