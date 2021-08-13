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

import { AxiosResponse } from 'axios';
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSuggestions } from '../../axiosAPIs/miscAPI';
import { getDatasetDetailsPath } from '../../constants/constants';
import { serviceTypeLogo } from '../../utils/ServiceUtils';

type SuggestionProp = {
  searchText: string;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
};
type Option = {
  _source: {
    table_id: string;
    fqdn: string;
    table_name: string;
    service_type: string;
  };
};
const Suggestions = ({ searchText, isOpen, setIsOpen }: SuggestionProp) => {
  const [options, setOptions] = useState<Array<Option>>([]);
  const isMounting = useRef(true);

  useEffect(() => {
    if (!isMounting.current) {
      getSuggestions(searchText).then((res: AxiosResponse) => {
        if (res.data) {
          setOptions(res.data.suggest['table-suggest'][0].options);
          setIsOpen(true);
        }
      });
    }
  }, [searchText]);

  // alwyas Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
  }, []);

  return (
    <>
      {options.length > 0 && isOpen ? (
        <>
          <button
            className="tw-z-10 tw-fixed tw-inset-0 tw-h-full tw-w-full tw-bg-black tw-opacity-0"
            onClick={() => setIsOpen(false)}
          />
          <div
            aria-labelledby="menu-button"
            aria-orientation="vertical"
            className="tw-origin-top-right tw-absolute tw-z-10
          tw-w-60 tw-mt-1 tw-rounded-md tw-shadow-lg 
        tw-bg-white tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none"
            role="menu">
            <div className="py-1" role="none">
              {options.map((item: Option) => {
                const fqdn = item['_source'].fqdn;
                const name = item['_source'].table_name;
                const serviceType = item['_source']['service_type'];

                return (
                  <div
                    className="tw-flex tw-items-center hover:tw-bg-body-hover"
                    key={fqdn}>
                    <img
                      alt={serviceType}
                      className="tw-inline tw-h-4 tw-w-4 tw-ml-2"
                      src={serviceTypeLogo(serviceType)}
                    />
                    <Link
                      className="tw-block tw-px-4 tw-pl-2 tw-py-2 tw-text-sm"
                      data-testid="data-name"
                      to={getDatasetDetailsPath(fqdn)}
                      onClick={() => setIsOpen(false)}>
                      {name}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
};

export default Suggestions;
