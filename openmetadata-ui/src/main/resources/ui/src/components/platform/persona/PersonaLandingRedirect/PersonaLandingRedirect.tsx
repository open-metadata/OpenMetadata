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
import { CookieStorage } from 'cookie-storage';
import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import { DEFAULT_LANDING_PAGE } from '../../../../constants/platform/personaLandingPage.constants';
import { REDIRECT_PATHNAME } from '../../../../constants/router.constants';
import { usePersonaDocument } from '../../../../hooks/platform/usePersonaDocument';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { resolvePersonaLandingPage } from '../../../../utils/CustomizePage/PersonaPage.utils';
import Loader from '../../../common/Loader/Loader';

interface PersonaLandingRedirectProps {
  children: ReactNode;
}

/**
 * Sends the page the app opens on — `/`, after a sign-in, a reload or in a new
 * tab, in either app mode — to the selected persona's default landing page.
 *
 * Only that first page is redirected: an in-app visit to `/` later (the logo,
 * the AI home) is left alone. A deep link stored before sign-in also wins —
 * PermissionProvider redirects to it once permissions load.
 */
export const PersonaLandingRedirect = ({
  children,
}: PersonaLandingRedirectProps) => {
  const { pathname } = useCustomLocation();
  const [isEntry, setIsEntry] = useState(
    () =>
      pathname === ROUTES.HOME &&
      !new CookieStorage().getItem(REDIRECT_PATHNAME)
  );
  const { personaDocument, personaId, isLoading } = usePersonaDocument({
    enabled: isEntry,
  });

  useEffect(() => {
    if (isEntry && !isLoading) {
      setIsEntry(false);
    }
  }, [isEntry, isLoading]);

  if (!isEntry) {
    return <>{children}</>;
  }

  // Holding the route tree back avoids rendering (and fetching for) the home
  // page only to leave it a moment later.
  if (isLoading) {
    return <Loader fullScreen />;
  }

  const landingPage = resolvePersonaLandingPage(personaDocument, personaId);

  return landingPage === DEFAULT_LANDING_PAGE ? (
    <>{children}</>
  ) : (
    <Navigate replace to={landingPage} />
  );
};
