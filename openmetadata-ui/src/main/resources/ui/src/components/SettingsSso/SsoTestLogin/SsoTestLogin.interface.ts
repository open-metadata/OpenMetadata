/*
 *  Copyright 2025 Collate.
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
import { StageStatus } from '../../../generated/system/testLoginResult';
import {
  SecurityConfiguration,
  TestLoginResult,
} from '../../../rest/securityConfigAPI';

/** What the checks a save runs said about a configuration, before Test Login signs in with it. */
export interface ConfigurationCheckOutcome {
  passed: boolean;
  /** Shown in the modal; problems tied to a field are also highlighted in the form. */
  problems: string[];
}

export type ConfigurationCheck = (
  securityConfiguration: SecurityConfiguration
) => Promise<ConfigurationCheckOutcome>;

export interface ConfigurationCheckState {
  status: StageStatus.Running | StageStatus.Passed | StageStatus.Failed;
  problems: string[];
}

export interface UseSsoTestLoginResult {
  isTesting: boolean;
  /** LDAP/Basic: the test has started and is waiting for the admin's credentials. */
  isAwaitingCredentials: boolean;
  configurationCheck?: ConfigurationCheckState;
  result?: TestLoginResult;
  error?: string;
  /** Signs in with the configuration, once `checkConfiguration` (when given) has passed it. */
  runTestLogin: (
    securityConfiguration: SecurityConfiguration,
    checkConfiguration?: ConfigurationCheck
  ) => Promise<void>;
  submitCredentials: (email: string, password: string) => Promise<void>;
  reset: () => void;
}

export interface SsoTestLoginModalProps {
  open: boolean;
  isTesting: boolean;
  isAwaitingCredentials: boolean;
  configurationCheck?: ConfigurationCheckState;
  result?: TestLoginResult;
  error?: string;
  onSubmitCredentials: (email: string, password: string) => Promise<void>;
  onClose: () => void;
}

export interface SsoTestLoginCredentialsFormProps {
  isSubmitting: boolean;
  onSubmit: (email: string, password: string) => Promise<void>;
}

export interface SsoTestLoginCredentialsFormValues {
  email: string;
  password: string;
}
