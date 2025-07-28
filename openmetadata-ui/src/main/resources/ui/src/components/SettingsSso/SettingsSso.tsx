/*
 *  Copyright 2025 Collate.
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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import '../../styles/variables.less';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import ssoUtilClassBase from '../../utils/SSOUtilClassBase';
import TitleBreadcrumb from '../common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../PageLayoutV1/PageLayoutV1';
import './SettingsSso.less';
import SSOConfigurationFormRJSF from './SSOConfigurationFormRJSF';

const SettingsSso = () => {
  const { t } = useTranslation();

  const breadcrumb = useMemo(
    () => getSettingPageEntityBreadCrumb(GlobalSettingsMenuCategory.SSO),
    []
  );

  const renderAccessTokenCard = () => {
    const AccessTokenCardComponent =
      ssoUtilClassBase.getAccessTokenCardComponent();
    if (!AccessTokenCardComponent) {
      return null;
    }

    return (
      <div className="m-t-md m-b-md">
        <AccessTokenCardComponent />
      </div>
    );
  };

  return (
    <PageLayoutV1 pageTitle={t('label.sso')}>
      <TitleBreadcrumb titleLinks={breadcrumb} />

      {renderAccessTokenCard()}

      <div className="m-t-lg">
        <SSOConfigurationFormRJSF />
      </div>
    </PageLayoutV1>
  );
};

export default SettingsSso;
