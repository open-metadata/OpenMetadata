/*
 *  Copyright 2022 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import {
  Directory,
  EntityReference,
} from '../../../../generated/entity/data/directory';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { descriptionTableObject } from '../../../../utils/TableColumn.util';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';
import DirectoryChildrenTable from './DirectoryChildrenTable';

jest.mock('../../../../utils/RouterUtils');
jest.mock('../../../Customization/GenericProvider/GenericProvider');
jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn(() => <div data-testid="error-placeholder">No data</div>)
);
jest.mock('../../../common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest.fn(({ markdown }) => (
    <div data-testid="rich-text-previewer">{markdown}</div>
  ))
);
jest.mock('../../../common/Table/Table', () =>
  jest.fn(({ columns, dataSource, locale }) => (
    <div data-testid="table">
      <div data-testid="table-columns">{JSON.stringify(columns.length)}</div>
      <div data-testid="table-data">
        {JSON.stringify(dataSource?.length || 0)}
      </div>
      {!dataSource?.length && (
        <div data-testid="empty-state">{locale?.emptyText}</div>
      )}
      {dataSource?.map((item: EntityReference, index: number) => (
        <div data-testid={`table-row-${index}`} key={item.id || index}>
          {item.name} - {item.type}
        </div>
      ))}
    </div>
  ))
);

const mockUseGenericContext = useGenericContext as jest.Mock;
const mockGetEntityDetailsPath = getEntityDetailsPath as jest.Mock;

const mockDirectoryData: Directory = {
  id: 'directory-1',
  name: 'test-directory',
  fullyQualifiedName: 'drive-service.test-directory',
  displayName: 'Test Directory',
  children: [
    {
      id: 'child-1',
      name: 'subdirectory',
      fullyQualifiedName: 'drive-service.test-directory.subdirectory',
      displayName: 'Sub Directory',
      type: EntityType.DIRECTORY,
      description: 'This is a subdirectory',
      deleted: false,
    },
    {
      id: 'child-2',
      name: 'test-file',
      fullyQualifiedName: 'drive-service.test-directory.test-file',
      displayName: 'Test File',
      type: EntityType.FILE,
      deleted: false,
    },
  ],
  version: 1.0,
  deleted: false,
  href: 'http://localhost:8585/api/v1/directories/directory-1',
  service: {
    id: 'service-1',
    type: 'driveService',
    name: 'drive-service',
    fullyQualifiedName: 'drive-service',
    displayName: 'Drive Service',
    deleted: false,
  },
};

const mockDirectoryDataEmpty: Directory = {
  ...mockDirectoryData,
  children: [],
};

const renderDirectoryChildrenTable = () => {
  return render(
    <MemoryRouter>
      <DirectoryChildrenTable />
    </MemoryRouter>
  );
};

describe('DirectoryChildrenTable', () => {
  beforeEach(() => {
    mockGetEntityDetailsPath.mockImplementation(
      (type: EntityType, fqn: string) => `/entity/${type}/${fqn}`
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render table with children data', () => {
    mockUseGenericContext.mockReturnValue({
      data: mockDirectoryData,
    });

    renderDirectoryChildrenTable();

    expect(screen.getByTestId('table')).toBeInTheDocument();
    expect(screen.getByTestId('table-columns')).toHaveTextContent('2');
    expect(descriptionTableObject).toHaveBeenCalledWith();
    expect(screen.getByTestId('table-data')).toHaveTextContent('2');
    expect(screen.getByTestId('table-row-0')).toHaveTextContent(
      'subdirectory - directory'
    );
    expect(screen.getByTestId('table-row-1')).toHaveTextContent(
      'test-file - file'
    );
  });

  it('should render empty state when no children', () => {
    mockUseGenericContext.mockReturnValue({
      data: mockDirectoryDataEmpty,
    });

    renderDirectoryChildrenTable();

    expect(screen.getByTestId('table')).toBeInTheDocument();
    expect(screen.getByTestId('table-data')).toHaveTextContent('0');
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
  });

  it('should render table with correct column structure', () => {
    mockUseGenericContext.mockReturnValue({
      data: mockDirectoryData,
    });

    renderDirectoryChildrenTable();

    expect(screen.getByTestId('table-columns')).toHaveTextContent('2');
    expect(descriptionTableObject).toHaveBeenCalledWith();
  });

  it('should handle children with descriptions', () => {
    const dataWithDescriptions = {
      ...mockDirectoryData,
      children: [
        {
          ...(mockDirectoryData.children && mockDirectoryData.children[0]),
          description: 'Test description',
        },
      ],
    };

    mockUseGenericContext.mockReturnValue({
      data: dataWithDescriptions,
    });

    renderDirectoryChildrenTable();

    expect(screen.getByTestId('table')).toBeInTheDocument();
    expect(screen.getByTestId('table-data')).toHaveTextContent('1');
  });

  it('should handle children without descriptions', () => {
    const dataWithoutDescriptions = {
      ...mockDirectoryData,
      children: [
        {
          ...(mockDirectoryData.children && mockDirectoryData.children[0]),
          description: undefined,
        },
      ],
    };

    mockUseGenericContext.mockReturnValue({
      data: dataWithoutDescriptions,
    });

    renderDirectoryChildrenTable();

    expect(screen.getByTestId('table')).toBeInTheDocument();
    expect(screen.getByTestId('table-data')).toHaveTextContent('1');
  });

  it('should handle undefined children array', () => {
    const dataWithUndefinedChildren = {
      ...mockDirectoryData,
      children: undefined,
    };

    mockUseGenericContext.mockReturnValue({
      data: dataWithUndefinedChildren,
    });

    renderDirectoryChildrenTable();

    expect(screen.getByTestId('table')).toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('should render different entity types correctly', () => {
    const mixedChildren = {
      ...mockDirectoryData,
      children: [
        {
          id: 'file-1',
          name: 'document.pdf',
          fullyQualifiedName: 'drive-service.test-directory.document.pdf',
          displayName: 'Document PDF',
          type: EntityType.FILE,
          deleted: false,
        },
        {
          id: 'spreadsheet-1',
          name: 'data.xlsx',
          fullyQualifiedName: 'drive-service.test-directory.data.xlsx',
          displayName: 'Data Excel',
          type: EntityType.SPREADSHEET,
          deleted: false,
        },
      ],
    };

    mockUseGenericContext.mockReturnValue({
      data: mixedChildren,
    });

    renderDirectoryChildrenTable();

    expect(screen.getByTestId('table-row-0')).toHaveTextContent(
      'document.pdf - file'
    );
    expect(screen.getByTestId('table-row-1')).toHaveTextContent(
      'data.xlsx - spreadsheet'
    );
  });

  it('should handle missing context data gracefully', () => {
    mockUseGenericContext.mockReturnValue({
      data: { children: [] },
    });

    renderDirectoryChildrenTable();

    expect(screen.getByTestId('table')).toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });
});
