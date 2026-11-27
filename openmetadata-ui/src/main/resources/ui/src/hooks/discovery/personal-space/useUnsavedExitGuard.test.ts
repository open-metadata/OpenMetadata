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
import { usePersonalSpaceStore } from '../../usePersonalSpaceStore';
import {
  guardBreadcrumbAction,
  runUnderExitGuard,
  useUnsavedExitGuard,
} from './useUnsavedExitGuard';

describe('useUnsavedExitGuard', () => {
  afterEach(() => usePersonalSpaceStore.getState().setExitGuard(null));

  it('lets a clean editor leave at once and registers no modal guard', () => {
    const exit = jest.fn();
    const { result } = renderHook(() => useUnsavedExitGuard(false));

    act(() => result.current.runGuarded(exit));

    expect(exit).toHaveBeenCalledTimes(1);
    expect(result.current.isPromptOpen).toBe(false);
    expect(usePersonalSpaceStore.getState().exitGuard).toBeNull();
  });

  it('holds an exit from a dirty editor until Discard', () => {
    const exit = jest.fn();
    const { result } = renderHook(() => useUnsavedExitGuard(true));

    act(() => result.current.runGuarded(exit));

    expect(exit).not.toHaveBeenCalled();
    expect(result.current.isPromptOpen).toBe(true);

    act(() => result.current.confirmExit());

    expect(exit).toHaveBeenCalledTimes(1);
    expect(result.current.isPromptOpen).toBe(false);
  });

  it('drops the held exit on Continue editing', () => {
    const exit = jest.fn();
    const { result } = renderHook(() => useUnsavedExitGuard(true));

    act(() => result.current.runGuarded(exit));
    act(() => result.current.cancelExit());
    act(() => result.current.confirmExit());

    expect(exit).not.toHaveBeenCalled();
    expect(result.current.isPromptOpen).toBe(false);
  });

  it('holds modal-level exits (sidebar, Esc) while dirty and releases them once clean', () => {
    const exit = jest.fn();
    const { result, rerender, unmount } = renderHook(
      ({ dirty }) => useUnsavedExitGuard(dirty),
      { initialProps: { dirty: true } }
    );

    let held = false;
    act(() => {
      held = usePersonalSpaceStore.getState().exitGuard?.(exit) ?? false;
    });

    expect(held).toBe(true);
    expect(result.current.isPromptOpen).toBe(true);

    rerender({ dirty: false });

    expect(usePersonalSpaceStore.getState().exitGuard).toBeNull();

    rerender({ dirty: true });
    unmount();

    expect(usePersonalSpaceStore.getState().exitGuard).toBeNull();
  });

  it('keeps the other editor guard in place when one editor unmounts', () => {
    const first = renderHook(() => useUnsavedExitGuard(true));
    const second = renderHook(() => useUnsavedExitGuard(true));
    const secondGuard = usePersonalSpaceStore.getState().exitGuard;

    first.unmount();

    expect(usePersonalSpaceStore.getState().exitGuard).toBe(secondGuard);

    second.unmount();

    expect(usePersonalSpaceStore.getState().exitGuard).toBeNull();
  });
});

describe('guardBreadcrumbAction', () => {
  afterEach(() => usePersonalSpaceStore.getState().setExitGuard(null));

  it('is undefined without an action', () => {
    expect(guardBreadcrumbAction()).toBeUndefined();
  });

  it('runs the action when no editor is dirty', () => {
    const action = jest.fn();

    guardBreadcrumbAction(action)?.('bots');

    expect(action).toHaveBeenCalledWith('bots');
  });

  it('hands the action to the dirty editor instead of running it', () => {
    const action = jest.fn();
    const guard = jest.fn().mockReturnValue(true);
    usePersonalSpaceStore.getState().setExitGuard(guard);

    guardBreadcrumbAction(action)?.('bots');

    expect(action).not.toHaveBeenCalled();

    guard.mock.calls[0][0]();

    expect(action).toHaveBeenCalledWith('bots');
  });

  it('runs an in-editor crumb at once even while an editor is dirty', () => {
    const action = jest.fn();
    const guard = jest.fn().mockReturnValue(true);
    usePersonalSpaceStore.getState().setExitGuard(guard);
    const onAction = guardBreadcrumbAction(action, ['provider']);

    onAction?.('provider');

    expect(action).toHaveBeenCalledWith('provider');
    expect(guard).not.toHaveBeenCalled();

    onAction?.('sso');

    expect(guard).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe('runUnderExitGuard', () => {
  afterEach(() => usePersonalSpaceStore.getState().setExitGuard(null));

  it('runs at once when no editor is dirty', () => {
    const go = jest.fn();

    runUnderExitGuard(go);

    expect(go).toHaveBeenCalledTimes(1);
  });

  it('leaves the exit to a dirty editor', () => {
    const go = jest.fn();
    const guard = jest.fn().mockReturnValue(true);
    usePersonalSpaceStore.getState().setExitGuard(guard);

    runUnderExitGuard(go);

    expect(go).not.toHaveBeenCalled();
    expect(guard).toHaveBeenCalledWith(go);
  });
});
