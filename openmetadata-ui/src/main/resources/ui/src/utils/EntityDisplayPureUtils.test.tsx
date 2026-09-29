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

describe('getCountBadge active class branch', () => {
  it('renders the active classes when isActive is true', () => {
    const className = getBadgeClassName(getCountBadge(1, '', true));

    expect(className).toContain('bg-primary text-white no-border');
    expect(className).not.toContain('ant-tag');
  });

  it('renders the ant-tag class when isActive is false', () => {
    const className = getBadgeClassName(getCountBadge(1, '', false));

    expect(className).toContain('ant-tag');
    expect(className).not.toContain('bg-primary');
  });

  it('renders neither active nor ant-tag class when isActive is undefined', () => {
    const className = getBadgeClassName(getCountBadge(1));

    expect(className).not.toContain('ant-tag');
    expect(className).not.toContain('bg-primary');
    expect(className).toContain('global-border');
  });
});
