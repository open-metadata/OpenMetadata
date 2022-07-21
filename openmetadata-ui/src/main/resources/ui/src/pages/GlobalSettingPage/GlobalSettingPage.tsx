/*
 *  Copyright 2022 Collate
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

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import GlobalSetting from '../../components/GlobalSetting/GlobalSetting';
import { GlobalSettingOptions } from '../../constants/globalSettings.constants';

const GlobalSettingPage = () => {
  const { tab } = useParams<{ [key: string]: string }>();
  const [activeTab, setActiveTab] = useState<GlobalSettingOptions>(
    (tab as GlobalSettingOptions) ?? GlobalSettingOptions.USERS
  );

  useEffect(() => {
    if (tab) {
      setActiveTab(tab as GlobalSettingOptions);
    }
  }, [tab]);

  return (
    <PageContainerV1 className="tw-pt-4">
      <GlobalSetting activeTab={activeTab} />
    </PageContainerV1>
  );
};

export default GlobalSettingPage;
