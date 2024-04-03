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
import { AxiosError } from 'axios';
import { create } from 'zustand';
import {
  ACTIVE_DOMAIN_STORAGE_KEY,
  DEFAULT_DOMAIN_VALUE,
  PAGE_SIZE_LARGE,
} from '../constants/constants';
import { Domain } from '../generated/entity/domains/domain';
import { DomainStore } from '../interface/store.interface';
import { getDomainList } from '../rest/domainAPI';
import { showErrorToast } from '../utils/ToastUtils';

export const useDomainStore = create<DomainStore>((set, get) => ({
  domains: [],
  domainLoading: false,
  activeDomain:
    localStorage.getItem(ACTIVE_DOMAIN_STORAGE_KEY) ?? DEFAULT_DOMAIN_VALUE,
  domainOptions: [],
  fetchDomainList: async () => {
    set({ domainLoading: true });
    try {
      const { data } = await getDomainList({ limit: PAGE_SIZE_LARGE });
      set({ domains: data });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      set({ domainLoading: false });
    }
  },
  updateDomains: (domainsArr: Domain[]) => set({ domains: domainsArr }),
  refreshDomains: () => get().fetchDomainList(),
  updateActiveDomain: (activeDomainKey: string) => {
    localStorage.setItem(ACTIVE_DOMAIN_STORAGE_KEY, activeDomainKey);
    get().refreshDomains();
  },
}));
