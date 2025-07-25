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
import {
  AuthenticationConfigurationWithScope,
  IAuthContext,
} from '../components/Auth/AuthProviders/AuthProvider.interface';
import { InlineAlertProps } from '../components/common/InlineAlert/InlineAlert.interface';
import {
  EntityUnion,
  ExploreSearchIndex,
} from '../components/Explore/ExplorePage.interface';
import { TabSpecificField } from '../enums/entity.enum';
import { AuthenticationConfiguration } from '../generated/configuration/authenticationConfiguration';
import { AuthorizerConfiguration } from '../generated/configuration/authorizerConfiguration';
import { LineageSettings } from '../generated/configuration/lineageSettings';
import { LoginConfiguration } from '../generated/configuration/loginConfiguration';
import { LogoConfiguration } from '../generated/configuration/logoConfiguration';
import { SearchSettings } from '../generated/configuration/searchSettings';
import { UIThemePreference } from '../generated/configuration/uiThemePreference';
import { Domain } from '../generated/entity/domains/domain';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/entity/type';
import { Include } from '../generated/type/include';

export interface AppPreferences {
  lineageConfig?: LineageSettings;
  searchConfig?: SearchSettings;
}

export interface ApplicationStore
  extends IAuthContext,
    LogoConfiguration,
    LoginConfiguration {
  appVersion?: string;
  isApplicationLoading: boolean;
  setApplicationLoading: (loading: boolean) => void;
  userProfilePics: Record<string, User>;
  cachedEntityData: Record<string, EntityUnion>;
  selectedPersona?: EntityReference;
  authConfig?: AuthenticationConfigurationWithScope;
  applicationConfig?: UIThemePreference;
  searchCriteria: ExploreSearchIndex | '';
  theme: UIThemePreference['customTheme'];
  inlineAlertDetails?: InlineAlertProps;
  applications: string[];
  appPreferences: AppPreferences;
  refetchCurrentUser: (params?: {
    fields?: TabSpecificField[];
    include?: Include;
  }) => void;
  setInlineAlertDetails: (alertDetails?: InlineAlertProps) => void;
  setSelectedPersona: (persona?: EntityReference) => void;
  setApplicationConfig: (config: UIThemePreference) => void;
  setAppPreferences: (preferences: AppPreferences) => void;
  setCurrentUser: (user: User) => void;
  setAuthConfig: (authConfig: AuthenticationConfigurationWithScope) => void;
  setAuthorizerConfig: (authorizerConfig: AuthorizerConfiguration) => void;
  setJwtPrincipalClaims: (
    claims: AuthenticationConfiguration['jwtPrincipalClaims']
  ) => void;
  setJwtPrincipalClaimsMapping: (
    claimsMapping: AuthenticationConfiguration['jwtPrincipalClaimsMapping']
  ) => void;
  updateUserProfilePics: (data: { id: string; user: User }) => void;
  updateCachedEntityData: (data: {
    id: string;
    entityDetails: EntityUnion;
  }) => void;
  updateSearchCriteria: (criteria: ExploreSearchIndex | '') => void;
  setApplicationsName: (applications: string[]) => void;
  setAppVersion: (version: string) => void;
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
