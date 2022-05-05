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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { startCase } from 'lodash';
import React, { ChangeEvent, FC, useEffect, useRef, useState } from 'react';
import { Filter } from './AdvanceSearch.interface';

interface InputtextProp {
  filter: Filter;
  index: number;
  onFilterRemoveHandle: (index: number) => void;
  onFilterValueUpdate: (filter: Filter) => void;
}

const InputText: FC<InputtextProp> = ({
  filter,
  onFilterRemoveHandle,
  index,
  onFilterValueUpdate,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showInput, setShowInput] = useState<boolean>(true);
  const [inputValue, setInputValue] = useState('');

  const onFocus = () => {
    setShowInput(true);
  };

  const onBlur = () => {
    setShowInput(false);
  };

  const onChangeHandle = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    setInputValue(value);

    onFilterValueUpdate({ ...filter, value });
  };

  const handleFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const onValueClick = () => {
    setShowInput(true);
  };

  useEffect(() => {
    setInputValue(filter.value);
  }, [filter]);

  useEffect(() => {
    if (showInput) {
      handleFocus();
    }
  }, [showInput]);

  useEffect(() => {
    handleFocus();
  }, []);

  return (
    <div
      className={classNames(
        'tw-border tw-border-primary tw-rounded-2xl tw-inline-block tw-items-center tw-px-1.5 tw-py-0.5 tw-mr-1'
      )}
      style={{ background: '#F1EDFD' }}>
      <div className="tw-flex tw-items-center tw-justify-between">
        <div className="tw-min-w-max" data-testid="filter-key">
          {startCase(filter.key)}:
        </div>
        {showInput ? (
          <input
            autoComplete="off"
            className={classNames(
              'tw-border-none focus:tw-outline-none tw-ml-1 tw-w-search-filter tw-flex-grow tw-px-1',
              { 'tw-min-w-max': inputValue.length > 8 }
            )}
            data-testid="filter-input"
            name="database"
            ref={inputRef}
            style={{ background: 'none' }}
            type="text"
            value={inputValue}
            onBlur={onBlur}
            onChange={onChangeHandle}
            onFocus={onFocus}
          />
        ) : (
          <div
            className={classNames(
              'tw-px-2 tw-cursor-text tw-inline-block tw-min-w-max',
              {
                'tw-w-2 tw-h-2': !inputValue,
              }
            )}
            onClick={() => {
              onValueClick();
            }}>
            {inputValue}
          </div>
        )}
        <div
          className="tw-cursor-pointer tw-self-center"
          data-testid="filter-remove-button"
          onMouseDown={() => {
            onFilterRemoveHandle(index);
          }}>
          <FontAwesomeIcon
            className="tw-text-primary tw-text-lg tw-align-middle tw--mt-0.5"
            icon={{ iconName: 'times-circle', prefix: 'far' }}
          />
        </div>
      </div>
    </div>
  );
};

export default InputText;
