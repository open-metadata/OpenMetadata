/*
 *  Copyright 2023 Collate.
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
import { Badge } from 'antd';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { LeftSidebarItemProps } from './LeftSidebar.interface';

const LeftSidebarItem = ({
  data: { title, redirect_url, dataTestId, isBeta },
}: LeftSidebarItemProps) => {
  const { t } = useTranslation();

  return redirect_url ? (
    <NavLink
      className="left-panel-item left-panel-label no-underline"
      data-testid={dataTestId}
      to={{
        pathname: redirect_url,
      }}>
      {t(title)}

      {isBeta && (
        <Badge
          className="service-beta-tag"
          count={t('label.beta')}
          offset={[10, 0]}
          size="small"
        />
      )}
    </NavLink>
  ) : (
    <span
      className="left-panel-item left-panel-label p-0"
      data-testid={dataTestId}>
      {t(title)}
    </span>
  );
};

export default LeftSidebarItem;
