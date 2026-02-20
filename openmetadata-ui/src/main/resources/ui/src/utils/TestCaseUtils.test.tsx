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

import { render, screen } from '@testing-library/react';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { MemoryRouter } from 'react-router-dom';
import { ExportTypes } from '../constants/Export.constants';
import { EntityType } from '../enums/entity.enum';
import { exportTestCasesInCSV } from '../rest/testAPI';
import { ExtraTestCaseDropdownOptions } from './TestCaseUtils';

// Mock dependencies
jest.mock('../rest/testAPI');
jest.mock('../hoc/LimitWrapper', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('./EntityUtils', () => ({
  getEntityImportPath: jest.fn(
    (entityType, fqn) => `/import/${entityType}/${fqn}`
  ),
  getEntityBulkEditPath: jest.fn(
    (entityType, fqn) => `/bulk-edit/${entityType}/${fqn}`
  ),
}));

describe('TestCaseUtils', () => {
  describe('ExtraTestCaseDropdownOptions', () => {
    const mockNavigate = jest.fn();
    const mockShowModal = jest.fn();
    const fqn = 'test.case.fqn';

    beforeEach(() => {
      mockNavigate.mockClear();
      mockShowModal.mockClear();
    });

    it('should return all three options when EditAll and ViewAll permissions are true and not deleted', () => {
      const permission = { ViewAll: true, EditAll: true };
      const result = ExtraTestCaseDropdownOptions(
        fqn,
        permission,
        false,
        mockNavigate,
        mockShowModal
      );

      expect(result).toHaveLength(3);
      expect((result[0] as ItemType)!.key).toBe('import-button');
      expect((result[1] as ItemType)!.key).toBe('export-button');
      expect((result[2] as ItemType)!.key).toBe('bulk-edit-button');
    });

    it('should return only export option when ViewAll is true but EditAll is false', () => {
      const permission = { ViewAll: true, EditAll: false };
      const result = ExtraTestCaseDropdownOptions(
        fqn,
        permission,
        false,
        mockNavigate,
        mockShowModal
      );

      expect(result).toHaveLength(1);
      expect((result[0] as ItemType)!.key).toBe('export-button');
    });

    it('should return empty array when both permissions are false', () => {
      const permission = { ViewAll: false, EditAll: false };
      const result = ExtraTestCaseDropdownOptions(
        fqn,
        permission,
        false,
        mockNavigate,
        mockShowModal
      );

      expect(result).toHaveLength(0);
    });

    it('should return empty array when entity is deleted even with permissions', () => {
      const permission = { ViewAll: true, EditAll: true };
      const result = ExtraTestCaseDropdownOptions(
        fqn,
        permission,
        true,
        mockNavigate,
        mockShowModal
      );

      expect(result).toHaveLength(0);
    });

    it('should render import button with correct props', () => {
      const permission = { ViewAll: true, EditAll: true };
      const result = ExtraTestCaseDropdownOptions(
        fqn,
        permission,
        false,
        mockNavigate,
        mockShowModal
      );

      render(
        <MemoryRouter>
          {(result[0] as ItemType & { label: React.ReactNode }).label}
        </MemoryRouter>
      );

      expect(screen.getByText('label.import')).toBeInTheDocument();
      expect(screen.getByTestId('import-button')).toBeInTheDocument();
    });

    it('should call navigate with correct path when import button is clicked', () => {
      const permission = { ViewAll: true, EditAll: true };
      const result = ExtraTestCaseDropdownOptions(
        fqn,
        permission,
        false,
        mockNavigate,
        mockShowModal
      );

      render(
        <MemoryRouter>
          {(result[0] as ItemType & { label: React.ReactNode }).label}
        </MemoryRouter>
      );

      const importButton = screen.getByTestId('import-button');
      importButton.click();

      expect(mockNavigate).toHaveBeenCalledWith(`/import/testCase/${fqn}`);
    });

    it('should call navigate with sourceEntityType query param when provided for import', () => {
      const permission = { ViewAll: true, EditAll: true };
      const result = ExtraTestCaseDropdownOptions(
        fqn,
        permission,
        false,
        mockNavigate,
        mockShowModal,
        EntityType.TABLE
      );

      render(
        <MemoryRouter>
          {(result[0] as ItemType & { label: React.ReactNode }).label}
        </MemoryRouter>
      );

      const importButton = screen.getByTestId('import-button');
      importButton.click();

      expect(mockNavigate).toHaveBeenCalledWith(
        `/import/testCase/${fqn}?sourceEntityType=table`
      );
    });

    it('should render export button with correct props', () => {
      const permission = { ViewAll: true, EditAll: true };
      const result = ExtraTestCaseDropdownOptions(
        fqn,
        permission,
        false,
        mockNavigate,
        mockShowModal
      );

      render(
        <MemoryRouter>
          {(result[1] as ItemType & { label: React.ReactNode }).label}
        </MemoryRouter>
      );

      expect(screen.getByText('label.export')).toBeInTheDocument();
      expect(screen.getByTestId('export-button')).toBeInTheDocument();
    });

    it('should call showModal with correct data when export button is clicked', () => {
      const permission = { ViewAll: true, EditAll: true };
      const result = ExtraTestCaseDropdownOptions(
        fqn,
        permission,
        false,
        mockNavigate,
        mockShowModal
      );

      render(
        <MemoryRouter>
          {(result[1] as ItemType & { label: React.ReactNode }).label}
        </MemoryRouter>
      );

      const exportButton = screen.getByTestId('export-button');
      exportButton.click();

      expect(mockShowModal).toHaveBeenCalledWith({
        name: fqn,
        onExport: exportTestCasesInCSV,
        exportTypes: [ExportTypes.CSV],
      });
    });

    it('should render bulk edit button with correct props', () => {
      const permission = { ViewAll: true, EditAll: true };
      const result = ExtraTestCaseDropdownOptions(
        fqn,
        permission,
        false,
        mockNavigate,
        mockShowModal
      );

      render(
        <MemoryRouter>
          {(result[2] as ItemType & { label: React.ReactNode }).label}
        </MemoryRouter>
      );

      expect(screen.getByText('label.bulk-edit')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-edit-button')).toBeInTheDocument();
    });

    it('should call navigate with correct path when bulk edit button is clicked', () => {
      const permission = { ViewAll: true, EditAll: true };
      const result = ExtraTestCaseDropdownOptions(
        fqn,
        permission,
        false,
        mockNavigate,
        mockShowModal
      );

      render(
        <MemoryRouter>
          {(result[2] as ItemType & { label: React.ReactNode }).label}
        </MemoryRouter>
      );

      const bulkEditButton = screen.getByTestId('bulk-edit-button');
      bulkEditButton.click();

      expect(mockNavigate).toHaveBeenCalledWith(`/bulk-edit/testCase/${fqn}`);
    });

    it('should call navigate with sourceEntityType query param when provided for bulk edit', () => {
      const permission = { ViewAll: true, EditAll: true };
      const result = ExtraTestCaseDropdownOptions(
        fqn,
        permission,
        false,
        mockNavigate,
        mockShowModal,
        EntityType.TEST_SUITE
      );

      render(
        <MemoryRouter>
          {(result[2] as ItemType & { label: React.ReactNode }).label}
        </MemoryRouter>
      );

      const bulkEditButton = screen.getByTestId('bulk-edit-button');
      bulkEditButton.click();

      expect(mockNavigate).toHaveBeenCalledWith(
        `/bulk-edit/testCase/${fqn}?sourceEntityType=testSuite`
      );
    });

    it('should return import and bulk edit options when EditAll is true but ViewAll is false', () => {
      const permission = { ViewAll: false, EditAll: true };
      const result = ExtraTestCaseDropdownOptions(
        fqn,
        permission,
        false,
        mockNavigate,
        mockShowModal
      );

      expect(result).toHaveLength(2);
      expect((result[0] as ItemType)!.key).toBe('import-button');
      expect((result[1] as ItemType)!.key).toBe('bulk-edit-button');
    });

    it('should handle empty FQN', () => {
      const permission = { ViewAll: true, EditAll: true };
      const result = ExtraTestCaseDropdownOptions(
        '',
        permission,
        false,
        mockNavigate,
        mockShowModal
      );

      expect(result).toHaveLength(3);
    });

    it('should handle special characters in FQN', () => {
      const specialFqn = 'test.case@123.fqn-name';
      const permission = { ViewAll: true, EditAll: true };
      const result = ExtraTestCaseDropdownOptions(
        specialFqn,
        permission,
        false,
        mockNavigate,
        mockShowModal
      );

      render(
        <MemoryRouter>
          {(result[0] as ItemType & { label: React.ReactNode }).label}
        </MemoryRouter>
      );

      const importButton = screen.getByTestId('import-button');
      importButton.click();

      expect(mockNavigate).toHaveBeenCalledWith(
        `/import/testCase/${specialFqn}`
      );
    });
  });
});
