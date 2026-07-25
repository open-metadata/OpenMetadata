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
import { getDefaultTestCaseFormVariant } from './TestCaseFormVariantUtils';

describe('getDefaultTestCaseFormVariant', () => {
  afterEach(() => {
    useAppModeStore.setState({ currentMode: DEFAULT_APP_MODE });
  });

  it('returns "drawer" in the default app mode', () => {
    useAppModeStore.setState({ currentMode: DEFAULT_APP_MODE });

    expect(getDefaultTestCaseFormVariant()).toBe('drawer');
  });

  it('returns "modal" in a non-default (e.g. AI) app mode', () => {
    useAppModeStore.setState({ currentMode: 'ai' });

    expect(getDefaultTestCaseFormVariant()).toBe('modal');
  });
});
