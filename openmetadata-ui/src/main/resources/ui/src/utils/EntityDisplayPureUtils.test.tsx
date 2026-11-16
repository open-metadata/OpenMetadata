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
import type { ReactElement } from 'react';
import { getCountBadge } from './EntityDisplayPureUtils';

const getBadgeClassName = (badge: ReactElement): string =>
  (badge as ReactElement<{ className: string }>).props.className;

const getBadgeColor = (badge: ReactElement): string =>
  (badge as ReactElement<{ color: string }>).props.color;

describe('getCountBadge active class branch', () => {
  it('renders a brand badge when isActive is true', () => {
    expect(getBadgeColor(getCountBadge(1, '', true))).toBe('brand');
  });

  it('renders a gray badge when isActive is false', () => {
    expect(getBadgeColor(getCountBadge(1, '', false))).toBe('gray');
  });

  it('renders the plain bordered count when isActive is undefined', () => {
    const className = getBadgeClassName(getCountBadge(1));

    expect(className).toContain('global-border');
  });
});
