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
const base = require('./jest.config.js');
const CORE =
  '/private/tmp/claude-501/-Users-deuex-Desktop-omd-collate-openmetadata-collate/7b8e65b2-7c8b-405b-845e-be3afdfad22b/scratchpad/sweep-fv/openmetadata-ui-core-components/src/main/resources/ui';
module.exports = {
  ...base,
  moduleNameMapper: {
    '^@openmetadata/ui-core-components$': `${CORE}/dist/index.cjs.js`,
    '^@openmetadata/ui-core-components/(.*)$': `${CORE}/dist/$1`,
    ...base.moduleNameMapper,
  },
};
