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
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { OidcUser } from '../components/Auth/AuthProviders/AuthProvider.interface';
import { InlineAlertProps } from '../components/common/InlineAlert/InlineAlert.interface';
import {
  EntityUnion,
  ExploreSearchIndex,
} from '../components/Explore/ExplorePage.interface';
import { LineageSettings } from '../generated/configuration/lineageSettings';
import { LoginConfiguration } from '../generated/configuration/loginConfiguration';
import { LogoConfiguration } from '../generated/configuration/logoConfiguration';
import { SearchSettings } from '../generated/configuration/searchSettings';
import { UIThemePreference } from '../generated/configuration/uiThemePreference';
import { Domain } from '../generated/entity/domains/domain';
import { EntityReference } from '../generated/entity/type';

export interface HelperFunctions {
  onLoginHandler: () => void;
  onLogoutHandler: () => void;
  handleSuccessfulLogin: (user: OidcUser) => Promise<void>;
  handleFailedLogin: () => void;
  updateAxiosInterceptors: () => void;
}

export interface AppPreferences {
  lineageConfig?: LineageSettings;
  searchConfig?: SearchSettings;
}

export interface ApplicationStore
  extends LogoConfiguration,
    LoginConfiguration {
  isApplicationLoading: boolean;
  setApplicationLoading: (loading: boolean) => void;
  cachedEntityData: Record<string, EntityUnion>;
  applicationConfig?: UIThemePreference;
  searchCriteria: ExploreSearchIndex | '';
  theme: UIThemePreference['customTheme'];
  inlineAlertDetails?: InlineAlertProps;
  applications: string[];
  appPreferences: AppPreferences;
  setInlineAlertDetails: (alertDetails?: InlineAlertProps) => void;
  setApplicationConfig: (config: UIThemePreference) => void;
  setAppPreferences: (preferences: AppPreferences) => void;
  updateCachedEntityData: (data: {
    id: string;
    entityDetails: EntityUnion;
  }) => void;
  updateSearchCriteria: (criteria: ExploreSearchIndex | '') => void;
  setApplicationsName: (applications: string[]) => void;
}

export interface DomainStore {
  domains: Domain[];
  userDomains: EntityReference[];
  domainLoading: boolean;
  activeDomain: string;
  activeDomainEntityRef?: EntityReference;
  domainOptions: ItemType[];
  updateDomains: (domainsArr: Domain[], selectDefault?: boolean) => void;
  updateActiveDomain: (domain: EntityReference) => void;
  setDomains: (domains: Domain[]) => void;
  setUserDomains: (userDomainsArr: EntityReference[]) => void;
  updateDomainLoading: (loading: boolean) => void;
}
