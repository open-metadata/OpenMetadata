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
import { StatusType } from '../../../../generated/entity/data/pipeline';
import { EXECUTION_LIST_MOCK } from '../../../../mocks/PipelineVersion.mock';
import ListView from './ListViewTab.component';

jest.mock('../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>FilterTablePlaceHolder</div>)
);

jest.mock('../../../common/SearchBarComponent/SearchBar.component', () =>
  jest.fn().mockImplementation(() => <div>SearchBar</div>)
);

jest.mock('../../../../utils/executionUtils', () => ({
  getTableViewData: jest.fn().mockImplementation((data) => data),
  StatusIndicator: jest
    .fn()
    .mockImplementation(() => <div>StatusIndicator</div>),
}));

const mockProps = {
  executions: EXECUTION_LIST_MOCK,
  status: StatusType.Successful,
  loading: false,
  searchString: undefined,
  handleSearch: jest.fn(),
};

describe('Test ListViewTab Component', () => {
  it('Should render loader in table component', async () => {
    render(<ListView {...mockProps} loading />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('Should render component properly if not loading', async () => {
    render(<ListView {...mockProps} />);

    expect(screen.getByTestId('list-view-table')).toBeInTheDocument();
  });

  it('Should render NoDataPlaceholder if no data present', async () => {
    render(<ListView {...mockProps} executions={[]} />);

    expect(screen.getByTestId('list-view-table')).toBeInTheDocument();

    expect(screen.getByText('FilterTablePlaceHolder')).toBeInTheDocument();
  });

  it('Should render columns if data present', async () => {
    render(<ListView {...mockProps} />);

    expect(screen.getByTestId('list-view-table')).toBeInTheDocument();

    expect(
      screen.queryByText('FilterTablePlaceHolder')
    ).not.toBeInTheDocument();

    expect(screen.getAllByText('StatusIndicator')).toHaveLength(7);
  });
});
