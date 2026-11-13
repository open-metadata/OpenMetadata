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

// The icon-only trigger keeps the box of the labelled Button size beside it:
// Button `sm` and `md` draw 32px and 36px, ButtonUtility `lg` and `xl`
// (ADR:2026-10-14-icon-only-actions-are-tertiary-button-utility-with-one-edit-icon).
export const ICON_ONLY_SIZE = { sm: 'lg', md: 'xl' } as const;
