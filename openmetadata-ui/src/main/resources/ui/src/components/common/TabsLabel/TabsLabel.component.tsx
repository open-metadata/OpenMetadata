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
import { isNil } from 'lodash';
import { useTranslation } from 'react-i18next';
import { getCountBadge } from '../../../utils/CommonUtils';
import './tabs-label.less';
import { TabsLabelProps } from './TabsLabel.interface';

const TabsLabel = ({
  name,
  count,
  isActive,
  id,
  description,
  isBeta,
}: TabsLabelProps) => {
  const { t } = useTranslation();

  return (
    <div className="w-full tabs-label-container" data-testid={id}>
      <div className="d-flex justify-between gap-1">
        {name}
        {!isNil(count) && (
          <span data-testid="count">{getCountBadge(count, '', isActive)}</span>
        )}
        {isBeta && (
          <Badge className="service-beta-tag" count={t('label.beta')} />
        )}
      </div>
      {/* Note: add ".custom-menu-with-description" class in Menu component if need description in menu */}
      {description && (
        <div className="label-description" data-testid="label-description">
          {description}
        </div>
      )}
    </div>
  );
};

export default TabsLabel;
