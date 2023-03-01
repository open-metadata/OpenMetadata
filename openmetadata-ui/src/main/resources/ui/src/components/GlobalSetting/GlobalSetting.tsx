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

import React from 'react';
import { useTranslation } from 'react-i18next';

import PageLayoutV1 from '../containers/PageLayoutV1';
import GlobalSettingRouter from '../router/GlobalSettingRouter';
import './GlobalSetting.less';
import GlobalSettingLeftPanel from './GlobalSettingLeftPanel';

const GlobalSetting = () => {
  const { t } = useTranslation();

  return (
    <PageLayoutV1
      className="tw-h-full tw-px-6"
      leftPanel={<GlobalSettingLeftPanel />}
      pageTitle={t('label.setting-plural')}>
      <GlobalSettingRouter />
    </PageLayoutV1>
  );
};

export default GlobalSetting;
