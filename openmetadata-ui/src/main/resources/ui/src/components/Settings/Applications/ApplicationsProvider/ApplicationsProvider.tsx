/*
 *  Copyright 2024 Collate.
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
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePluginStore } from 'react-pluggable';
import { RouteProps } from 'react-router-dom';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { EntityReference } from '../../../../generated/entity/type';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import axiosClient from '../../../../rest';
import { getInstalledApplicationList } from '../../../../rest/applicationAPI';
import Loader from '../../../common/Loader/Loader';
import applicationsClassBase from '../AppDetails/ApplicationsClassBase';
import { ApplicationsContextType } from './ApplicationsProvider.interface';

export const ApplicationsContext = createContext({} as ApplicationsContextType);

export const ApplicationsProvider = ({ children }: { children: ReactNode }) => {
  const [applications, setApplications] = useState<EntityReference[]>([]);
  const [applicationRoutes, setApplicationRoutes] = useState<RouteProps[]>([]);
  const [loading, setLoading] = useState(true);
  const { permissions } = usePermissionProvider();
  const { setApplicationsName } = useApplicationStore();
  const pluginStore = usePluginStore();

  const fetchApplicationList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getInstalledApplicationList();

      setApplications(data);
      const applicationsNameList = data.map(
        (app) => app.name ?? app.fullyQualifiedName ?? ''
      );
      setApplicationsName(applicationsNameList);

      await loadPlugin('AIChatPlugin');
    } catch (err) {
      // do not handle error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isEmpty(permissions)) {
      fetchApplicationList();
    } else {
      setLoading(false);
    }
  }, []);

  const loadPlugin = useCallback(async (appName: string) => {
    try {
      // Construct the module path dynamically based on the appName
      const PluginModule = await import(
        applicationsClassBase.getPluginPath(appName)
      );

      // Initialize and activate the plugin with axiosClient
      const plugin = new PluginModule.default(axiosClient);
      pluginStore.install(plugin);
      if (plugin.routes) {
        setApplicationRoutes([...applicationRoutes, ...plugin.routes]);
      }
    } catch (err) {
      // do nothing
    }
  }, []);

  const appContext = useMemo(() => {
    return { applications, applicationRoutes };
  }, [applications, applicationRoutes]);

  return (
    <ApplicationsContext.Provider value={appContext}>
      {loading ? <Loader /> : children}
    </ApplicationsContext.Provider>
  );
};

export const useApplicationsProvider = () => useContext(ApplicationsContext);

export default ApplicationsProvider;
