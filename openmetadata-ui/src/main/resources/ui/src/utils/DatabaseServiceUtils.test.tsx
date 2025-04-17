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
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { ExtraDatabaseServiceDropdownOptions } from './DatabaseServiceUtils';

jest.mock(
  '../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: jest.fn().mockReturnValue({
      showModal: jest.fn(),
    }),
  })
);
jest.mock(
  '../components/common/ManageButtonContentItem/ManageButtonContentItem.component',
  () => ({
    ManageButtonItemLabel: jest
      .fn()
      .mockImplementation(() => <div>ManageButtonItemLabel</div>),
  })
);

describe('ExtraDatabaseServiceDropdownOptions', () => {
  it('should render import button when user has editAll permission', () => {
    const permission = {
      ViewAll: false,
      EditAll: true,
    } as OperationPermission;

    const result = ExtraDatabaseServiceDropdownOptions(
      'databaseServiceFqn',
      permission,
      false
    );

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('import-button');
  });

  it('should render export button when user has viewAll permission', () => {
    const permission = {
      ViewAll: true,
      EditAll: false,
    } as OperationPermission;

    const result = ExtraDatabaseServiceDropdownOptions(
      'databaseServiceFqn',
      permission,
      false
    );

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('export-button');
  });

  it('should render both button when user has viewAll & editAll permission', () => {
    const permission = {
      ViewAll: true,
      EditAll: true,
    } as OperationPermission;

    const result = ExtraDatabaseServiceDropdownOptions(
      'databaseServiceFqn',
      permission,
      false
    );

    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('import-button');
    expect(result[1].key).toBe('export-button');
  });

  it('should not render any buttons when user has neither viewAll nor editAll permission', () => {
    const permission = {
      ViewAll: false,
      EditAll: false,
    } as OperationPermission;
    const result = ExtraDatabaseServiceDropdownOptions(
      'databaseServiceFqn',
      permission,
      false
    );

    expect(result).toHaveLength(0);
    expect(result).toStrictEqual([]);
  });

  it('should not render any buttons when the entity is deleted', () => {
    const permission = {
      ViewAll: true,
      EditAll: true,
    } as OperationPermission;
    const result = ExtraDatabaseServiceDropdownOptions(
      'databaseServiceFqn',
      permission,
      true
    );

    expect(result).toHaveLength(0);
    expect(result).toStrictEqual([]);
  });
});
