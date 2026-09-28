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
import { DefaultViewMode } from '../../../generated/api/configuration/appConfiguration';
import { ViewMode } from '../../common/ViewToggle/ViewToggle';
import { resolveDefaultSubDomainView } from './SubDomainsTable.utils';

describe('resolveDefaultSubDomainView', () => {
  it('maps DefaultViewMode.Grid to ViewMode.Card when Sub Domains has its own default', () => {
    expect(resolveDefaultSubDomainView(DefaultViewMode.Grid)).toEqual(
      ViewMode.Card
    );
  });

  it('maps DefaultViewMode.List to ViewMode.Table when Sub Domains has its own default', () => {
    expect(resolveDefaultSubDomainView(DefaultViewMode.List)).toEqual(
      ViewMode.Table
    );
  });

  it('falls back to Table when neither Sub Domains nor Domains has a saved default', () => {
    expect(resolveDefaultSubDomainView(undefined, undefined)).toEqual(
      ViewMode.Table
    );
  });

  it("inherits the Domains page's default when Sub Domains has none of its own", () => {
    expect(
      resolveDefaultSubDomainView(undefined, DefaultViewMode.Grid)
    ).toEqual(ViewMode.Card);
    expect(
      resolveDefaultSubDomainView(undefined, DefaultViewMode.List)
    ).toEqual(ViewMode.Table);
  });

  it("falls back to Table when it inherits Domains' Tree default, since Sub Domains has no Tree view", () => {
    expect(
      resolveDefaultSubDomainView(undefined, DefaultViewMode.Tree)
    ).toEqual(ViewMode.Table);
  });

  it("prefers Sub Domains' own default over Domains' when both are set", () => {
    expect(
      resolveDefaultSubDomainView(DefaultViewMode.List, DefaultViewMode.Grid)
    ).toEqual(ViewMode.Table);
    expect(
      resolveDefaultSubDomainView(DefaultViewMode.Grid, DefaultViewMode.List)
    ).toEqual(ViewMode.Card);
  });
});
