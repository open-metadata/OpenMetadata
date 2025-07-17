/*
 *  Copyright 2024 Collate.
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

import { ROUTES } from '../constants/constants';
import {
  URL_JOIN_SLACK,
  URL_OM_RELEASE_UPDATES,
  URL_OPEN_METADATA_DOCS,
} from '../constants/URL.constants';
import navbarUtilClassBase from './NavbarUtilClassBase';

describe('NavbarUtilClassBase', () => {
  it('should return all helper items with appropriate value', () => {
    const result = navbarUtilClassBase.getHelpItems();
    const stringifyResult = JSON.stringify(result);

    expect(stringifyResult).toContain(ROUTES.TOUR);
    expect(stringifyResult).toContain(URL_OPEN_METADATA_DOCS);
    expect(stringifyResult).toContain(ROUTES.SWAGGER);
    expect(stringifyResult).toContain(URL_JOIN_SLACK);
    expect(stringifyResult).toContain(URL_OM_RELEASE_UPDATES);
    expect(stringifyResult).toContain('label.tour');
    expect(stringifyResult).toContain('label.doc-plural');
    expect(stringifyResult).toContain('label.api-uppercase');
    expect(stringifyResult).toContain('label.slack-support');
    expect(stringifyResult).toContain('label.version');
  });
});
