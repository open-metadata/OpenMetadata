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
import { renderHook } from '@testing-library/react';
import { useTabSearchMemory } from './useTabSearchMemory';

type Tab = 'test-cases' | 'test-suites' | 'summary';

type MemoryProps = { activeTab: Tab; search: string; isRecording?: boolean };

const renderMemory = (activeTab: Tab, search: string) => {
  const initialProps: MemoryProps = { activeTab, search };

  return renderHook(
    (props: MemoryProps) =>
      useTabSearchMemory(props.activeTab, props.search, props.isRecording),
    { initialProps }
  );
};

describe('useTabSearchMemory', () => {
  it('records the latest search per tab', () => {
    const { result, rerender } = renderMemory('test-cases', '?status=Failed');

    rerender({ activeTab: 'test-cases', search: '?status=Success' });
    rerender({ activeTab: 'test-suites', search: '?owner=admin' });

    expect(result.current('test-cases')).toBe('?status=Success');
    expect(result.current('test-suites')).toBe('?owner=admin');
  });

  it('returns an empty search for a tab that was never visited', () => {
    const { result } = renderMemory('test-cases', '?status=Failed');

    expect(result.current('summary')).toBe('');
  });

  it('does not record while another route owns the URL', () => {
    const { result, rerender } = renderMemory('test-cases', '?status=Failed');

    rerender({
      activeTab: 'test-cases',
      search: '?q=other-route',
      isRecording: false,
    });

    expect(result.current('test-cases')).toBe('?status=Failed');
  });

  it('keeps the same lookup function across renders', () => {
    const { result, rerender } = renderMemory('test-cases', '?status=Failed');
    const firstLookup = result.current;

    rerender({ activeTab: 'test-suites', search: '' });

    expect(result.current).toBe(firstLookup);
  });
});
