/*
 *  Copyright 2023 Collate.
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
import { isEmpty } from 'lodash';
import React, { FC, ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { EntityUnion } from '../../components/Explore/ExplorePage.interface';
import { LoginConfiguration } from '../../generated/configuration/loginConfiguration';
import { LogoConfiguration } from '../../generated/configuration/logoConfiguration';
import { User } from '../../generated/entity/teams/user';
import { EntityReference } from '../../generated/entity/type';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getCustomLogoConfig } from '../../rest/settingConfigAPI';
import { isProtectedRoute } from '../../utils/AuthProvider.util';

export interface ApplicationContextConfig
  extends LogoConfiguration,
    LoginConfiguration {
  userProfilePics: Record<string, User>;
  updateUserProfilePics: (data: { id: string; user: User }) => void;
  cachedEntityData: Record<string, EntityUnion>;
  updateCachedEntityData: (data: {
    id: string;
    entityDetails: EntityUnion;
  }) => void;
  urlPathName: string;
  selectedPersona: EntityReference;
  updateSelectedPersona: (personaFqn: EntityReference) => void;
}

export enum UserProfileLoadingStatus {
  INITIAL = 'initial',
  LOADING = 'loading',
  ERROR = 'error',
  COMPLETED = 'completed',
}

export interface UserProfileMap {
  user?: User;
  status: UserProfileLoadingStatus;
}

interface ApplicationConfigProviderProps {
  children: ReactNode;
}

const ApplicationConfigProvider: FC<ApplicationConfigProviderProps> = ({
  children,
}) => {
  const location = useLocation();
  const { applicationConfig, setApplicationConfig, setUrlPathName } =
    useApplicationStore();

  useEffect(() => {
    if (isProtectedRoute(location.pathname)) {
      setUrlPathName(location.pathname);
    }
  }, [location.pathname]);

  const fetchApplicationConfig = async () => {
    try {
      const data = await getCustomLogoConfig();

      setApplicationConfig({
        ...data,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  };

  useEffect(() => {
    fetchApplicationConfig();
  }, []);

  useEffect(() => {
    const faviconHref = isEmpty(applicationConfig?.customFaviconUrlPath)
      ? '/favicon.png'
      : applicationConfig?.customFaviconUrlPath ?? '/favicon.png';
    const link = document.querySelector('link[rel~="icon"]');

    if (link) {
      link.setAttribute('href', faviconHref);
    }
  }, [applicationConfig]);

  return <>{children}</>;
};

export default ApplicationConfigProvider;
