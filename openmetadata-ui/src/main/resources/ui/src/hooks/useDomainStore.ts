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
import { persist } from 'zustand/middleware';
import {
  DEFAULT_DOMAIN_VALUE,
  DOMAIN_STORAGE_KEY,
  ES_MAX_PAGE_SIZE,
} from '../constants/constants';
import { Domain } from '../generated/entity/domains/domain';
import { EntityReference } from '../generated/entity/type';
import { DomainStore } from '../interface/store.interface';
import { getDomainList } from '../rest/domainAPI';
import {
  getDomainOptions,
  initializeDomainEntityRef,
} from '../utils/DomainUtils';
import { showErrorToast } from '../utils/ToastUtils';
import { useApplicationStore } from './useApplicationStore';

export const useDomainStore = create<DomainStore>()(
  persist(
    (set, get) => ({
      domains: [],
      userDomains: [],
      domainLoading: false,
      activeDomain: DEFAULT_DOMAIN_VALUE, // Set default value here
      activeDomainEntityRef: undefined,
      domainOptions: [],
      fetchDomainList: async () => {
        const currentUser = useApplicationStore.getState().currentUser;
        const { isAdmin = false, domains = [] } = currentUser ?? {};
        const userDomainsObj = isAdmin ? [] : domains;
        const userDomainFqn =
          userDomainsObj.map((item) => item.fullyQualifiedName) ?? [];

        set({ domainLoading: true, userDomains: userDomainsObj });

        try {
          const { data } = await getDomainList({
            limit: ES_MAX_PAGE_SIZE,
            fields: 'parent',
          });

          let filteredDomains = data;
          if (domains.length > 0) {
            filteredDomains = data.filter((domain) =>
              userDomainFqn.includes(domain.fullyQualifiedName)
            );
          }

          set({
            domains: filteredDomains,
            domainOptions: getDomainOptions(
              isAdmin ? filteredDomains : userDomainsObj,
              isAdmin
            ),
          });

          if (!isAdmin && userDomainsObj.length > 0 && !get().activeDomain) {
            set({ activeDomain: userDomainsObj[0].fullyQualifiedName });
          }
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          set({ domainLoading: false });
        }
      },
      updateDomains: (domainsArr: Domain[]) => set({ domains: domainsArr }),
      refreshDomains: () => get().fetchDomainList(),
      updateActiveDomain: (activeDomainKey: string) => {
        const activeDomainEntityRef = initializeDomainEntityRef(
          get().domains,
          activeDomainKey
        );
        set({
          activeDomain: activeDomainKey,
          activeDomainEntityRef,
        });
        get().refreshDomains();
      },
      setDomains: (domainsArr: Domain[]) => {
        set({
          domains: domainsArr,
          domainOptions: getDomainOptions(domainsArr),
        });
      },
      setUserDomains: (userDomainsArr: EntityReference[]) => {
        set({
          userDomains: userDomainsArr,
        });
      },
    }),
    {
      name: DOMAIN_STORAGE_KEY,
      partialize: (state) => {
        const activeDomainEntityRef = initializeDomainEntityRef(
          state.domains,
          state.activeDomain
        );

        return {
          activeDomain: state.activeDomain,
          activeDomainEntityRef,
        };
      },
    }
  )
);
