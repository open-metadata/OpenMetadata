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
import { lazy, ReactNode } from 'react';
import { useFirstLoginWelcome } from '../../../hooks/useFirstLoginWelcome';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';

const WelcomeScreen = withSuspenseFallback(
  lazy(() => import('./WelcomeScreen.component'))
);

/**
 * Shows the first-login welcome screen in place of an AI-mode home route until
 * the user closes it or navigates away. Wrap the route element, not the page:
 * the same page may also render outside its route (e.g. in a modal).
 */
const WelcomeScreenGate = ({ children }: { children: ReactNode }) => {
  const { showWelcome, closeWelcome } = useFirstLoginWelcome();

  return showWelcome ? (
    <WelcomeScreen onClose={closeWelcome} />
  ) : (
    <>{children}</>
  );
};

export default WelcomeScreenGate;
