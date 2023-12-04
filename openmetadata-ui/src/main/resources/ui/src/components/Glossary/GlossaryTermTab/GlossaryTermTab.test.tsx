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

import {
  getAllByTestId,
  getAllByText,
  getByTestId,
  getByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  mockedGlossaryTerms,
  MOCK_PERMISSIONS,
} from '../../../mocks/Glossary.mock';
import GlossaryTermTab from './GlossaryTermTab.component';
import { GlossaryTermTabProps } from './GlossaryTermTab.interface';

const mockOnAddGlossaryTerm = jest.fn();
const mockRefreshGlossaryTerms = jest.fn();
const mockOnEditGlossaryTerm = jest.fn();
const mockOnShowDeletedChange = jest.fn();

const mockProps1: GlossaryTermTabProps = {
  childGlossaryTerms: [],
  isGlossary: false,
  showDeleted: false,
  permissions: MOCK_PERMISSIONS,
  refreshGlossaryTerms: mockRefreshGlossaryTerms,
  selectedData: mockedGlossaryTerms[0],
  termsLoading: false,
  onAddGlossaryTerm: mockOnAddGlossaryTerm,
  onEditGlossaryTerm: mockOnEditGlossaryTerm,
  onShowDeletedChange: mockOnShowDeletedChange,
};

const mockProps2 = {
  ...mockProps1,
  childGlossaryTerms: mockedGlossaryTerms,
};

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTerms: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockedGlossaryTerms })),
  patchGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
}));
jest.mock('../../common/RichTextEditor/RichTextEditorPreviewer', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <p data-testid="description">{markdown}</p>
    ))
);
jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest
    .fn()
    .mockImplementation(({ onClick }) => (
      <div onClick={onClick}>ErrorPlaceHolder</div>
    ))
);

jest.mock('../../Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(() => <div>OwnerLabel</div>),
}));

describe('Test GlossaryTermTab component', () => {
  // Change description
  // Removed ErrorPlaceholder check because the placeholder will be displayed in the
  // antd table itself

  it('should contain all necessary fields value in table when glossary data is not empty', async () => {
    const { container } = render(<GlossaryTermTab {...mockProps2} />, {
      wrapper: MemoryRouter,
    });

    expect(getByTestId(container, 'Clothing')).toBeInTheDocument();
    expect(
      getByText(container, 'description of Business Glossary.Sales')
    ).toBeInTheDocument();

    expect(getAllByText(container, 'OwnerLabel')).toHaveLength(2);

    expect(getAllByTestId(container, 'add-classification')).toHaveLength(1);
    expect(getAllByTestId(container, 'edit-button')).toHaveLength(2);
  });
});
