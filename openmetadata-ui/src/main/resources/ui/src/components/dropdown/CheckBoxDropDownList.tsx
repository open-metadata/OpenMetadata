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

import React from 'react';
import { DropDownListItem, DropDownListProp } from './types';

const CheckBoxDropDownList = ({
  dropDownList,
  setIsOpen,
  onSelect,
  selectedItems,
}: DropDownListProp) => {
  return (
    <>
      <button
        className="tw-z-10 tw-fixed tw-inset-0 tw-h-full tw-w-full tw-bg-black tw-opacity-0"
        onClick={() => setIsOpen && setIsOpen(false)}
      />
      <div
        aria-labelledby="menu-button"
        aria-orientation="vertical"
        className="tw-origin-top-right tw-absolute tw-z-10
              tw-right-0 tw-w-full tw-mt-1 tw-shadow-lg tw-border tw-border-main
              tw-bg-white tw-rounded focus:tw-outline-none"
        role="menu">
        <div className="py-1" role="none">
          {dropDownList.map((item: DropDownListItem, index: number) => (
            <div
              className="tw-cursor-pointer"
              key={index}
              onClick={(e) => onSelect && onSelect(e, item.value as string)}>
              <input
                checked={selectedItems?.includes(item.value as string)}
                className="tw-ml-3 tw-mr-2 tw-align-middle custom-checkbox"
                type="checkbox"
              />
              <p className="tw-inline-block">{item.name}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default CheckBoxDropDownList;
