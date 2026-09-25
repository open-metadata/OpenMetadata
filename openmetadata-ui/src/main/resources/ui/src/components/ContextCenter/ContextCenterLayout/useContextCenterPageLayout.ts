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
import { useIsAiMode } from '../../../hooks/useAppMode';

interface ContextCenterPageLayoutClassNames {
  root: string;
  header: string;
  content: string;
}

// AI shell: core PageLayout's own padding is the padding standard (8px around
// the header, 16px around the content); the content takes the 16px gap under
// the header itself, so the header components drop their classic mb-5.
const AI_CLASS_NAMES: ContextCenterPageLayoutClassNames = {
  root: '',
  header: 'tw:*:mb-0',
  content: 'tw:pt-4',
};

// Classic keeps the original 20px gutters with no top padding.
const CLASSIC_CLASS_NAMES: ContextCenterPageLayoutClassNames = {
  root: 'tw:p-0',
  header: 'tw:px-5',
  content: 'tw:px-5 tw:pt-0 tw:pb-5',
};

export const useContextCenterPageLayout =
  (): ContextCenterPageLayoutClassNames =>
    useIsAiMode() ? AI_CLASS_NAMES : CLASSIC_CLASS_NAMES;
