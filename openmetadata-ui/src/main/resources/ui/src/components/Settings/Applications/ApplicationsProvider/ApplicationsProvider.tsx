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
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { EntityReference } from '../../../../generated/entity/type';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getInstalledApplicationList } from '../../../../rest/applicationAPI';
import { ExtensionPointRegistry } from '../../../../utils/ExtensionPointRegistry';
import type { AppPlugin } from '../plugins/AppPlugin';
import { ApplicationsContextType } from './ApplicationsProvider.interface';

export const ApplicationsContext = createContext({} as ApplicationsContextType);

export const ApplicationsProvider = ({ children }: { children: ReactNode }) => {
  const [applications, setApplications] = useState<EntityReference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [installedPluginInstances, setInstalledPluginInstances] = useState<
    AppPlugin[]
  >([]);
  const { permissions } = usePermissionProvider();
  const { setApplicationsName, setApplicationsLoaded } = useApplicationStore();
  const hasPermissions = !isEmpty(permissions);

  // Create extension registry (singleton for the app lifecycle)
  const [extensionRegistry] = useState(() => new ExtensionPointRegistry());
  // `extensionRegistry` keeps one identity for the whole app lifecycle —
  // `contribute()` mutates its internal Map in place, which triggers no
  // re-render by itself. A consumer that memoizes on `extensionRegistry`
  // (e.g. `AppModeRoutes`'s route table) would recompute once, before any
  // plugin's `contributeExtensions` has run (see the effect below), then
  // NEVER again, permanently missing every contribution. Bumping this after
  // registration gives those consumers a dependency that actually changes,
  // so they recompute exactly once with contributions in place.
  const [contributionsVersion, setContributionsVersion] = useState(0);

  const fetchApplicationList = useCallback(async () => {
    try {
      const data = await getInstalledApplicationList();

      setApplications(data);
      const applicationsNameList = data.map(
        (app) => app.name ?? app.fullyQualifiedName ?? ''
      );
      setApplicationsName(applicationsNameList);
      setInstalledPluginInstances([]);

      // Only pay for the ApplicationsClassBase chunk when there is a name that could resolve a
      // plugin — apps missing both name and FQN map to '' and never match the registry.
      const pluginNames = applicationsNameList.filter(Boolean);

      if (pluginNames.length > 0) {
        const { default: applicationsClassBase } = await import(
          '../AppDetails/ApplicationsClassBase'
        );
        const plugins = pluginNames
          .map((applicationName) => {
            const PluginClass =
              applicationsClassBase.appPluginRegistry[applicationName];

            return PluginClass ? new PluginClass(applicationName, true) : null;
          })
          .filter((plugin): plugin is AppPlugin => plugin !== null);

        setInstalledPluginInstances(plugins);
      }
    } catch {
      // do not handle error
    } finally {
      setIsLoading(false);
      // Signal to downstream consumers (plugins, mode-aware code) that
      // `applications` reflects server state. Set unconditionally —
      // even on fetch error the list is "as loaded as it's going to
      // be" and consumers should stop waiting.
      setApplicationsLoaded(true);
    }
  }, [setApplicationsLoaded, setApplicationsName]);

  useEffect(() => {
    if (hasPermissions) {
      fetchApplicationList();
    } else {
      setIsLoading(false);
      // No permissions to fetch — applications stays `[]` but the
      // "loaded" signal still needs to flip so downstream consumers
      // gating on it don't wait forever.
      setApplicationsLoaded(true);
    }
  }, [fetchApplicationList, hasPermissions, setApplicationsLoaded]);

  // Let plugins contribute to extension points. Runs after commit, so a
  // memoized consumer keyed on `extensionRegistry`'s identity alone would
  // recompute using its render-time (pre-contribution) state — bump
  // `contributionsVersion` so such consumers have a deps entry that changes
  // once contributions are actually in.
  useEffect(() => {
    installedPluginInstances.forEach((plugin) => {
      try {
        plugin.contributeExtensions?.(extensionRegistry);
      } catch {
        // Silently ignore errors during plugin contribution
      }
    });
    setContributionsVersion((version) => version + 1);
  }, [installedPluginInstances, extensionRegistry]);

  const appContext = useMemo(() => {
    return {
      applications,
      isLoading,
      plugins: installedPluginInstances,
      extensionRegistry,
      contributionsVersion,
    };
  }, [
    applications,
    isLoading,
    installedPluginInstances,
    extensionRegistry,
    contributionsVersion,
  ]);

  return (
    <ApplicationsContext.Provider value={appContext}>
      {children}
    </ApplicationsContext.Provider>
  );
};

export const useApplicationsProvider = () => useContext(ApplicationsContext);

export default ApplicationsProvider;
