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

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import {
  useSemanticsRuleList,
  useSemanticsRulesState,
} from '../../../components/DataAssetRules/DataAssetRules.component';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import { SemanticsRule } from '../../../generated/settings/settings';
import { getSettingPath } from '../../../utils/RouterUtils';
import './DataAssetRulesPage.less';

const DataAssetRulesPage: React.FC = () => {
  const { t } = useTranslation();
  const { semanticsRules, isLoading, isSaveLoading, updateSemanticsRules } =
    useSemanticsRulesState();

  const onSemanticsRuleChange = useCallback(
    async (updatedSemanticsRules: SemanticsRule[]) => {
      await updateSemanticsRules(updatedSemanticsRules);
    },
    []
  );

  const { addSemanticsRuleButton, semanticsRuleList } = useSemanticsRuleList({
    semanticsRules,
    onSemanticsRuleChange,
    isSaveLoading,
    isLoading,
  });
  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.setting-plural'),
        url: getSettingPath(),
      },
      {
        name: t('label.preference-plural'),
        url: getSettingPath(GlobalSettingsMenuCategory.PREFERENCES),
      },
      {
        name: t('label.entity-configuration', {
          entity: t('label.data-asset-rules'),
        }),
        url: getSettingPath(
          GlobalSettingsMenuCategory.PREFERENCES,
          GlobalSettingOptions.DATA_ASSET_RULES
        ),
      },
    ],
    []
  );

  return (
    <PageLayoutV1 pageTitle={t('label.data-asset-rules')}>
      <div data-testid="data-asset-rules-page">
        <TitleBreadcrumb titleLinks={breadcrumb} />
        <div className="m-t-md data-asset-rules-header">
          <PageHeader
            data={{
              header: t('label.data-asset-rules'),
              subHeader: t('message.data-asset-rules-message'),
            }}
          />
          <div className="m-l-auto data-asset-rules-add-button">
            {addSemanticsRuleButton}
          </div>
        </div>
        {semanticsRuleList}
      </div>
    </PageLayoutV1>
  );
};

export default DataAssetRulesPage;
