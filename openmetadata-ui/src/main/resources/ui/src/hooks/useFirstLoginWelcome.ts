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
import { useEffect, useMemo, useState } from 'react';
import { LOGGED_IN_USER_STORAGE_KEY } from '../constants/constants';
import { useIsRouteVisible } from '../context/RouteVisibilityProvider/RouteVisibilityProvider';
import { useProductTourStore } from './product-tour/useProductTourStore';
import { useApplicationStore } from './useApplicationStore';
import { useWelcomeStore } from './useWelcomeStore';

/**
 * Whether the home route should show the first-login welcome screen, shared by
 * the classic and AI-mode homes so both apply the same rule: once per user
 * (tracked in `localStorage`), only while `isWelcomeVisible` is on, and never
 * on the tour, where it would hide the step targets. Leaving the route dismisses
 * it: by unmount on the classic home, and by the route turning hidden where
 * KeepAliveRoutes keeps the AI-mode home mounted.
 */
export const useFirstLoginWelcome = () => {
  const { currentUser } = useApplicationStore();
  const { isWelcomeVisible } = useWelcomeStore();
  // A tour shows the home page itself; the welcome screen would cover it.
  const isTourRunning = useProductTourStore((state) => state.isActive);
  const isRouteVisible = useIsRouteVisible();

  const [showWelcome, setShowWelcome] = useState(false);

  const storageData = useMemo(
    () => localStorage.getItem(LOGGED_IN_USER_STORAGE_KEY),
    []
  );
  const loggedInUserName = currentUser?.name ?? '';
  const usernameExistsInCookie = useMemo(
    () =>
      storageData ? storageData.split(',').includes(loggedInUserName) : false,
    [storageData, loggedInUserName]
  );

  const updateWelcome = (show: boolean) => {
    if (loggedInUserName) {
      const seen = storageData ? storageData.split(',') : [];
      if (!seen.includes(loggedInUserName)) {
        seen.push(loggedInUserName);
        localStorage.setItem(LOGGED_IN_USER_STORAGE_KEY, seen.join(','));
      }
    }
    setShowWelcome(show);
  };

  useEffect(() => {
    updateWelcome(
      !usernameExistsInCookie && isWelcomeVisible && !isTourRunning
    );

    return () => updateWelcome(false);
  }, []);

  useEffect(() => {
    if (!isRouteVisible && showWelcome) {
      setShowWelcome(false);
    }
  }, [isRouteVisible, showWelcome]);

  return { showWelcome, closeWelcome: () => updateWelcome(false) };
};
