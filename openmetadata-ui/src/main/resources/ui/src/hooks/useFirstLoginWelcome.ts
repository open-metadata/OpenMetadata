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
import { useEffect, useState } from 'react';
import { LOGGED_IN_USER_STORAGE_KEY } from '../constants/constants';
import { useIsRouteVisible } from '../context/RouteVisibilityProvider/RouteVisibilityProvider';
import { updateUserDetail } from '../rest/userAPI';
import { useProductTourStore } from './product-tour/useProductTourStore';
import { useApplicationStore } from './useApplicationStore';
import { useWelcomeStore } from './useWelcomeStore';

// The legacy per-browser list of users who saw the welcome screen. Read so a
// user it covers is recorded on the server instead of being shown it again,
// including users the 2.1.0 migration had no login or activity time for.
const isSeenInThisBrowser = (userName: string) =>
  (localStorage.getItem(LOGGED_IN_USER_STORAGE_KEY) ?? '')
    .split(',')
    .includes(userName);

/**
 * Whether the home route should show the first-login welcome screen, shared by
 * the classic and AI-mode homes so both apply the same rule: once per user
 * (tracked on the user as `isFirstTimeUser`, so it holds across browsers),
 * only while `isWelcomeVisible` is on, and never on the tour, where it would
 * hide the step targets. Leaving the route dismisses it: by unmount on the
 * classic home, and by the route turning hidden where KeepAliveRoutes keeps the
 * AI-mode home mounted.
 */
export const useFirstLoginWelcome = () => {
  const { currentUser, updateCurrentUser } = useApplicationStore();
  const { isWelcomeVisible } = useWelcomeStore();
  // A tour shows the home page itself; the welcome screen would cover it.
  const isTourRunning = useProductTourStore((state) => state.isActive);
  const isRouteVisible = useIsRouteVisible();

  const [showWelcome, setShowWelcome] = useState(false);

  const markReturningUser = async () => {
    if (!currentUser?.isFirstTimeUser) {
      return;
    }
    updateCurrentUser({ ...currentUser, isFirstTimeUser: false });
    try {
      await updateUserDetail(currentUser.id, [
        { op: 'add', path: '/isFirstTimeUser', value: false },
      ]);
    } catch {
      // Not worth an error toast: the worst case is the welcome screen showing
      // once more on the user's next visit.
    }
  };

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    const isFirstVisit =
      currentUser.isFirstTimeUser && !isSeenInThisBrowser(currentUser.name);
    setShowWelcome(Boolean(isFirstVisit) && isWelcomeVisible && !isTourRunning);
    markReturningUser();
  }, []);

  useEffect(() => {
    if (!isRouteVisible && showWelcome) {
      setShowWelcome(false);
    }
  }, [isRouteVisible, showWelcome]);

  return { showWelcome, closeWelcome: () => setShowWelcome(false) };
};
