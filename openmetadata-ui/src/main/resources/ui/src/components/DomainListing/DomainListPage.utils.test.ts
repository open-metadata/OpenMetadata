/*
 *  Copyright 2023 Collate.
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

import { getDomainListCardStyle } from './DomainListPage.utils';

describe('getDomainListCardStyle', () => {
  it('keeps the canvas for the AI-mode tree view', () => {
    expect(getDomainListCardStyle(true, true)).toEqual({
      variant: 'ghost',
      className: 'tw:bg-canvas',
    });
  });

  it('uses a bordered surface card for the AI-mode table and card views', () => {
    expect(getDomainListCardStyle(true, false)).toEqual({ variant: 'default' });
  });

  it('uses the elevated card in Classic mode, in every view', () => {
    expect(getDomainListCardStyle(false, true)).toEqual({
      variant: 'elevated',
    });
    expect(getDomainListCardStyle(false, false)).toEqual({
      variant: 'elevated',
    });
  });
});
