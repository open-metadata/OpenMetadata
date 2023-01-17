/*
 *  Copyright 2022 Collate.
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

import { ExploreQuickFilterField } from 'components/Explore/explore.interface';
import Qs from 'qs';
import {
  advanceFieldValueSelectKey,
  oidcTokenKey,
  refreshTokenKey,
} from '../constants/constants';

/* A util that sets and gets the data in/from local storage. 
    @getter
    @setter
*/

export const advanceFieldSelect = {
  Owner: [] as ExploreQuickFilterField['value'],
  Tag: [] as ExploreQuickFilterField['value'],
};

const setOwnerValues = (ownerData: ExploreQuickFilterField['value']) =>
  (advanceFieldSelect.Owner = ownerData);

const setTagValues = (TagData: ExploreQuickFilterField['value']) =>
  (advanceFieldSelect.Tag = TagData);

const localState = {
  getRefreshToken: () => localStorage.getItem(refreshTokenKey) as string,
  getOidcToken: () => localStorage.getItem(oidcTokenKey) as string,

  getAdvanceFieldValueSelect: () =>
    Qs.parse(
      localStorage.getItem(advanceFieldValueSelectKey) as string
    ) as typeof advanceFieldSelect,

  setRefreshToken: (token: string) => {
    localStorage.setItem(refreshTokenKey, token);
  },

  setOidcToken: (_oidcTokenKey: string) => {
    localStorage.setItem(oidcTokenKey, _oidcTokenKey);
  },

  setAdvanceFieldValueSelect: (field: ExploreQuickFilterField[]) => {
    field.forEach((item) => {
      if (item.label === 'Owner') {
        setOwnerValues(item.value);
      }
      if (item.label === 'Tag') {
        setTagValues(item.value);
      }
    });

    localStorage.setItem(
      advanceFieldValueSelectKey,
      Qs.stringify(advanceFieldSelect)
    );
  },

  removeOidcToken: () => localStorage.removeItem(oidcTokenKey),

  removeAdvanceFieldValueSelect: () =>
    localStorage.removeItem(advanceFieldValueSelectKey),
};

export default localState;
