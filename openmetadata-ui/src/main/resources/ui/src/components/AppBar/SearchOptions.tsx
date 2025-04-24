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

import { Typography } from 'antd';
import { FunctionComponent, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getExplorePath } from '../../utils/RouterUtils';

type SearchOptionsProp = {
  searchText: string;
  isOpen: boolean;
  options: Array<string>;
  setIsOpen: (value: boolean) => void;
  selectOption: (text: string) => void;
};

const SearchOptions: FunctionComponent<SearchOptionsProp> = ({
  searchText,
  options = [],
  setIsOpen,
  selectOption,
}: SearchOptionsProp) => {
  const { t } = useTranslation();
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
      <div className="p-y-sm" role="none">
        <Link
          className="link-text d-flex justify-between text-sm"
          data-testid="InOpenMetadata"
          to={getExplorePath({ search: searchText })}
          onClick={() => setIsOpen(false)}>
          {searchText}
          <Typography.Text>{t('label.in-open-metadata')}</Typography.Text>
        </Link>
        {options.map((option, index) => (
          <span
            className="link-text d-flex justify-between text-sm"
            data-testid="InPage"
            key={index}
            onClick={() => {
              selectOption(searchText);
              setIsOpen(false);
            }}>
            {searchText}
            <Typography.Text>{option}</Typography.Text>
          </span>
        ))}
      </div>
    </>
  );
};

export default SearchOptions;
