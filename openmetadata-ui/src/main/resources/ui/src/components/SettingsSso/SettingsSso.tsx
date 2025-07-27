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
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { TabSpecificField } from '../../enums/entity.enum';
import { Bot } from '../../generated/entity/bot';
import { User } from '../../generated/entity/teams/user';
import { Include } from '../../generated/type/include';
import {
  getBotByName,
  getUserByName,
  revokeUserToken,
} from '../../rest/userAPI';
import '../../styles/variables.less';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import ssoUtilClassBase from '../../utils/SSOUtilClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import TitleBreadcrumb from '../common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../PageLayoutV1/PageLayoutV1';
import AccessTokenCard from '../Settings/Users/AccessTokenCard/AccessTokenCard.component';
import './SettingsSso.less';
import SSOConfigurationFormRJSF from './SSOConfigurationFormRJSF';

const SettingsSso = () => {
  const { t } = useTranslation();
  const [botUserData, setBotUserData] = useState<User | null>(null);
  const [botData, setBotData] = useState<Bot | null>(null);

  const breadcrumb = useMemo(
    () => getSettingPageEntityBreadCrumb(GlobalSettingsMenuCategory.SSO),
    []
  );

  // Get AccessTokenCard component using the base SSO utility class (OSS)
  const isAccessTokenCardEnabled = ssoUtilClassBase.isAccessTokenCardEnabled();

  const fetchBotsData = async () => {
    try {
      const botResponse = await getBotByName('scim-bot', {
        include: Include.All,
      });

      const botUserResponse = await getUserByName(
        botResponse.botUser.fullyQualifiedName || '',
        {
          fields: [TabSpecificField.ROLES, TabSpecificField.PROFILE],
          include: Include.All,
        }
      );
      setBotUserData(botUserResponse);
      setBotData(botResponse);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleRevokeToken = async () => {
    try {
      await revokeUserToken(botData?.botUser.id as string);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    fetchBotsData();
  }, []);

  // Render AccessTokenCard if enabled (same as Collate)
  const renderAccessTokenCard = () => {
    if (!isAccessTokenCardEnabled) {
      return null;
    }

    return (
      <div className="m-t-md m-b-md">
        <AccessTokenCard
          isBot
          isSCIMBot
          botData={botData ?? undefined}
          botUserData={botUserData ?? undefined}
          disabled={false}
          revokeTokenHandlerBot={handleRevokeToken}
        />
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
