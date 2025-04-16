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

import {
  GRAPH_BACKGROUND_COLOR,
  TEXT_BODY_COLOR,
} from '../../constants/constants';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getOidcToken } from '../../utils/LocalStorageUtils';
import RapiDocReact from './RapiDocReact';
import './swagger.less';

const SwaggerPage = () => {
  const { theme } = useApplicationStore();
  const idToken = getOidcToken();

  return (
    <div
      className="container-fluid"
      data-testid="fluid-container"
      id="doc-container">
      <RapiDocReact
        allow-spec-file-download
        api-key-location="header"
        api-key-name="Authorization"
        api-key-value={`Bearer ${idToken}`}
        font-size="large"
        nav-bg-color={GRAPH_BACKGROUND_COLOR}
        nav-item-spacing="compact"
        nav-text-color={TEXT_BODY_COLOR}
        primary-color={theme.primaryColor}
        regular-font="Open Sans"
        render-style="focused"
        show-header={false}
        show-method-in-nav-bar="as-colored-block"
        spec-url="./swagger.json"
        text-color={TEXT_BODY_COLOR}
        theme="light"
      />
    </div>
  );
};

export default SwaggerPage;
