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

import React from 'react';
import { Link } from 'react-router-dom';
import { DropDownListItem, DropDownListProp } from './types';

const AnchorDropDownList = ({ dropDownList, setIsOpen }: DropDownListProp) => {
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
              tw-right-0 tw-mt-2 tw-w-32 tw-rounded-md tw-shadow-lg 
              tw-bg-white tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none"
        role="menu">
        <div className="py-1" role="none">
          {dropDownList.map((item: DropDownListItem, index: number) => (
            <Link
              aria-disabled={item.disabled}
              className="link-text tw-block tw-px-4 tw-py-2 hover:tw-bg-gray-200"
              id={`menu-item-${index}`}
              key={index}
              role="menuitem"
              to={item.to as string}
              onClick={() => {
                item.method && item.method();
                setIsOpen && setIsOpen(false);
              }}>
              {item.name}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
};

export default AnchorDropDownList;
