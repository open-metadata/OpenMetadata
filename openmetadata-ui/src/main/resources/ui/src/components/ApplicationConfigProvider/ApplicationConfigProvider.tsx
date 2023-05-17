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
import { LogoConfiguration } from 'generated/configuration/applicationConfiguration';
import React, {
  createContext,
  FC,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { getCustomLogoConfig } from 'rest/settingConfigAPI';

export const ApplicationConfigContext = createContext<LogoConfiguration>(
  {} as LogoConfiguration
);

export const useApplicationConfigProvider = () =>
  useContext(ApplicationConfigContext);

interface ApplicationConfigProviderProps {
  children: ReactNode;
}

const ApplicationConfigProvider: FC<ApplicationConfigProviderProps> = ({
  children,
}) => {
  const [applicationConfig, setApplicationConfig] = useState<LogoConfiguration>(
    {} as LogoConfiguration
  );

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

  return (
    <ApplicationConfigContext.Provider value={{ ...applicationConfig }}>
      {children}
    </ApplicationConfigContext.Provider>
  );
};

export default ApplicationConfigProvider;
