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
import { Skeleton } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
import { ReactComponent as AddItemIcon } from '../../../assets/svg/add-item-icon.svg';

const SummaryCardV1 = ({
  extra,
  icon,
  isLoading,
  title,
  value,
}: {
  extra?: ReactNode;
  icon?: SvgComponent;
  isLoading: boolean;
  title: ReactNode;
  value: string | number;
}) => {
  if (isLoading) {
    return <Skeleton height={100} variant="rounded" width={210} />;
  }

  const Icon = icon ?? AddItemIcon;

  return (
    <div>
      <div className="tw:flex tw:w-full tw:min-w-52 tw:items-center tw:gap-4 tw:rounded-lg tw:border tw:border-secondary tw:px-5 tw:py-4 tw:shadow-xs">
        <Icon height={40} width={40} />
        <div>
          <p className="tw:m-0 tw:text-lg tw:font-semibold tw:text-primary">
            {value}
          </p>
          <p className="tw:m-0 tw:text-sm tw:font-medium tw:text-secondary">
            {title}
          </p>
        </div>
      </div>
      {extra && (
        <div className="tw:mx-4 tw:rounded-b-lg tw:bg-secondary tw:px-2 tw:py-2">
          <p className="tw:m-0 tw:text-[10px] tw:font-medium tw:text-primary">
            {extra}
          </p>
        </div>
      )}
    </div>
  );
};

export default SummaryCardV1;
