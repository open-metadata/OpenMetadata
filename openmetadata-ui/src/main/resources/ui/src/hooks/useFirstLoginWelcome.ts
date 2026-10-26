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
import { useTourProvider } from '../context/TourProvider/TourProvider';
import { updateUserDetail } from '../rest/userAPI';
import { useApplicationStore } from './useApplicationStore';
import { useWelcomeStore } from './useWelcomeStore';

// ponytail: the welcome screen used to be remembered only in this localStorage
// list. Still read so users who dismissed it before the backend field existed
// are backfilled instead of shown it again; drop once that release has rolled out.
const isSeenInThisBrowser = (userName: string) =>
  (localStorage.getItem(LOGGED_IN_USER_STORAGE_KEY) ?? '')
    .split(',')
    .includes(userName);

/**
 * Whether the home route should show the first-login welcome screen, shared by
 * the classic and AI-mode homes so both apply the same rule: once per user
 * (tracked on the user as `welcomeScreenSeenAt`, so it holds across browsers),
 * only while `isWelcomeVisible` is on, and never on the tour, where it would
 * hide the step targets. Leaving the route dismisses it: by unmount on the
 * classic home, and by the route turning hidden where KeepAliveRoutes keeps the
 * AI-mode home mounted.
 */
export const useFirstLoginWelcome = () => {
  const { currentUser, updateCurrentUser } = useApplicationStore();
  const { isWelcomeVisible } = useWelcomeStore();
  const { isTourPage } = useTourProvider();
  const isRouteVisible = useIsRouteVisible();

  const [showWelcome, setShowWelcome] = useState(false);

  const markWelcomeSeen = async () => {
    if (!currentUser || currentUser.welcomeScreenSeenAt) {
      return;
    }
    const welcomeScreenSeenAt = Date.now();
    updateCurrentUser({ ...currentUser, welcomeScreenSeenAt });
    try {
      await updateUserDetail(currentUser.id, [
        { op: 'add', path: '/welcomeScreenSeenAt', value: welcomeScreenSeenAt },
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
      !currentUser.welcomeScreenSeenAt &&
      !isSeenInThisBrowser(currentUser.name);
    setShowWelcome(isFirstVisit && isWelcomeVisible && !isTourPage);
    markWelcomeSeen();
  }, []);

  useEffect(() => {
    if (!isRouteVisible && showWelcome) {
      setShowWelcome(false);
    }
  }, [isRouteVisible, showWelcome]);

  return { showWelcome, closeWelcome: () => setShowWelcome(false) };
};
