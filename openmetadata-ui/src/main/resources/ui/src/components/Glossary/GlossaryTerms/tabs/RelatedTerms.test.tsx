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
import { fireEvent, render, waitFor } from '@testing-library/react';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { TermRelation } from '../../../../generated/type/termRelation';
import {
  MOCKED_GLOSSARY_TERMS,
  MOCK_PERMISSIONS,
} from '../../../../mocks/Glossary.mock';
import { searchGlossaryTermsPaginated } from '../../../../rest/glossaryAPI';
import { listRelationshipTypes } from '../../../../rest/ontologyAPI';
import RelatedTerms from './RelatedTerms';

const buildRelatedTerms = (
  count: number,
  relationType = 'relatedTo',
  prefix = 'Related Term'
): TermRelation[] =>
  Array.from({ length: count }, (_, index) => ({
    relationType,
    term: {
      deleted: false,
      description: '',
      displayName: `${prefix} ${index}`,
      fullyQualifiedName: `Customer.${prefix} ${index}`,
      id: `${prefix}-${index}`,
      name: `${prefix} ${index}`,
      type: 'glossaryTerm',
    },
  }));

const RELATED_TO_TOGGLE = 'related-terms-toggle-relatedTo';

const mockContext = {
  data: MOCKED_GLOSSARY_TERMS[2] as GlossaryTerm,
  onUpdate: jest.fn(),
  isVersionView: false,
  permissions: MOCK_PERMISSIONS,
};

jest.mock('@openmetadata/ui-core-components', () => {
  const React = require('react');

  return {
    Autocomplete: Object.assign(
      ({ children, ...props }: Record<string, unknown>) =>
        React.createElement('div', props, children),
      {
        Item: ({ label, ...props }: Record<string, unknown>) =>
          React.createElement('div', props, label),
      }
    ),
    Badge: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement('span', props, children),
    BadgeWithIcon: ({
      children,
      iconLeading: _iconLeading,
      ...props
    }: Record<string, unknown>) => React.createElement('span', props, children),
    Button: ({
      children,
      iconLeading: _iconLeading,
      ...props
    }: Record<string, unknown>) =>
      React.createElement('button', props, children),
    Select: Object.assign(
      ({ children, ...props }: Record<string, unknown>) =>
        React.createElement('select', props, children),
      {
        Item: ({ label, ...props }: Record<string, unknown>) =>
          React.createElement('option', props, label),
      }
    ),
    Tooltip: ({ arrow: _arrow, children, ...props }: Record<string, unknown>) =>
      React.createElement('span', props, children),
    TooltipTrigger: ({
      children,
      onPress,
      ...props
    }: Record<string, unknown>) =>
      React.createElement('span', { ...props, onClick: onPress }, children),
    Typography: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement('span', props, children),
  };
});

jest.mock('../../../common/ExpandableCard/ExpandableCard', () => ({
  __esModule: true,
  default: jest.fn(
    ({
      children,
      cardProps,
    }: {
      children: unknown;
      cardProps?: { title?: unknown };
    }) => {
      const React = require('react');

      return React.createElement('div', {}, cardProps?.title, children);
    }
  ),
}));

jest.mock('../../../common/IconButtons/EditIconButton', () => ({
  EditIconButton: ({
    children,
    newLook: _newLook,
    ...props
  }: Record<string, unknown>) => {
    const React = require('react');

    return React.createElement('button', props, children);
  },
  PlusIconButton: ({
    children,
    newLook: _newLook,
    ...props
  }: Record<string, unknown>) => {
    const React = require('react');

    return React.createElement('button', props, children);
  },
}));

jest.mock('../../../../rest/glossaryAPI', () => ({
  searchGlossaryTermsPaginated: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../../rest/ontologyAPI', () => ({
  listRelationshipTypes: jest.fn().mockResolvedValue({
    data: [{ name: 'relatedTo', displayName: 'Related To' }],
  }),
}));

jest.mock('../../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn().mockImplementation(() => mockContext),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

const renderRelatedTerms = async () => {
  const view = render(<RelatedTerms />);

  await waitFor(() => {
    expect(listRelationshipTypes).toHaveBeenCalled();
    expect(searchGlossaryTermsPaginated).toHaveBeenCalled();
  });

  return view;
};

describe('RelatedTerms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContext.data = MOCKED_GLOSSARY_TERMS[2];
    mockContext.permissions = MOCK_PERMISSIONS;
  });

  it('should render the component', async () => {
    const { container } = await renderRelatedTerms();

    expect(container).toBeInTheDocument();
  });

  it('should show the related terms', async () => {
    const { getByText } = await renderRelatedTerms();

    expect(getByText('Business Customer')).toBeInTheDocument();
  });

  it('should show the add button if there are no related terms and the user has edit permissions', async () => {
    mockContext.data = { ...mockContext.data, relatedTerms: [] };
    const { getByTestId } = await renderRelatedTerms();

    expect(getByTestId('related-term-add-button')).toBeInTheDocument();
  });

  it('should not show the add button if there are no related terms and the user does not have edit permissions', async () => {
    mockContext.data = { ...mockContext.data, relatedTerms: [] };
    mockContext.permissions = { ...mockContext.permissions, EditAll: false };
    const { queryByTestId, findByText } = await renderRelatedTerms();

    expect(queryByTestId('related-term-add-button')).toBeNull();

    const noDataPlaceholder = await findByText(/--/i);

    expect(noDataPlaceholder).toBeInTheDocument();
  });

  it('should show the edit button if there are related terms and the user has edit permissions', async () => {
    mockContext.permissions = MOCK_PERMISSIONS;
    mockContext.data = { ...MOCKED_GLOSSARY_TERMS[2] };
    const { getByTestId } = await renderRelatedTerms();

    expect(getByTestId('edit-button')).toBeInTheDocument();
  });

  it('should show the edit button even if there are no related terms when the user has edit permissions', async () => {
    mockContext.data = { ...MOCKED_GLOSSARY_TERMS[2], relatedTerms: [] };
    const { getByTestId } = await renderRelatedTerms();

    expect(getByTestId('edit-button')).toBeInTheDocument();
  });
});

describe('RelatedTerms overflow', () => {
  beforeEach(() => {
    mockContext.permissions = MOCK_PERMISSIONS;
  });

  it('should hide the related terms beyond the visible limit behind a toggle', () => {
    mockContext.data = {
      ...MOCKED_GLOSSARY_TERMS[2],
      relatedTerms: buildRelatedTerms(8),
    };
    const { getByTestId, getByText, queryByText } = render(<RelatedTerms />);

    expect(getByText('Related Term 4')).toBeInTheDocument();
    expect(queryByText('Related Term 5')).toBeNull();
    expect(getByTestId(RELATED_TO_TOGGLE)).toBeInTheDocument();
  });

  it('should reveal every related term when the toggle is clicked', () => {
    mockContext.data = {
      ...MOCKED_GLOSSARY_TERMS[2],
      relatedTerms: buildRelatedTerms(8),
    };
    const { getByTestId, getByText } = render(<RelatedTerms />);

    fireEvent.click(getByTestId(RELATED_TO_TOGGLE));

    expect(getByText('Related Term 5')).toBeInTheDocument();
    expect(getByText('Related Term 7')).toBeInTheDocument();
  });

  it('should collapse back to the visible limit when the toggle is clicked again', () => {
    mockContext.data = {
      ...MOCKED_GLOSSARY_TERMS[2],
      relatedTerms: buildRelatedTerms(8),
    };
    const { getByTestId, queryByText } = render(<RelatedTerms />);
    const toggle = getByTestId(RELATED_TO_TOGGLE);

    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(queryByText('Related Term 7')).toBeNull();
  });

  it('should not render a toggle when the related terms fit within the limit', () => {
    mockContext.data = {
      ...MOCKED_GLOSSARY_TERMS[2],
      relatedTerms: buildRelatedTerms(5),
    };
    const { queryByTestId } = render(<RelatedTerms />);

    expect(queryByTestId(RELATED_TO_TOGGLE)).toBeNull();
  });

  it('should give each relation type its own independent toggle', () => {
    mockContext.data = {
      ...MOCKED_GLOSSARY_TERMS[2],
      relatedTerms: [
        ...buildRelatedTerms(7, 'relatedTo', 'Related'),
        ...buildRelatedTerms(7, 'synonymOf', 'Synonym'),
      ],
    };
    const { getByTestId, getByText, queryByText } = render(<RelatedTerms />);

    fireEvent.click(getByTestId(RELATED_TO_TOGGLE));

    expect(getByText('Related 6')).toBeInTheDocument();
    expect(queryByText('Synonym 6')).toBeNull();
  });
});
