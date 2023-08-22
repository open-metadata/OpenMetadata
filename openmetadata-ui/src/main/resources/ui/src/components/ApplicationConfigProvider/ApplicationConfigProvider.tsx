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
import Loader from 'components/Loader/Loader';
import { LogoConfiguration } from 'generated/configuration/applicationConfiguration';
import { AuthenticationConfiguration } from 'generated/configuration/authenticationConfiguration';
import { AuthorizerConfiguration } from 'generated/configuration/authorizerConfiguration';
import React, {
  createContext,
  FC,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { fetchAuthenticationConfig, fetchAuthorizerConfig } from 'rest/miscAPI';
import { getCustomLogoConfig } from 'rest/settingConfigAPI';

export const ApplicationConfigContext = createContext<ApplicationConfig>(
  {} as ApplicationConfig
);

export const useApplicationConfigProvider = () =>
  useContext(ApplicationConfigContext);

interface ApplicationConfigProviderProps {
  children: ReactNode;
}

interface ApplicationConfig {
  auth: AuthenticationConfiguration;
  authorizer: AuthorizerConfiguration;
  logo: LogoConfiguration;
}

const ApplicationConfigProvider: FC<ApplicationConfigProviderProps> = ({
  children,
}) => {
  const [applicationConfig, setApplicationConfig] = useState<ApplicationConfig>(
    {} as ApplicationConfig
  );
  const [isLoading, setIsLoading] = useState(true);

  const fetchApplicationConfig = async () => {
    try {
      const [authConfig, authorizerConfig, logoConfig] = await Promise.all([
        fetchAuthenticationConfig(),
        fetchAuthorizerConfig(),
        getCustomLogoConfig(),
      ]);

      setApplicationConfig({
        auth: authConfig,
        authorizer: authorizerConfig,
        logo: logoConfig,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicationConfig();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <ApplicationConfigContext.Provider value={applicationConfig}>
      {children}
    </ApplicationConfigContext.Provider>
  );
};

export default ApplicationConfigProvider;
