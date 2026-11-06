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
import { renderHook, waitFor } from '@testing-library/react';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getDocumentByFQN } from '../../../../rest/DocStoreAPI';
import { APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT } from './appModeSidebar.constants';
import { IconComponent, MainNavItem, MORE_NAV_KEY } from './navConfig';
import { useCustomizedMainNav } from './useCustomizedMainNav';

jest.mock('../../../../hooks/useApplicationStore');
jest.mock('../../../../rest/DocStoreAPI', () => ({
  getDocumentByFQN: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockUseApplicationStore = useApplicationStore as unknown as jest.Mock;
const mockGetDocumentByFQN = getDocumentByFQN as jest.Mock;

const Icon = (() => null) as unknown as IconComponent;
const items: MainNavItem[] = ['a', 'b', 'c'].map((key) => ({
  key,
  icon: Icon,
  labelKey: `label.${key}`,
  action: { kind: 'navigate', path: `/${key}` },
}));

const nodeKeys = (nodes: ReturnType<typeof useCustomizedMainNav>['nodes']) =>
  nodes.map((n) => (n.type === 'item' ? n.item.key : MORE_NAV_KEY));

describe('useCustomizedMainNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default nodes when no persona is selected (no fetch)', () => {
    mockUseApplicationStore.mockReturnValue({ selectedPersona: undefined });

    const { result } = renderHook(() => useCustomizedMainNav(items));

    expect(mockGetDocumentByFQN).not.toHaveBeenCalled();
    // With 3 items and a default visible count, the overflow sits under More.
    expect(nodeKeys(result.current.nodes)).toContain(MORE_NAV_KEY);
    expect(nodeKeys(result.current.nodes)).toEqual(
      expect.arrayContaining(['a', 'b', 'c'])
    );
  });

  it("applies the selected persona's stored customization", async () => {
    mockUseApplicationStore.mockReturnValue({
      selectedPersona: { fullyQualifiedName: 'p1' },
    });
    mockGetDocumentByFQN.mockResolvedValue({
      data: {
        askCollateSidebar: [
          { id: 'c', pageId: 'c', title: 'label.c', isHidden: false },
          { id: 'a', pageId: 'a', title: 'label.a', isHidden: true },
        ],
      },
    });

    const { result } = renderHook(() => useCustomizedMainNav(items));

    await waitFor(() =>
      expect(mockGetDocumentByFQN).toHaveBeenCalledWith('persona.p1')
    );

    // 'c' kept, 'a' hidden (dropped), 'b' appended as a newly-unlisted item.
    await waitFor(() => {
      const keys = nodeKeys(result.current.nodes).filter(
        (k) => k !== MORE_NAV_KEY
      );

      expect(keys[0]).toBe('c');
      expect(keys).not.toContain('a');
      expect(keys).toContain('b');
    });
  });

  it('re-fetches when the customization-changed event fires', async () => {
    mockUseApplicationStore.mockReturnValue({
      selectedPersona: { fullyQualifiedName: 'p1' },
    });
    mockGetDocumentByFQN.mockResolvedValue({ data: {} });

    renderHook(() => useCustomizedMainNav(items));

    await waitFor(() => expect(mockGetDocumentByFQN).toHaveBeenCalledTimes(1));

    window.dispatchEvent(
      new CustomEvent(APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT)
    );

    await waitFor(() => expect(mockGetDocumentByFQN).toHaveBeenCalledTimes(2));
  });
});
