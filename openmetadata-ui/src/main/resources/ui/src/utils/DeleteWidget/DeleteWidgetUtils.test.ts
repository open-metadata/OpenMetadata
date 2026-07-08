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

import { AxiosError } from 'axios';
import { EntityType } from '../../enums/entity.enum';
import { deleteEntity } from '../../rest/miscAPI';
import { showErrorToast, showSuccessToast } from '../ToastUtils';
import { hardDeleteEntity } from './DeleteWidgetUtils';

jest.mock('../../rest/miscAPI', () => ({
  deleteEntity: jest.fn(),
}));

jest.mock('../ToastUtils', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('../i18next/LocalUtil', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

const mockDeleteEntity = deleteEntity as jest.Mock;

describe('hardDeleteEntity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should hard-delete with prepared entity type and recursive=false by default', async () => {
    mockDeleteEntity.mockResolvedValue({ status: 200, data: { version: 1 } });

    const result = await hardDeleteEntity('KPI 1', 'id-1', EntityType.KPI);

    expect(mockDeleteEntity).toHaveBeenCalledWith('kpi', 'id-1', false, true);
    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.entity-deleted-successfully'
    );
    expect(showErrorToast).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('should pass recursive flag and use a custom success message', async () => {
    mockDeleteEntity.mockResolvedValue({ status: 200, data: {} });

    const result = await hardDeleteEntity('Domain 1', 'id-2', EntityType.DOMAIN, {
      isRecursiveDelete: true,
      successMessage: 'custom-success',
    });

    expect(mockDeleteEntity).toHaveBeenCalledWith('domains', 'id-2', true, true);
    expect(showSuccessToast).toHaveBeenCalledWith('custom-success');
    expect(result).toBe(true);
  });

  it('should not prepare the entity type when prepareType is false', async () => {
    mockDeleteEntity.mockResolvedValue({ status: 200, data: {} });

    await hardDeleteEntity('Policy 1', 'id-3', EntityType.POLICY, {
      prepareType: false,
    });

    expect(mockDeleteEntity).toHaveBeenCalledWith(
      EntityType.POLICY,
      'id-3',
      false,
      true
    );
  });

  it('should show an error toast and return false on a non-200 response', async () => {
    mockDeleteEntity.mockResolvedValue({ status: 202, data: {} });

    const result = await hardDeleteEntity('KPI 1', 'id-1', EntityType.KPI);

    expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-response');
    expect(showSuccessToast).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('should show an error toast and return false when the request throws', async () => {
    const error = new AxiosError('boom');
    mockDeleteEntity.mockRejectedValue(error);

    const result = await hardDeleteEntity('KPI 1', 'id-1', EntityType.KPI);

    expect(showErrorToast).toHaveBeenCalledWith(
      error,
      'server.delete-entity-error'
    );
    expect(result).toBe(false);
  });
});
