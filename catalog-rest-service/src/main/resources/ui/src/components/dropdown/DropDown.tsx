/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import PropTypes from 'prop-types';
import React, { useState } from 'react';
import AppState from '../../AppState';
import { activeLink, normalLink } from '../../utils/styleconstant';
import { dropdownIcon as DropdownIcon } from '../../utils/svgconstant';
import AnchorDropDownList from './AnchorDropDownList';
import CheckBoxDropDownList from './CheckBoxDropDownList';
import { DropDownListItem, DropDownProp, DropDownType } from './types';

const DropDown: React.FC<DropDownProp> = ({
  label,
  type,
  icon: Icon,
  dropDownList,
  onSelect,
  selectedItems,
}) => {
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
            className={`tw-inline-flex tw-px-4 tw-py-2 focus:tw-outline-none ${
              type === DropDownType.CHECKBOX
                ? `tw-rounded tw-text-body tw-text-gray-400 tw-border tw-border-main focus:tw-border-gray-500 tw-w-full`
                : `tw-justify-center tw-nav`
            }`}
            id="menu-button"
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
                            className="tw-bg-gray-200 tw-rounded tw-px-1 tw-text-grey-body"
                            key={item.value}
                            style={{ margin: '2px' }}>
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
                {Icon && (
                  <div className="tw-h-6 tw-w-6 tw-pr-4">
                    {AppState.userDetails.profile?.images.image512 ? (
                      <div className="profile-image">
                        <img
                          alt="user"
                          src={AppState.userDetails.profile.images.image512}
                        />
                      </div>
                    ) : (
                      <Icon
                        style={{
                          height: '24px',
                          width: '24px',
                          borderRadius: '50%',
                        }}
                      />
                    )}
                  </div>
                )}
                {label && (
                  <p
                    className="hover:tw-underline"
                    style={{ color: `${isOpen ? activeLink : normalLink}` }}>
                    {label}
                  </p>
                )}

                <DropdownIcon style={{ marginTop: '1px', color: normalLink }} />
              </>
            )}
          </button>
        </div>

        {isOpen && renderList(type)}
      </div>
    </>
  );
};
DropDown.propTypes = {
  label: PropTypes.string,
  type: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  onSelect: PropTypes.func,
  selectedItems: PropTypes.array,
  dropDownList: PropTypes.array.isRequired,
};

export default DropDown;
