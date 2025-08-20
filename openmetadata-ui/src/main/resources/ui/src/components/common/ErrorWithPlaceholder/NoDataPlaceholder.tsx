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
/*
 *  Copyright 202 Collate.
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

import { Typography } from 'antd';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import NoDataFoundPlaceHolderIcon from '../../../assets/svg/no-data-placeholder.svg?react';
import { NoDataPlaceholderProps } from './placeholder.interface';

const NoDataPlaceholder = ({
  size,
  className,
  children,
  placeholderText,
}: NoDataPlaceholderProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={classNames(className, 'flex-center flex-col w-full h-full')}
      data-testid="no-data-placeholder">
      <NoDataFoundPlaceHolderIcon
        data-testid="no-data-image"
        height={size}
        width={size}
      />

      <div className="m-t-xss text-center text-sm font-normal">
        <Typography.Text className="text-sm">
          {placeholderText ?? t('message.no-data-available')}
        </Typography.Text>
        {children ? children : ''}
      </div>
    </div>
  );
};

export default NoDataPlaceholder;
