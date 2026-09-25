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
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ROUTES } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import {
  AdvanceSearchProvider,
  useAdvanceSearch,
} from './AdvanceSearchProvider.component';

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getAllCustomProperties: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../rest/tagAPI', () => ({
  getTags: jest.fn().mockResolvedValue({}),
}));

jest.mock('../AdvanceSearchModal.component', () => ({
  AdvancedSearchModal: jest
    .fn()
    .mockImplementation(({ visible, onSubmit, onCancel }) => (
      <>
        {visible ? (
          <p>AdvanceSearchModal Open</p>
        ) : (
          <p>AdvanceSearchModal Close</p>
        )}
        <button onClick={onSubmit}>Apply Advance Search</button>
        <button onClick={onCancel}>Close Modal</button>
      </>
    )),
}));

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

// The global mock in setupTests.js stubs getQbConfigs to return an empty object,
// but this provider feeds the config straight into the react-awesome-query-builder
// utilities, which require a fully-formed config (settings, types, widgets...).
// Restore the real getQbConfigs here so the tree utilities receive a valid config.
jest.mock('../../../utils/AdvancedSearchClassBase', () => {
  const actual = jest.requireActual('../../../utils/AdvancedSearchClassBase');

  return {
    __esModule: true,
    ...actual,
    default: {
      ...actual.default,
      autocomplete: jest.fn().mockReturnValue(jest.fn()),
    },
  };
});

const mockNavigate = jest.fn();

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({
    search: 'queryFilter={"some":"value"}',
    pathname: ROUTES.EXPLORE,
  }));
});

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    tab: 'tabValue',
  }),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

const Children = () => {
  const { toggleModal, onResetAllFilters } = useAdvanceSearch();

  return (
    <>
      <button onClick={() => toggleModal(true)}>
        Open AdvanceSearch Modal
      </button>
      <button onClick={onResetAllFilters}>Reset All Filters</button>
    </>
  );
};

const mockWithAdvanceSearch =
  (Component: React.FC) =>
  (props: JSX.IntrinsicAttributes & { children?: React.ReactNode }) => {
    return (
      <AdvanceSearchProvider>
        <Component {...props} />
      </AdvanceSearchProvider>
    );
  };

const ComponentWithProvider = mockWithAdvanceSearch(Children);

describe('AdvanceSearchProvider component', () => {
  // Fake timers are enabled globally, so user-event must be told how to advance
  // them, otherwise its internal delays never resolve and clicks hang.
  const setupUser = () =>
    userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

  it('should render the provider children with the modal closed by default', async () => {
    await act(async () => {
      render(<ComponentWithProvider />);
    });

    expect(screen.getByText('Open AdvanceSearch Modal')).toBeInTheDocument();
    // The modal is only mounted when it is opened, so nothing modal related
    // should be present on the initial render.
    expect(screen.queryByText('AdvanceSearchModal Open')).toBeNull();
    expect(screen.queryByText('Apply Advance Search')).toBeNull();
  });

  it('should open the AdvanceSearchModal on call of toggleModal with true', async () => {
    const user = setupUser();
    await act(async () => {
      render(<ComponentWithProvider />);
    });

    expect(screen.queryByText('AdvanceSearchModal Open')).toBeNull();

    await user.click(screen.getByText('Open AdvanceSearch Modal'));

    expect(
      await screen.findByText('AdvanceSearchModal Open')
    ).toBeInTheDocument();
  });

  it('should call navigate after submitting the advance search form', async () => {
    const user = setupUser();
    await act(async () => {
      render(<ComponentWithProvider />);
    });

    await user.click(screen.getByText('Open AdvanceSearch Modal'));

    const applyButton = await screen.findByText('Apply Advance Search');

    mockNavigate.mockClear();

    await user.click(applyButton);

    expect(mockNavigate).toHaveBeenCalled();
  });

  it('onResetAllFilters should navigate to the reset filters search params', async () => {
    const user = setupUser();
    await act(async () => {
      render(<ComponentWithProvider />);
    });

    mockNavigate.mockClear();

    await user.click(screen.getByText('Reset All Filters'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: ROUTES.EXPLORE })
    );
  });
});

describe('AdvanceSearchProvider — search index changes', () => {
  const IndexProbe = () => {
    const { onChangeSearchIndex, isUpdating, searchIndex } = useAdvanceSearch();

    return (
      <>
        <span data-testid="is-updating">{String(isUpdating)}</span>
        <button
          data-testid="reselect-same"
          onClick={() =>
            onChangeSearchIndex(searchIndex as SearchIndex | SearchIndex[])
          }>
          reselect
        </button>
      </>
    );
  };

  const ProbeWithProvider = mockWithAdvanceSearch(IndexProbe);

  // `loadData` is what clears `isUpdating`, and it only re-runs when
  // `searchIndex` actually changes. Flipping the flag for a no-op change
  // strands every consumer in "updating" forever — which is how the workflow
  // Exclude Filter, asking for the provider's own default index, rendered
  // nothing while Data Asset Filter (a different index) worked.
  it('should not enter the updating state when the index is unchanged', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await act(async () => {
      render(<ProbeWithProvider />);
    });

    await act(async () => {
      await user.click(screen.getByTestId('reselect-same'));
    });

    expect(screen.getByTestId('is-updating')).toHaveTextContent('false');
  });
});
