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

/*
 * ContractDetailFormTab.test.tsx stubs `generateFormFields`, so it can only
 * inspect the field descriptors. These cases render the real Ant Design control
 * to assert what the author actually sees and can pick.
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DATA_CONTRACT_AUTHORING_STATUS_OPTIONS } from '../../../constants/DataContract.constants';
import { EntityStatus } from '../../../generated/entity/data/dataContract';
import { ContractDetailFormTab } from './ContractDetailFormTab';

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  })),
}));

const commonProps = {
  buttonProps: { isNextVisible: true },
  onChange: jest.fn(),
  onNext: jest.fn(),
};

const getStatusSelect = () => screen.getByTestId('contract-entity-status');

const openStatusDropdown = async () => {
  await act(async () => {
    fireEvent.mouseDown(
      getStatusSelect().querySelector('.ant-select-selector') as Element
    );
  });
};

describe('ContractDetailFormTab entity status control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show Draft as the pre-selected status when creating a contract', () => {
    render(<ContractDetailFormTab {...commonProps} />);

    expect(getStatusSelect()).toHaveTextContent('label.draft');
    expect(getStatusSelect()).not.toHaveTextContent('label.approved');
  });

  it('should show the contract status when editing an existing contract', () => {
    render(
      <ContractDetailFormTab
        initialValues={{ entityStatus: EntityStatus.Approved }}
        {...commonProps}
      />
    );

    expect(getStatusSelect()).toHaveTextContent('label.approved');
  });

  it('should offer only Draft, In Review and Approved as authoring statuses', async () => {
    render(<ContractDetailFormTab {...commonProps} />);

    await openStatusDropdown();

    const options = document.querySelectorAll('.ant-select-item-option');

    // Compare against the authoring list itself rather than literal i18n keys,
    // so renaming a key cannot fail this for a non-behavioural reason. Which
    // statuses that list may contain is asserted in ContractDetailFormTab.test.tsx.
    expect(Array.from(options).map((option) => option.textContent)).toEqual(
      DATA_CONTRACT_AUTHORING_STATUS_OPTIONS.map(({ labelKey }) => labelKey)
    );
  });

  it('should report the picked status to the parent form', async () => {
    render(<ContractDetailFormTab {...commonProps} />);

    await openStatusDropdown();

    await act(async () => {
      fireEvent.click(screen.getByText('label.in-review'));
    });

    expect(commonProps.onChange).toHaveBeenCalledWith(
      { entityStatus: EntityStatus.InReview },
      expect.anything()
    );
  });
});
