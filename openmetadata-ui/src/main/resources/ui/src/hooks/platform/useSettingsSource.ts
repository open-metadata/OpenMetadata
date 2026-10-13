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

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { SettingType } from '../../generated/settings/settings';
import { SettingSource } from '../../generated/system/settingsSourceResponse';
import { getSettingsSource } from '../../rest/settingConfigAPI';

export const SETTINGS_SOURCE_QUERY_KEY = ['settings-source'];

export interface UseSettingsSourceResult {
  sources: SettingSource[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Where the given settings take their values from. One request serves every setting on the page.
 * A failed request (403 for non-admins, 404 on servers without the endpoint) yields no sources,
 * so callers render as if the settings were stored only in the database.
 */
export const useSettingsSource = (
  configTypes: SettingType[]
): UseSettingsSourceResult => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: SETTINGS_SOURCE_QUERY_KEY,
    queryFn: getSettingsSource,
  });
  // Callers pass an inline array literal; keying the filter on its contents keeps `sources` stable.
  const configTypesKey = configTypes.join();

  const sources = useMemo(() => {
    const requested = new Set<string>(configTypesKey.split(','));

    return (data?.settings ?? []).filter((source) =>
      requested.has(source.configType)
    );
  }, [data, configTypesKey]);

  const refetchSources = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return { sources, isLoading, refetch: refetchSources };
};
