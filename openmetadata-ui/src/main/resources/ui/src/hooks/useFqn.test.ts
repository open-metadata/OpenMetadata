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
import { renderHook } from '@testing-library/react-hooks';
import { useRequiredParams } from '../utils/useRequiredParams';
import { useFqn } from './useFqn';

const SAMPLE_DATA_DB_SAMPLE_SCHEMA =
  'sample_data.db_sample.schema_sample.dim/client.';
const SERVICE_DATABASE_SCHEMA_TABLE_COLUMN =
  'service.database.schema.table.column';

jest.mock('../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(),
}));

jest.mock('../utils/StringUtils', () => ({
  getDecodedFqn: jest.fn((fqn) => decodeURIComponent(fqn)),
}));

describe('useFqn', () => {
  it('returns decoded fqn and ingestionFQN', () => {
    (useRequiredParams as jest.Mock).mockReturnValue({
      fqn: SAMPLE_DATA_DB_SAMPLE_SCHEMA,
      ingestionFQN: SAMPLE_DATA_DB_SAMPLE_SCHEMA,
      ruleName: 'testing / policy rule do not use',
    });

    const { result } = renderHook(() => useFqn());

    expect(result.current).toEqual({
      fqn: SAMPLE_DATA_DB_SAMPLE_SCHEMA,
      ingestionFQN: SAMPLE_DATA_DB_SAMPLE_SCHEMA,
      ruleName: 'testing / policy rule do not use',
      entityFqn: SAMPLE_DATA_DB_SAMPLE_SCHEMA,
      columnFqn: undefined,
    });
  });

  it('returns empty strings when fqn and ingestionFQN are not provided', () => {
    (useRequiredParams as jest.Mock).mockReturnValue({});

    const { result } = renderHook(() => useFqn());

    expect(result.current).toEqual({
      fqn: '',
      ingestionFQN: '',
      ruleName: '',
      entityFqn: '',
      columnFqn: undefined,
    });
  });

  it('returns split entityFqn and columnFqn when type is provided', () => {
    (useRequiredParams as jest.Mock).mockReturnValue({
      fqn: SERVICE_DATABASE_SCHEMA_TABLE_COLUMN,
      ingestionFQN: SERVICE_DATABASE_SCHEMA_TABLE_COLUMN,
      ruleName: '',
    });

    // We rely on the real EntityUtilClassBase behavior because it's not mocked in this file
    const { result } = renderHook(() => useFqn({ type: 'table' }));

    expect(result.current).toEqual({
      fqn: SERVICE_DATABASE_SCHEMA_TABLE_COLUMN,
      ingestionFQN: SERVICE_DATABASE_SCHEMA_TABLE_COLUMN,
      ruleName: '',
      entityFqn: 'service.database.schema.table',
      columnFqn: 'column',
    });
  });
});
