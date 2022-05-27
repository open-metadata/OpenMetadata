/*
 *  Copyright 2021 Collate
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
import { startCase, uniqueId } from 'lodash';
import React, { FC } from 'react';
import { Type } from '../../generated/entity/type';

interface LeftPanelProp {
  typeList: Array<Type>;
  selectedType: Type;
}

export const LeftPanel: FC<LeftPanelProp> = ({ typeList, selectedType }) => {
  const getActiveClass = (typeName: string) => {
    const flag = typeName === selectedType.name;
    if (flag) {
      return 'tw-bg-primary-lite tw-text-primary tw-font-bold tw-border-l-2 tw-border-primary';
    } else {
      return 'tw-bg-body-main';
    }
  };

  return (
    <div className="tw-flex tw-flex-col tw-bg-white tw-h-screen tw-p-3 tw-border tw-border-main tw-rounded-md">
      <h6 className="tw-heading tw-text-sm">Schema &amp; Custom Fields</h6>
      {typeList.map((type) => (
        <div className="tw-mb-3" key={uniqueId()}>
          <p
            className={classNames(
              'tw-px-3 tw-py-2 tw--mx-3',
              getActiveClass(type.name)
            )}>{`${startCase(type.displayName)}s`}</p>
        </div>
      ))}
    </div>
  );
};
