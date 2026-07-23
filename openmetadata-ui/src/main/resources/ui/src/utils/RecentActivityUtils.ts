/*
 *  Copyright 2022 Collate.
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

import { get } from 'lodash';
import {
  RecentlySearched,
  RecentlySearchedData,
  RecentlyViewedData,
} from 'Models';
import { usePersistentStorage } from '../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../hooks/useApplicationStore';

export const arraySorterByKey = <T extends object>(
  key: keyof T,
  sortDescending = false
) => {
  const sortOrder = sortDescending ? -1 : 1;

  return (elementOne: T, elementTwo: T) => {
    return (
      (elementOne[key] < elementTwo[key]
        ? -1
        : elementOne[key] > elementTwo[key]
        ? 1
        : 0) * sortOrder
    );
  };
};

export const getRecentlyViewedData = (): Array<RecentlyViewedData> => {
  const currentUser = useApplicationStore.getState().currentUser;
  let recentlyViewed: RecentlyViewedData[] = [];

  if (currentUser) {
    const { preferences } = usePersistentStorage.getState();
    recentlyViewed = get(preferences, [currentUser.name, 'recentlyViewed'], []);
  }

  return recentlyViewed;
};

export const setRecentlyViewedData = (
  recentData: Array<RecentlyViewedData>
): void => {
  const currentUser = useApplicationStore.getState().currentUser;
  if (!currentUser) {
    return;
  }
  const { setUserPreference } = usePersistentStorage.getState();
  setUserPreference(currentUser.name, { recentlyViewed: recentData });
};

export const addToRecentViewed = (eData: RecentlyViewedData): void => {
  const entityData = { ...eData, timestamp: Date.now() };
  const currentUser = useApplicationStore.getState().currentUser;
  let recentlyViewed: RecentlyViewedData[] = [];
  if (!currentUser) {
    recentlyViewed = [];
  } else {
    const { preferences } = usePersistentStorage.getState();
    recentlyViewed = get(preferences, [currentUser.name, 'recentlyViewed'], []);
  }

  let newData = [...recentlyViewed];
  if (recentlyViewed) {
    const arrData = recentlyViewed
      .filter((item) => item.fqn !== entityData.fqn)
      .sort(arraySorterByKey<RecentlyViewedData>('timestamp', true));
    arrData.unshift(entityData);

    if (arrData.length > 8) {
      arrData.pop();
    }
    newData = arrData;
  } else {
    newData = [entityData];
  }
  setRecentlyViewedData(newData);
};

export const setRecentlySearchedData = (
  recentData: Array<RecentlySearchedData>
): void => {
  const currentUser = useApplicationStore.getState().currentUser;
  if (!currentUser) {
    return;
  }
  const { setUserPreference } = usePersistentStorage.getState();
  setUserPreference(currentUser.name, { recentlySearched: recentData });
};

export const addToRecentSearched = (searchTerm: string): void => {
  if (searchTerm.trim()) {
    const searchData = { term: searchTerm, timestamp: Date.now() };
    const currentUser = useApplicationStore.getState().currentUser;
    let recentlySearched: RecentlySearchedData[] = [];
    if (!currentUser) {
      recentlySearched = [];
    } else {
      const { preferences } = usePersistentStorage.getState();
      recentlySearched = get(
        preferences,
        [currentUser.name, 'recentlySearched'],
        []
      );
    }

    let arrSearchedData: RecentlySearched['data'] = [];
    if (recentlySearched && recentlySearched.length > 0) {
      const arrData = recentlySearched
        // search term is not case-insensitive.
        .filter((item) => item.term !== searchData.term)
        .sort(arraySorterByKey<RecentlySearchedData>('timestamp', true));
      arrData.unshift(searchData);

      if (arrData.length > 5) {
        arrData.pop();
      }
      arrSearchedData = arrData;
    } else {
      arrSearchedData = [searchData];
    }
    setRecentlySearchedData(arrSearchedData);
  }
};
