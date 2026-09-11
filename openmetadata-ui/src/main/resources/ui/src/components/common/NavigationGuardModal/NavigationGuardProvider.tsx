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
import {
  ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {
  HistoryGuard,
  NavigationGuardContext,
} from '../../../context/navigation/NavigationGuardContext';

export const NavigationGuardProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const guards = useRef(new Set<HistoryGuard>());
  const [ready, setReady] = useState(false);
  const register = useCallback((guard: HistoryGuard) => {
    guards.current.add(guard);

    return () => {
      guards.current.delete(guard);
    };
  }, []);

  useLayoutEffect(() => {
    const block = (event: PopStateEvent) => {
      Array.from(guards.current).at(-1)?.(event);
    };
    window.addEventListener('popstate', block);
    // Window listeners run in registration order, even with capture. Mount the router
    // only after this listener so it cannot unmount a dirty editor before confirmation.
    setReady(true);

    return () => window.removeEventListener('popstate', block);
  }, []);

  return (
    <NavigationGuardContext.Provider value={register}>
      {ready && children}
    </NavigationGuardContext.Provider>
  );
};
