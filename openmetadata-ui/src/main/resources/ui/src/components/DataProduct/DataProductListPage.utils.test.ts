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
import { DefaultViewMode } from '../../generated/api/configuration/appConfiguration';
import { ViewMode } from '../common/ViewToggle/ViewToggle';
import { resolveDefaultDataProductView } from './DataProductListPage.utils';

describe('resolveDefaultDataProductView', () => {
  it('maps DefaultViewMode.Grid to ViewMode.Card', () => {
    expect(resolveDefaultDataProductView(DefaultViewMode.Grid)).toEqual(
      ViewMode.Card
    );
  });

  it('maps DefaultViewMode.List and undefined to ViewMode.Table', () => {
    expect(resolveDefaultDataProductView(DefaultViewMode.List)).toEqual(
      ViewMode.Table
    );
    expect(resolveDefaultDataProductView(undefined)).toEqual(ViewMode.Table);
  });
});
