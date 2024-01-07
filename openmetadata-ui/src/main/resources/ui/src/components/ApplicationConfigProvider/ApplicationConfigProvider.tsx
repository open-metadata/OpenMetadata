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
import { cloneDeep, isEmpty } from 'lodash';
import React, {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import { LoginConfiguration } from '../../generated/configuration/loginConfiguration';
import { LogoConfiguration } from '../../generated/configuration/logoConfiguration';
import { User } from '../../generated/entity/teams/user';
import { EntityReference } from '../../generated/entity/type';
import { getCustomLogoConfig } from '../../rest/settingConfigAPI';
import { isProtectedRoute } from '../../utils/AuthProvider.util';
import { EntityUnion } from '../Explore/ExplorePage.interface';

export interface ApplicationContextConfig
  extends LogoConfiguration,
    LoginConfiguration {
  routeElements?: ReactNode;
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

export const ApplicationConfigContext = createContext<ApplicationContextConfig>(
  {} as ApplicationContextConfig
);

export const useApplicationConfigContext = () =>
  useContext(ApplicationConfigContext);

interface ApplicationConfigProviderProps {
  children: ReactNode;
  routeElements?: ReactNode;
}

const ApplicationConfigProvider: FC<ApplicationConfigProviderProps> = ({
  children,
  routeElements,
}) => {
  const location = useLocation();
  const [applicationConfig, setApplicationConfig] = useState<LogoConfiguration>(
    {} as LogoConfiguration
  );
  const [selectedPersona, setSelectedPersona] = useState<EntityReference>(
    {} as EntityReference
  );
  const [userProfilePics, setUserProfilePics] = useState<Record<string, User>>(
    {}
  );
  const [cachedEntityData, setCachedEntityData] = useState<
    Record<string, EntityUnion>
  >({});

  const [urlPathName, setUrlPathName] = useState<string>('');

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

  const updateSelectedPersona = useCallback(
    (persona: EntityReference) => {
      setSelectedPersona(persona);
    },
    [setSelectedPersona]
  );

  const updateUserProfilePics = useCallback(
    ({ id, user }: { id: string; user: User }) => {
      setUserProfilePics((prev) => {
        const updatedMap = cloneDeep(prev);
        updatedMap[id] = { ...(prev[id] ?? {}), ...user };

        return updatedMap;
      });
    },
    []
  );

  const updateCachedEntityData = useCallback(
    ({ id, entityDetails }: { id: string; entityDetails: EntityUnion }) => {
      setCachedEntityData((prev) => ({ ...prev, [id]: entityDetails }));
    },
    []
  );

  useEffect(() => {
    fetchApplicationConfig();
  }, []);

  useEffect(() => {
    const faviconHref = isEmpty(applicationConfig.customFaviconUrlPath)
      ? '/favicon.png'
      : applicationConfig.customFaviconUrlPath ?? '/favicon.png';
    const link = document.querySelector('link[rel~="icon"]');

    if (link) {
      link.setAttribute('href', faviconHref);
    }
  }, [applicationConfig]);

  const contextValue = useMemo(
    () => ({
      ...applicationConfig,
      routeElements,
      selectedPersona,
      updateSelectedPersona,
      userProfilePics,
      updateUserProfilePics,
      cachedEntityData,
      updateCachedEntityData,
      urlPathName,
    }),
    [
      applicationConfig,
      routeElements,
      selectedPersona,
      updateSelectedPersona,
      userProfilePics,
      updateUserProfilePics,
      cachedEntityData,
      updateCachedEntityData,
    ]
  );

  return (
    <ApplicationConfigContext.Provider value={contextValue}>
      {children}
    </ApplicationConfigContext.Provider>
  );
};

export default ApplicationConfigProvider;
