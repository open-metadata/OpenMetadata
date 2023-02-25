/*
 *  Copyright 2022 Collate.
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

import { Space } from 'antd';
import classNames from 'classnames';
import React, { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as IconExternalLink } from '../../assets/svg/external-link.svg';
import { useAuth } from '../../hooks/authHooks';
import SVGIcons from '../../utils/SvgUtils';
import { useAuthContext } from '../authentication/auth-provider/AuthProvider';
import './AnchorDropDownList.style.less';
import { DropDownListItem, DropDownListProp } from './types';

const AnchorDropDownList = ({ dropDownList, setIsOpen }: DropDownListProp) => {
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();

  return (
    <>
      <button
        className="tw-z-10 tw-fixed tw-inset-0 tw-h-full tw-w-full tw-bg-black tw-opacity-0"
        data-testid="hiden-layer"
        onClick={() => setIsOpen && setIsOpen(false)}
      />
      <div
        aria-labelledby="menu-button"
        aria-orientation="vertical"
        className="anchor-drop-down"
        role="menu">
        <div className="py-1" role="none">
          {dropDownList.map((item: DropDownListItem, index: number) =>
            !item.isAdminOnly || isAuthDisabled || isAdminUser ? (
              <div key={index}>
                {item.isText ? (
                  <div className="tw-px-2 tw-py-1 tw-font-normal">
                    {item.name}
                  </div>
                ) : (
                  <Link
                    aria-disabled={item.disabled}
                    className={classNames(
                      'tw-block tw-py-2 hover:tw-bg-body-hover ',
                      {
                        'link-text': !item.icon,
                      }
                    )}
                    data-testid={`menu-item-${item.name}`}
                    id={`menu-item-${index}`}
                    role="menuitem"
                    target={item.isOpenNewTab ? '_blank' : '_self'}
                    to={{ pathname: item.to }}
                    onClick={() => {
                      item.method && item.method();
                      setIsOpen && setIsOpen(false);
                    }}>
                    <Space className="p-x-xs" size={4}>
                      {item.icon && item.icon}
                      {item.icon ? (
                        <button className="tw-text-grey-body">
                          {item.isOpenNewTab ? (
                            <span className="tw-flex">
                              <span className="tw-mr-1">{item.name}</span>
                              <SVGIcons
                                alt="external-link"
                                className="tw-align-middle"
                                icon="external-link"
                                width="16px"
                              />
                            </span>
                          ) : (
                            item.name
                          )}{' '}
                        </button>
                      ) : (
                        <>
                          {item.isOpenNewTab ? (
                            <span className="tw-flex">
                              <span className="tw-mr-1">{item.name}</span>
                              <IconExternalLink
                                className="tw-align-middle"
                                height={16}
                                name="external-link"
                                width={16}
                              />
                            </span>
                          ) : (
                            item.name
                          )}
                        </>
                      )}
                    </Space>
                  </Link>
                )}
              </div>
            ) : (
              <Fragment key={index} />
            )
          )}
        </div>
      </div>
    </>
  );
};

export default AnchorDropDownList;
