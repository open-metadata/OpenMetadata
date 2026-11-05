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
import { GlobalSettingsMenuCategory } from '../../../../constants/GlobalSettings.constants';
import { getSettingPageEntityBreadCrumb } from '../../../../utils/GlobalSettingsUtils';
import TitleBreadcrumb from '../../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import AccessControlDebuggerPanel from '../../../discovery/personal-space/Profile/tabs/access-control/AccessControlDebuggerPanel';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';

const AdminPermissionDebugger = () => {
  const { t } = useTranslation();
  const breadcrumbs = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.ACCESS,
        t('label.permission-debugger')
      ),
    [t]
  );

  return (
    <PageLayoutV1 pageTitle={t('label.permission-debugger')}>
      <div className="tw:px-6">
        <TitleBreadcrumb titleLinks={breadcrumbs} />
      </div>
      <AccessControlDebuggerPanel />
    </PageLayoutV1>
  );
};

export default AdminPermissionDebugger;
