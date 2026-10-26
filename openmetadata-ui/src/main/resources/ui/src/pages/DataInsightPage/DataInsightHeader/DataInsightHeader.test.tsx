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
import { fireEvent, render, screen } from '@testing-library/react';
import { ROUTES } from '../../../constants/constants';
import dataInsightClassBase from '../DataInsightClassBase';
import DataInsightHeader from './DataInsightHeader.component';

const mockNavigate = jest.fn();
const mockShowModal = jest.fn();
const mockUseParams = jest.fn(() => ({ tab: 'tab' }));
const HOOK_ERROR =
  /Do not call Hooks|change in the order of Hooks|Rendered (more|fewer) hooks/;

// A real context read stands in for the provider, so a call that moves back
// inside a memo (or a menu helper it runs) trips React's hook-order checks.
jest.mock(
  '../../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => {
    const { createContext, useContext } = jest.requireActual('react');
    const context = createContext({
      showModal: (data: unknown) => mockShowModal(data),
    });

    return { useEntityExportModalProvider: () => useContext(context) };
  }
);

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useParams: () => mockUseParams(),
}));

jest.mock('../../../components/DataInsight/DataInsightSummary', () =>
  jest.fn(() => <div>DataInsightSummary</div>)
);

jest.mock('../../../components/DataInsight/KPIChart', () =>
  jest.fn(() => <div>KPIChart</div>)
);

jest.mock(
  '../../../components/common/DatePickerMenu/DatePickerMenu.component',
  () => jest.fn(() => <div>DatePickerMenu</div>)
);

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(() => ({
    permissions: {},
  })),
}));

jest.mock(
  '../../../components/common/FilterSelectDropdown/FilterSelectDropdown',
  () => jest.fn(() => <div>SearchDropdown</div>)
);

jest.mock('../../../utils/DataInsightPureUtils', () => ({
  getOptionalDataInsightTabFlag: jest.fn(() => ({
    showDataInsightSummary: true,
    showKpiChart: true,
  })),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  formatDate: jest.fn().mockReturnValue('formattedDate'),
  getEpochMillisForPastDays: jest.fn().mockReturnValue(0),
  getStartOfDayInMillis: jest.fn().mockReturnValue(0),
  getEndOfDayInMillis: jest.fn().mockReturnValue(0),
  getCurrentMillis: jest.fn().mockReturnValue(0),
}));

jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../DataInsightProvider', () => ({
  useDataInsightProvider: jest
    .fn()
    .mockReturnValue({ chartFilter: {}, kpi: {} }),
}));

jest.mock('../../../constants/constants', () => ({
  ...jest.requireActual('../../../constants/constants'),
}));

jest.mock(
  '../../../components/common/EntityPageInfos/ManageButton/ManageButton',
  () => jest.fn(() => <div>ManageButton</div>)
);

jest.mock('../DataInsightClassBase', () => ({
  getManageExtraOptions: jest.fn().mockReturnValue([]),
}));

const mockProps = {
  onScrollToChart: jest.fn(),
};

describe('DataInsightHeader component', () => {
  it('should render all necessary elements', () => {
    render(<DataInsightHeader {...mockProps} />);

    expect(screen.getByText('label.data-insight-plural')).toBeInTheDocument();
    expect(
      screen.getByText('message.data-insight-subtitle')
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'label.add-entity',
      })
    );

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.ADD_KPI);

    expect(screen.getAllByText('SearchDropdown')).toHaveLength(2);
    expect(
      screen.getByText('formattedDate - formattedDate')
    ).toBeInTheDocument();
    expect(screen.getByText('DatePickerMenu')).toBeInTheDocument();
    expect(screen.getByText('DataInsightSummary')).toBeInTheDocument();
    expect(screen.getByText('KPIChart')).toBeInTheDocument();
  });

  it('should read the export modal hook outside the menu memo and hand its showModal to the menu builder', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error');
    const exportData = { name: 'data-insight', onExport: jest.fn() };

    const { rerender } = render(<DataInsightHeader {...mockProps} />);
    mockUseParams.mockReturnValue({ tab: 'other-tab' });
    rerender(<DataInsightHeader {...mockProps} />);

    const [showModal] = (
      dataInsightClassBase.getManageExtraOptions as jest.Mock
    ).mock.calls.at(-1);
    showModal(exportData);

    expect(mockShowModal).toHaveBeenCalledWith(exportData);
    expect(
      consoleErrorSpy.mock.calls.filter(([message]) =>
        HOOK_ERROR.test(String(message))
      )
    ).toEqual([]);

    consoleErrorSpy.mockRestore();
  });
});
