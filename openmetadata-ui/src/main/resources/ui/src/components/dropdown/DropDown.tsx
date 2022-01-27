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
import React, { useState } from 'react';
import { activeLink, normalLink } from '../../utils/styleconstant';
import { dropdownIcon as DropdownIcon } from '../../utils/svgconstant';
import AnchorDropDownList from './AnchorDropDownList';
import CheckBoxDropDownList from './CheckBoxDropDownList';
import { DropDownListItem, DropDownProp, DropDownType } from './types';

const DropDown: React.FC<DropDownProp> = ({
  className = '',
  label,
  type,
  icon: Icon,
  dropDownList,
  onSelect,
  selectedItems,
  isDropDownIconVisible = true,
  isLableVisible = true,
}: DropDownProp) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const renderList = (type: string) => {
    switch (type) {
      case DropDownType.LINK:
        return (
          <AnchorDropDownList
            dropDownList={dropDownList}
            setIsOpen={setIsOpen}
          />
        );
      case DropDownType.CHECKBOX:
        return (
          <CheckBoxDropDownList
            dropDownList={dropDownList}
            selectedItems={selectedItems}
            setIsOpen={setIsOpen}
            onSelect={onSelect}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div
        className={`tw-relative tw-inline-block tw-text-left ${
          type === DropDownType.CHECKBOX && 'tw-w-full'
        }`}
        data-testid="dropdown-item">
        <div>
          <button
            aria-expanded="true"
            aria-haspopup="true"
            className={`tw-inline-flex tw-px-2 tw-py-2 focus:tw-outline-none ${
              type === DropDownType.CHECKBOX
                ? `tw-rounded tw-text-body tw-text-gray-400 tw-border tw-border-main focus:tw-border-gray-500 tw-w-full`
                : `tw-justify-center tw-nav`
            } ${className}`}
            data-testid="menu-button"
            disabled={dropDownList.length === 0}
            id={`menu-button-${label}`}
            type="button"
            onClick={() => setIsOpen((isOpen) => !isOpen)}>
            {type === DropDownType.CHECKBOX ? (
              <>
                {!selectedItems?.length ? (
                  label
                ) : (
                  <span className="tw-flex tw-flex-wrap">
                    {dropDownList.map((item: DropDownListItem) => {
                      if (selectedItems?.includes(item.value as string)) {
                        return (
                          <p
                            className={classNames(
                              'tw-bg-gray-200 tw-rounded tw-px-1 tw-text-grey-body tw-truncate tw-align-middle',
                              {
                                'tw-w-52': (item.name as string)?.length > 32,
                              }
                            )}
                            key={item.value}
                            style={{ margin: '2px' }}
                            title={item.name as string}>
                            {item.name}
                          </p>
                        );
                      } else {
                        return null;
                      }
                    })}
                  </span>
                )}
              </>
            ) : (
              <>
                {Icon && Icon}
                {label && isLableVisible && (
                  <p
                    className="hover:tw-underline"
                    style={{ color: `${isOpen ? activeLink : normalLink}` }}>
                    {label}
                  </p>
                )}

                {isDropDownIconVisible ? (
                  <DropdownIcon
                    style={{ marginTop: '1px', color: normalLink }}
                  />
                ) : null}
              </>
            )}
          </button>
        </div>

        {isOpen && renderList(type)}
      </div>
    </>
  );
};

export default DropDown;
