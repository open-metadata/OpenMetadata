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
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_DOMAIN_VALUE,
  DOMAIN_STORAGE_KEY,
} from '../constants/constants';
import { Domain } from '../generated/entity/domains/domain';
import { EntityReference } from '../generated/entity/type';
import { DomainStore } from '../interface/store.interface';
import { getDomainOptions } from '../utils/DomainUtils';
import { useApplicationStore } from './useApplicationStore';

export const useDomainStore = create<DomainStore>()(
  persist(
    (set) => ({
      domains: [],
      userDomains: [],
      domainLoading: false,
      activeDomain: DEFAULT_DOMAIN_VALUE, // Set default value here
      activeDomainEntityRef: undefined,
      domainOptions: [],
      updateDomains: (data: Domain[]) => {
        const currentUser = useApplicationStore.getState().currentUser;
        const { isAdmin = false, domains = [] } = currentUser ?? {};
        const userDomainsObj = isAdmin ? [] : domains;
        const userDomainFqn =
          userDomainsObj.map((item) => item.fullyQualifiedName) ?? [];

        let filteredDomains: Domain[] = data;
        if (domains.length > 0 && !isAdmin) {
          filteredDomains = data.filter((domain) =>
            userDomainFqn.includes(domain.fullyQualifiedName)
          );
        }

        set({
          domains: filteredDomains,
          domainOptions: getDomainOptions(
            isAdmin ? filteredDomains : userDomainsObj
          ),
        });
      },
      updateActiveDomain: (domain?: EntityReference) => {
        set({
          activeDomain: domain?.fullyQualifiedName ?? DEFAULT_DOMAIN_VALUE,
          activeDomainEntityRef: domain,
        });
      },
      updateDomainLoading: (loading: boolean) => {
        set({ domainLoading: loading });
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
        return {
          activeDomain: state.activeDomain,
          activeDomainEntityRef: state.activeDomainEntityRef,
        };
      },
    }
  )
);
