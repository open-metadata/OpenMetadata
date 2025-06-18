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

jest.mock('../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(),
}));

jest.mock('../utils/StringsUtils', () => ({
  getDecodedFqn: jest.fn((fqn) => decodeURIComponent(fqn)),
}));

describe('useFqn', () => {
  it('returns decoded fqn and ingestionFQN', () => {
    (useRequiredParams as jest.Mock).mockReturnValue({
      fqn: 'sample_data.db_sample.schema_sample.dim/client.',
      ingestionFQN: 'sample_data.db_sample.schema_sample.dim/client.',
      ruleName: 'testing / policy rule do not use',
    });

    const { result } = renderHook(() => useFqn());

    expect(result.current).toEqual({
      fqn: 'sample_data.db_sample.schema_sample.dim/client.',
      ingestionFQN: 'sample_data.db_sample.schema_sample.dim/client.',
      ruleName: 'testing / policy rule do not use',
    });
  });

  it('returns empty strings when fqn and ingestionFQN are not provided', () => {
    (useRequiredParams as jest.Mock).mockReturnValue({});

    const { result } = renderHook(() => useFqn());

    expect(result.current).toEqual({
      fqn: '',
      ingestionFQN: '',
      ruleName: '',
    });
  });
});
