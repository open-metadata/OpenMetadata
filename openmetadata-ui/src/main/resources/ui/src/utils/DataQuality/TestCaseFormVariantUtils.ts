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
import { DEFAULT_APP_MODE } from '../../constants/appMode.constants';
import { useAppModeStore } from '../../hooks/useAppMode';

export type TestCaseFormVariant = 'drawer' | 'modal';

/**
 * Default presentation for the test case add/edit form. The default experience
 * renders the slide-out drawer; any alternate app mode (e.g. the AskCollate AI
 * experience) presents the same form as a centered modal. OM core stays
 * mode-agnostic — this only distinguishes the default mode from a customized
 * one and never names a specific mode. Reads the app-mode store synchronously
 * so it can seed a default prop value; the active mode is fixed for a page's
 * lifetime, so a non-reactive read is sufficient.
 */
export const getDefaultTestCaseFormVariant = (): TestCaseFormVariant =>
  useAppModeStore.getState().currentMode === DEFAULT_APP_MODE
    ? 'drawer'
    : 'modal';
