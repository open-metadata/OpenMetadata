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

import { act } from 'react';
import {
  DEFAULT_DOMAIN_VALUE,
  DOMAIN_ONLY_ACCESS_ROLE,
} from '../constants/constants';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/entity/type';
import { useApplicationStore } from './useApplicationStore';
import { useDomainStore } from './useDomainStore';

const restrictedRole: EntityReference = {
  id: 'role-1',
  type: 'role',
  name: DOMAIN_ONLY_ACCESS_ROLE,
};

const singleDomain: EntityReference = {
  id: 'domain-1',
  type: 'domain',
  fullyQualifiedName: 'Engineering',
  name: 'Engineering',
};

const restrictedSingleDomainUser: User = {
  id: 'user-1',
  name: 'restricted-user',
  email: 'restricted@example.com',
  roles: [restrictedRole],
  domains: [singleDomain],
};

const adminUser: User = {
  id: 'user-2',
  name: 'admin-user',
  email: 'admin@example.com',
  isAdmin: true,
  domains: [singleDomain],
};

describe('useApplicationStore domain synchronization', () => {
  beforeEach(() => {
    act(() => {
      useDomainStore.setState({
        userDomains: [],
        activeDomain: DEFAULT_DOMAIN_VALUE,
        activeDomainEntityRef: undefined,
        isDomainRestricted: false,
      });
    });
  });

  it('populates domain store and auto-selects the single allowed domain for a restricted user', () => {
    act(() => {
      useApplicationStore.getState().setCurrentUser(restrictedSingleDomainUser);
    });

    const domainState = useDomainStore.getState();

    expect(domainState.userDomains).toEqual([singleDomain]);
    expect(domainState.isDomainRestricted).toBe(true);
    expect(domainState.activeDomain).toBe('Engineering');
    expect(domainState.activeDomainEntityRef).toEqual(singleDomain);
  });

  it('does not restrict an admin user even when they hold the role', () => {
    act(() => {
      useApplicationStore.getState().setCurrentUser(adminUser);
    });

    const domainState = useDomainStore.getState();

    expect(domainState.isDomainRestricted).toBe(false);
    expect(domainState.activeDomain).toBe(DEFAULT_DOMAIN_VALUE);
  });

  it('clears domain restriction state on logout', () => {
    act(() => {
      useApplicationStore.getState().setCurrentUser(restrictedSingleDomainUser);
    });

    act(() => {
      useApplicationStore.getState().setCurrentUser({} as User);
    });

    const domainState = useDomainStore.getState();

    expect(domainState.userDomains).toEqual([]);
    expect(domainState.isDomainRestricted).toBe(false);
  });
});
