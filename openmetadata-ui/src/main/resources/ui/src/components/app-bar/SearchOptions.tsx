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

import React, { FunctionComponent, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getExplorePathWithSearch } from '../../constants/constants';
import Tags from '../tags/tags';

type SearchOptionsProp = {
  searchText: string;
  isOpen: boolean;
  options: Array<string>;
  setIsOpen: (value: boolean) => void;
  selectOption: (text: string) => void;
};

const SearchOptions: FunctionComponent<SearchOptionsProp> = ({
  searchText,
  isOpen,
  options = [],
  setIsOpen,
  selectOption,
}: SearchOptionsProp) => {
  const isMounting = useRef(true);
  useEffect(() => {
    if (!isMounting.current) {
      setIsOpen(true);
    }
  }, [searchText]);

  // alwyas Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
  }, []);

  return (
    <>
      {isOpen ? (
        <>
          <button
            className="tw-z-10 tw-fixed tw-inset-0 tw-h-full tw-w-full tw-bg-black tw-opacity-0"
            onClick={() => setIsOpen(false)}
          />
          <div
            aria-labelledby="menu-button"
            aria-orientation="vertical"
            className="tw-origin-top-right tw-absolute tw-z-10
          tw-w-full tw-mt-1 tw-rounded-md tw-shadow-lg 
        tw-bg-white tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none"
            role="menu">
            <div className="py-1" role="none">
              <Link
                className="link-text tw-flex tw-justify-between tw-px-4 tw-py-2 tw-text-sm 
                    hover:tw-bg-body-hover"
                data-testid="InOpenMetadata"
                to={getExplorePathWithSearch(searchText)}
                onClick={() => setIsOpen(false)}>
                {searchText}
                <Tags
                  className="tw-text-grey-body"
                  tag="In OpenMetadata"
                  type="outlined"
                />
              </Link>
              {options.map((option, index) => (
                <span
                  className="link-text tw-flex tw-justify-between tw-px-4 tw-py-2 tw-text-sm 
                    hover:tw-bg-body-hover"
                  data-testid="InPage"
                  key={index}
                  onClick={() => {
                    selectOption(searchText);
                    setIsOpen(false);
                  }}>
                  {searchText}
                  <Tags
                    className="tw-text-grey-body"
                    tag={option}
                    type="outlined"
                  />
                </span>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
};

export default SearchOptions;
