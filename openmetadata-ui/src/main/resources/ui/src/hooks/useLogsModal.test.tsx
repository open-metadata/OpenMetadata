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
import { act, renderHook } from '@testing-library/react';
import { useLogsModal } from './useLogsModal';

jest.mock(
  '../components/common/LogViewerModal/LogsViewerModalContainer',
  () => ({
    __esModule: true,
    default: () => null,
  })
);

describe('useLogsModal', () => {
  it('has no modal element until openLogs is called', () => {
    const { result } = renderHook(() => useLogsModal());

    expect(result.current.logsModal).toBeNull();
  });

  it('renders a modal element after openLogs and clears it on close', () => {
    const { result } = renderHook(() => useLogsModal());

    act(() => {
      result.current.openLogs({
        logEntityType: 'databaseServices',
        fqn: 'svc.pipeline',
      });
    });

    expect(result.current.logsModal).not.toBeNull();

    act(() => {
      result.current.logsModal?.props.children.props.onClose();
    });

    expect(result.current.logsModal).toBeNull();
  });
});
