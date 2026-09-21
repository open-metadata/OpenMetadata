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

// The context and its consumer hook sit in context/ alongside PermissionProvider
// and LineageProvider, so hooks can read installed-application state without
// reaching into the Settings component tree. The Provider component itself stays
// where it renders.
import { createContext, useContext } from 'react';
import { ApplicationsContextType } from '../../components/Settings/Applications/ApplicationsProvider/ApplicationsProvider.interface';

export const ApplicationsContext = createContext({} as ApplicationsContextType);

export const useApplicationsProvider = () => useContext(ApplicationsContext);
