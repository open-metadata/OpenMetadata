/*
 *  Copyright 2024 Collate.
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

import classNames from 'classnames';
import React, { ComponentType, SVGProps } from 'react';

export interface NavItemProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  badge?: string;
  active?: boolean;
  dataTestId?: string;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({
  icon: Icon,
  label,
  badge,
  active = false,
  dataTestId,
  onClick,
}) => {
  return (
    <button
      className={classNames(
        'tw:flex tw:items-center tw:gap-2 tw:w-full tw:h-9 tw:p-1',
        'tw:bg-transparent tw:border-0 tw:rounded tw:text-left',
        'tw:cursor-pointer tw:transition-colors tw:duration-150 tw:ease-linear',
        'tw:hover:bg-[rgba(0,0,0,0.04)]',
        {
          'tw:bg-blue-50': active,
        }
      )}
      data-testid={dataTestId}
      type="button"
      onClick={onClick}>
      <span className="tw:inline-flex tw:items-center tw:justify-center tw:size-5 tw:text-quaternary tw:shrink-0">
        <Icon height={20} width={20} />
      </span>
      <span
        className={classNames(
          'tw:flex-1 tw:text-sm tw:leading-5 tw:text-primary tw:truncate',
          { 'tw:font-medium': active, 'tw:font-normal': !active }
        )}>
        {label}
      </span>
      {badge ? (
        <span className="tw:text-[10px] tw:leading-[14px] tw:font-semibold tw:uppercase tw:px-1.5 tw:py-px tw:rounded tw:bg-blue-50 tw:text-blue-600 tw:shrink-0">
          {badge}
        </span>
      ) : null}
    </button>
  );
};

export default NavItem;
