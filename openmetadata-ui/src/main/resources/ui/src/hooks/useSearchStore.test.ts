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

import { act } from '@testing-library/react';
import { getNLPEnabledStatus } from '../rest/searchAPI';
import searchSettingsClassBase from '../utils/SearchSettingsClassBase';
import { useSearchStore } from './useSearchStore';

jest.mock('../rest/searchAPI', () => ({
  getNLPEnabledStatus: jest.fn(),
}));

const mockGetNLPEnabledStatus = getNLPEnabledStatus as jest.MockedFunction<
  typeof getNLPEnabledStatus
>;
const mockIsNLQSupported = jest.spyOn(
  searchSettingsClassBase,
  'isNLQSupported'
);

describe('useSearchStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNLQSupported.mockReturnValue(false);
    useSearchStore.setState({
      isNLPActive: false,
      isNLPEnabled: false,
      isNLPInitialized: false,
    });
  });

  it('keeps NLQ disabled in OSS without requesting the server setting', async () => {
    mockGetNLPEnabledStatus.mockResolvedValue(true);
    useSearchStore.getState().setNLPActive(true);

    await act(async () => {
      await useSearchStore.getState().initNLP();
    });

    expect(mockGetNLPEnabledStatus).not.toHaveBeenCalled();
    expect(useSearchStore.getState()).toMatchObject({
      isNLPActive: false,
      isNLPEnabled: false,
      isNLPInitialized: true,
    });
  });

  it('uses the server setting when the Collate override supports NLQ', async () => {
    mockIsNLQSupported.mockReturnValue(true);
    mockGetNLPEnabledStatus.mockResolvedValue(true);

    await act(async () => {
      await useSearchStore.getState().initNLP();
    });

    expect(mockGetNLPEnabledStatus).toHaveBeenCalledTimes(1);
    expect(useSearchStore.getState()).toMatchObject({
      isNLPEnabled: true,
      isNLPInitialized: true,
    });
  });
});
