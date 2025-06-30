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
  fireEvent,
  getAllByTestId,
  getAllByText,
  getByTestId,
  getByText,
  render,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  mockedGlossaryTerms,
  MOCK_PERMISSIONS,
} from '../../../mocks/Glossary.mock';
import { useGlossaryStore } from '../useGlossary.store';
import GlossaryTermTab from './GlossaryTermTab.component';

const mockOnAddGlossaryTerm = jest.fn();
const mockRefreshGlossaryTerms = jest.fn();
const mockOnEditGlossaryTerm = jest.fn();

const mockProps = {
  childGlossaryTerms: [],
  isGlossary: false,
  permissions: MOCK_PERMISSIONS,
  selectedData: mockedGlossaryTerms[0],
  termsLoading: false,
};

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTerms: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockedGlossaryTerms })),
  patchGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
}));
jest.mock('../../common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <p data-testid="description">{markdown}</p>
    ))
);
jest.mock('../../../utils/TableUtils', () => ({
  getTableExpandableConfig: jest.fn(),
  getTableColumnConfigSelections: jest
    .fn()
    .mockReturnValue(['name', 'description', 'owners']),
  handleUpdateTableColumnSelections: jest.fn(),
}));
jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest
    .fn()
    .mockImplementation(({ onClick }) => (
      <div onClick={onClick}>ErrorPlaceHolder</div>
    ))
);

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(() => <div>OwnerLabel</div>),
}));

jest.mock('../../../utils/TableColumn.util', () => ({
  ownerTableObject: jest.fn().mockReturnValue([
    {
      title: 'label.owner-plural',
      dataIndex: 'owners',
      key: 'owners',
      width: 180,
      render: () => <div>OwnerLabel</div>,
    },
  ]),
}));

jest.mock('../useGlossary.store', () => ({
  useGlossaryStore: jest.fn().mockImplementation(() => ({
    activeGlossary: mockedGlossaryTerms[0],
    updateActiveGlossary: jest.fn(),
    onAddGlossaryTerm: mockOnAddGlossaryTerm,
    onEditGlossaryTerm: mockOnEditGlossaryTerm,
    refreshGlossaryTerms: mockRefreshGlossaryTerms,
  })),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockImplementation(() => ({
    permissions: MOCK_PERMISSIONS,
    type: 'glossary',
  })),
}));

describe('Test GlossaryTermTab component', () => {
  it('should show the ErrorPlaceHolder component, if no glossary is present', () => {
    const { container } = render(<GlossaryTermTab {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(getByText(container, 'ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('should call the onAddGlossaryTerm fn onClick of add button in ErrorPlaceHolder', () => {
    const { container } = render(<GlossaryTermTab {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    fireEvent.click(getByText(container, 'ErrorPlaceHolder'));

    expect(mockOnAddGlossaryTerm).toHaveBeenCalled();
  });

  it('should contain all necessary fields value in table when glossary data is not empty', async () => {
    (useGlossaryStore as unknown as jest.Mock).mockImplementation(() => ({
      activeGlossary: {
        ...mockedGlossaryTerms[0],
        children: mockedGlossaryTerms,
      },
      glossaryChildTerms: mockedGlossaryTerms,
      updateActiveGlossary: jest.fn(),
    }));
    const { container } = render(<GlossaryTermTab {...mockProps} />, {
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
