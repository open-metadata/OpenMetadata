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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CursorType } from '../../../enums/pagination.enum';
import { getAllPersonas } from '../../../rest/PersonaAPI';
import { PersonaPage } from './PersonaPage';

jest.mock('../../../components/PageHeader/PageHeader.component', () => {
  return jest.fn().mockImplementation(() => <div>PageHeader.component</div>);
});

jest.mock('../../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>TitleBreadcrumb.component</div>);
  }
);

jest.mock('../../../components/common/NextPrevious/NextPrevious', () => {
  return jest.fn().mockImplementation(() => <div>NextPrevious.component</div>);
});

jest.mock(
  '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>ErrorPlaceHolder.component</div>);
  }
);

jest.mock('../../../components/common/DeleteWidget/DeleteWidgetModal', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>DeleteWidgetModal.component</div>);
});

jest.mock(
  '../../../components/MyData/Persona/PersonaDetailsCard/PersonaDetailsCard',
  () => {
    return {
      PersonaDetailsCard: jest
        .fn()
        .mockImplementation(() => <div>PersonaDetailsCard.component</div>),
    };
  }
);

jest.mock(
  '../../../components/MyData//Persona/AddEditPersona/AddEditPersona.component',
  () => {
    return {
      AddEditPersonaForm: jest.fn().mockImplementation(({ onSave }) => (
        <div>
          AddEditPersonaForm.component
          <button data-testid="save-edit-persona-save" onClick={onSave}>
            Save
          </button>
        </div>
      )),
    };
  }
);

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 1,
    showPagination: true,
    pageSize: 10,
    paging: {
      [CursorType.AFTER]: '1',
    },
    pagingCursor: {
      cursorType: CursorType.AFTER,
      cursorValue: '',
    },
    handlePageChange: jest.fn(),
    handlePagingChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
  }),
}));

jest.mock('../../../rest/PersonaAPI', () => {
  return {
    getAllPersonas: jest
      .fn()
      .mockImplementation(() => Promise.resolve({ data: [] })),
  };
});

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

const mockProps = {
  pageTitle: 'personas',
};

describe('PersonaPage', () => {
  it('Component should render', async () => {
    render(<PersonaPage {...mockProps} />);

    expect(
      await screen.findByText('ErrorPlaceHolder.component')
    ).toBeInTheDocument();
  });

  it('AddEditPersonaForm should render onclick of add persona', async () => {
    (getAllPersonas as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: [
          {
            id: 'id1',
            name: 'sales',
            fullyQualifiedName: 'sales',
            displayName: 'Sales',
          },
          {
            id: 'id2',
            name: 'purchase',
            fullyQualifiedName: 'purchase',
            displayName: 'purchase',
          },
        ],
      })
    );
    act(() => {
      render(<PersonaPage {...mockProps} />);
    });
    const addPersonaButton = await screen.findByTestId('add-persona-button');

    await act(async () => {
      fireEvent.click(addPersonaButton);
    });

    expect(
      await screen.findByText('AddEditPersonaForm.component')
    ).toBeInTheDocument();
  });

  it('handlePersonaAddEditSave should be called onClick of save button', async () => {
    const mockGetAllPersonas = getAllPersonas as jest.Mock;
    (getAllPersonas as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: [
          {
            id: 'id1',
            name: 'sales',
            fullyQualifiedName: 'sales',
            displayName: 'Sales',
          },
          {
            id: 'id2',
            name: 'purchase',
            fullyQualifiedName: 'purchase',
            displayName: 'purchase',
          },
        ],
      })
    );
    act(() => {
      render(<PersonaPage {...mockProps} />);
    });
    const addPersonaButton = await screen.findByTestId('add-persona-button');
    fireEvent.click(addPersonaButton);

    expect(
      await screen.findByText('AddEditPersonaForm.component')
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(await screen.findByTestId('save-edit-persona-save'));
    });

    expect(mockGetAllPersonas).toHaveBeenCalledWith({
      after: undefined,
      before: undefined,
      fields: 'users',
      limit: 10,
    });
    expect(mockGetAllPersonas).toHaveBeenCalledTimes(2);
  });

  it('should render PersonaDetailsCard when data is available', async () => {
    (getAllPersonas as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: [
          {
            id: 'id1',
            name: 'sales',
            fullyQualifiedName: 'sales',
            displayName: 'Sales',
          },
          {
            id: 'id2',
            name: 'purchase',
            fullyQualifiedName: 'purchase',
            displayName: 'purchase',
          },
        ],
      })
    );
    act(() => {
      render(<PersonaPage {...mockProps} />);
    });

    expect(
      await screen.findAllByText('PersonaDetailsCard.component')
    ).toHaveLength(2);
  });
});
