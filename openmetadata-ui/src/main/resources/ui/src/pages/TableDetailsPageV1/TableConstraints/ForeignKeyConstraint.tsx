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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconForeignKey } from '../../../assets/svg/foreign-key.svg';
import SectionLine from '../../../assets/svg/section-line-medium.svg';
import { ConstraintType } from '../../../generated/entity/data/table';

const ForeignKeyConstraint = () => {
  const { t } = useTranslation();

  return (
    <div
      className="constraint-foreign-key"
      data-testid={`${ConstraintType.ForeignKey}-icon`}>
      <img
        className="foreign-key-section-line"
        src={SectionLine}
        width="100%"
      />
      <Tooltip
        placement="bottom"
        title={t('label.foreign-key')}
        trigger="hover">
        <Icon
          alt="foreign-key"
          className="foreign-key-icon"
          component={IconForeignKey}
        />
      </Tooltip>
    </div>
  );
};

export default ForeignKeyConstraint;
