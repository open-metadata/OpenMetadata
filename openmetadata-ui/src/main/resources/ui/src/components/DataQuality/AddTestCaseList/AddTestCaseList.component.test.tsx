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
import {
  act,
  fireEvent,
  queryByAttribute,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { EntityReference } from '../../../generated/tests/testCase';
import { AddTestCaseList } from './AddTestCaseList.component';
import { AddTestCaseModalProps } from './AddTestCaseList.interface';

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest.fn().mockImplementation(() => <div>Error Placeholder Mock</div>);
});

jest.mock('../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader Mock</div>);
});

jest.mock('../../common/SearchBarComponent/SearchBar.component', () => {
  return jest.fn().mockImplementation(() => <div>Search Bar Mock</div>);
});
jest.mock('../../../utils/StringsUtils', () => {
  return {
    replacePlus: jest.fn().mockImplementation((fqn) => fqn),
  };
});
jest.mock('../../../utils/FeedUtils', () => {
  return {
    getEntityFQN: jest.fn().mockImplementation((fqn) => fqn),
  };
});
jest.mock('../../../utils/EntityUtils', () => {
  return {
    getEntityName: jest
      .fn()
      .mockImplementation(
        (entity: EntityReference) => entity?.displayName ?? entity?.name
      ),
    getColumnNameFromEntityLink: jest.fn().mockImplementation((fqn) => fqn),
  };
});
jest.mock('../../../utils/CommonUtils', () => {
  return {
    getNameFromFQN: jest.fn().mockImplementation((fqn) => fqn),
  };
});
jest.mock('../../../rest/testAPI', () => {
  return {
    getListTestCaseBySearch: jest.fn().mockResolvedValue({
      data: [],
      paging: {
        total: 0,
      },
    }),
  };
});

jest.mock('../../../constants/constants', () => ({
  getEntityDetailsPath: jest.fn(),
  PAGE_SIZE_MEDIUM: 25,
}));

const mockProps: AddTestCaseModalProps = {
  onCancel: jest.fn(),
  onSubmit: jest.fn(),
  cancelText: 'Cancel',
  submitText: 'Submit',
  selectedTest: [],
  onChange: jest.fn(),
  showButton: true,
};

jest.mock('../../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn(),
}));

describe('AddTestCaseList', () => {
  it('renders the component', async () => {
    await act(async () => {
      render(<AddTestCaseList {...mockProps} />);
    });

    expect(screen.getByText('Search Bar Mock')).toBeInTheDocument();
    expect(screen.getByTestId('cancel')).toBeInTheDocument();
    expect(screen.getByTestId('submit')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    await act(async () => {
      render(<AddTestCaseList {...mockProps} />);
    });
    fireEvent.click(screen.getByTestId('cancel'));

    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it('calls onSubmit when submit button is clicked', async () => {
    await act(async () => {
      render(<AddTestCaseList {...mockProps} />);
    });
    const submitBtn = screen.getByTestId('submit');
    fireEvent.click(submitBtn);
    await waitFor(() => {
      const loader = queryByAttribute('aria-label', submitBtn, 'loading');

      expect(loader).toBeInTheDocument();
    });

    expect(mockProps.onSubmit).toHaveBeenCalledWith([]);
  });

  it('does not render submit and cancel buttons when showButton is false', async () => {
    await act(async () => {
      render(<AddTestCaseList {...mockProps} showButton={false} />);
    });

    expect(screen.queryByTestId('cancel')).toBeNull();
    expect(screen.queryByTestId('submit')).toBeNull();
  });
});
