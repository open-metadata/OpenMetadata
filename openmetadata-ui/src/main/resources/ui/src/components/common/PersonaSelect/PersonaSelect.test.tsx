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
import { render } from '@testing-library/react';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import { getAllPersonas, searchPersonas } from '../../../rest/PersonaAPI';
import PersonaSelect from './PersonaSelect';
import { PersonaSelectProps } from './PersonaSelect.types';

const treeSelectMock = jest.fn();

jest.mock('@openmetadata/ui-core-components', () => ({
  TreeSelect: (props: Record<string, unknown>) => {
    treeSelectMock(props);

    return <div data-testid="tree-select-mock" />;
  },
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Persona: () => <span data-testid="persona-icon" />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../rest/PersonaAPI', () => ({
  getAllPersonas: jest.fn(),
  searchPersonas: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockGetAll = getAllPersonas as jest.Mock;
const mockSearch = searchPersonas as jest.Mock;

const DATA_ENGINEER = {
  id: 'p1',
  name: 'DataEngineer',
  displayName: 'Data Engineer',
  fullyQualifiedName: 'DataEngineer',
};

const personaRef: EntityReference = {
  id: 'p1',
  type: 'persona',
  name: 'DataEngineer',
  displayName: 'Data Engineer',
  fullyQualifiedName: 'DataEngineer',
};

const lastProps = () =>
  treeSelectMock.mock.calls[treeSelectMock.mock.calls.length - 1][0];

const renderSelect = (props: Partial<PersonaSelectProps> = {}) => {
  const onUpdate = jest.fn();

  render(<PersonaSelect onUpdate={onUpdate} {...props} />);

  return { onUpdate };
};

describe('PersonaSelect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAll.mockResolvedValue({
      data: [DATA_ENGINEER],
      paging: { total: 1 },
    });
    mockSearch.mockResolvedValue([DATA_ENGINEER]);
  });

  it('should map the selected persona into the value nodes', () => {
    renderSelect({ selectedPersona: personaRef });

    expect(lastProps().value).toEqual([
      {
        id: 'DataEngineer',
        value: 'DataEngineer',
        label: 'Data Engineer',
        data: personaRef,
        isLeaf: true,
      },
    ]);
  });

  it('should disable the selector when hasPermission is false', () => {
    renderSelect({ hasPermission: false });

    expect(lastProps().disabled).toBe(true);
  });

  it('should list personas from getAllPersonas when no search term is given', async () => {
    renderSelect();

    const { nodes } = await lastProps().fetchData({});

    expect(mockGetAll).toHaveBeenCalledWith({ limit: PAGE_SIZE_LARGE });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('DataEngineer');
    expect(nodes[0].data).toMatchObject({ id: 'p1', type: 'persona' });
  });

  it('should search personas when a search term is given', async () => {
    renderSelect();

    const { nodes } = await lastProps().fetchData({ searchTerm: 'Data' });

    expect(mockSearch).toHaveBeenCalledWith('Data', PAGE_SIZE_LARGE);
    expect(nodes).toHaveLength(1);
  });

  it('keeps the display-identity ref fields but drops server read-only ones', () => {
    const { onUpdate } = renderSelect();

    lastProps().onChange({
      id: 'DataEngineer',
      value: 'DataEngineer',
      label: 'Data Engineer',
      data: { ...personaRef, href: 'x', deleted: false, description: 'd' },
    });

    expect(onUpdate).toHaveBeenCalledWith({
      id: 'p1',
      type: 'persona',
      name: 'DataEngineer',
      displayName: 'Data Engineer',
      fullyQualifiedName: 'DataEngineer',
    });
  });

  it('should call onUpdate with undefined when the selection is cleared', () => {
    const { onUpdate } = renderSelect({ selectedPersona: personaRef });

    lastProps().onChange(null);

    expect(onUpdate).toHaveBeenCalledWith(undefined);
  });
});
