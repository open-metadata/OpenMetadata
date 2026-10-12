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

import { renderHook } from '@testing-library/react-hooks';
import { useAgentActionAvailability } from './useAgentActionAvailability';

const mockAirflowStatus = jest.fn();

jest.mock(
  '../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: () => mockAirflowStatus(),
  })
);

describe('useAgentActionAvailability', () => {
  it('should report pending while the status call is in flight', () => {
    mockAirflowStatus.mockReturnValue({
      isAirflowAvailable: false,
      isFetchingStatus: true,
    });

    const { result } = renderHook(() => useAgentActionAvailability());

    expect(result.current).toEqual({ isPending: true, isUnavailable: false });
  });

  it('should report unavailable once the status call answers that it is unreachable', () => {
    mockAirflowStatus.mockReturnValue({
      isAirflowAvailable: false,
      isFetchingStatus: false,
    });

    const { result } = renderHook(() => useAgentActionAvailability());

    expect(result.current).toEqual({ isPending: false, isUnavailable: true });
  });

  it('should report neither once the pipeline service answers', () => {
    mockAirflowStatus.mockReturnValue({
      isAirflowAvailable: true,
      isFetchingStatus: false,
    });

    const { result } = renderHook(() => useAgentActionAvailability());

    expect(result.current).toEqual({ isPending: false, isUnavailable: false });
  });
});
