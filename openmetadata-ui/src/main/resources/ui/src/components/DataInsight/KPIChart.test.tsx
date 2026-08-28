/*
 *  Copyright 2023 Collate.
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
import { act } from 'react-test-renderer';
import { KPI_LIST } from '../../pages/KPIPage/KPIMock.mock';
import KPIChart from './KPIChart';

jest.mock('../../rest/KpiAPI', () => ({
  getListKPIs: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: KPI_LIST })),
}));

describe('Test KPIChart Component', () => {
  const mockProps = {
    chartFilter: {
      startTs: 1234567890,
      endTs: 1234567899,
    },
    kpiList: KPI_LIST,
    isKpiLoading: false,
    viewKPIPermission: true,
    createKPIPermission: true,
  };

  it('Should render KPIChart component', async () => {
    await act(async () => {
      render(<KPIChart {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const kpiCard = screen.getByTestId('kpi-card');

    expect(kpiCard).toBeInTheDocument();
  });

  it('Should render EmptyGraphPlaceholder when no data is available', async () => {
    await act(async () => {
      render(<KPIChart {...mockProps} kpiList={[]} />, {
        wrapper: MemoryRouter,
      });
    });

    const emptyPlaceholder = screen.getByText(
      'message.no-kpi-available-add-new-one'
    );

    expect(emptyPlaceholder).toBeInTheDocument();
  });

  it('Should render "Add KPI" button when no KPIs exist and user has create permission', async () => {
    await act(async () => {
      render(<KPIChart {...mockProps} kpiList={[]} />, {
        wrapper: MemoryRouter,
      });
    });

    const addButton = screen.getByText('label.add-entity');

    expect(addButton).toBeInTheDocument();
  });

  it('Should not render "Add KPI" button when no create permission', async () => {
    await act(async () => {
      render(
        <KPIChart {...mockProps} createKPIPermission={false} kpiList={[]} />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const addButton = screen.queryByText('label.add-entity');

    expect(addButton).not.toBeInTheDocument();
  });
});
