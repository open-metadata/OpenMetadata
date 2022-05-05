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
import { isNil } from 'lodash';
import moment from 'moment';
import React, { FC, HTMLAttributes, useState } from 'react';
import Select, { SingleValue } from 'react-select';
import { JWTTokenExpiry } from '../../../generated/entity/teams/user';
import { requiredField } from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import { reactSingleSelectCustomStyle } from '../../common/react-select-component/reactSelectCustomStyle';

interface Prop extends HTMLAttributes<HTMLDivElement> {
  onConfirm: (data: Record<string, string>) => void;
  onCancel: () => void;
}

interface Option {
  value: string;
  label: string;
}

const GenerateTokenModal: FC<Prop> = ({ className, onCancel, onConfirm }) => {
  const [selectedExpiry, setSelectedExpiry] = useState('7');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  const getJWTTokenExpiryOptions = () => {
    return Object.keys(JWTTokenExpiry).map((expiry) => {
      const expiryValue = JWTTokenExpiry[expiry as keyof typeof JWTTokenExpiry];

      return { label: `${expiryValue} days`, value: expiryValue };
    });
  };

  const handleOnChange = (
    value: SingleValue<unknown>,
    { action }: { action: string }
  ) => {
    if (isNil(value) || action === 'clear') {
      setSelectedExpiry('');
    } else {
      const selectedValue = value as Option;
      setSelectedExpiry(selectedValue.value);
    }
  };

  const handleGenerate = () => {
    const data = {
      JWTToken: 'string',
      JWTTokenExpiry: selectedExpiry,
    };
    onConfirm(data);
  };

  const getExpiryDateText = () => {
    if (selectedExpiry === JWTTokenExpiry.Unlimited) {
      return <p className="tw-mt-2">The token will never expire!</p>;
    } else {
      return (
        <p className="tw-mt-2">
          The token will expire on{' '}
          {moment().add(selectedExpiry, 'days').format('ddd Do MMMM, YYYY')}
        </p>
      );
    }
  };

  return (
    <dialog
      className={classNames('tw-modal', className)}
      data-testid="generate-token-modal">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container tw-w-120">
        <div className={classNames('tw-modal-header')}>
          <p className="tw-modal-title" data-testid="modal-header">
            New JWT token
          </p>
        </div>
        <div
          className={classNames('tw-modal-body', {
            'tw-h-80': isMenuOpen,
          })}
          data-testid="body-text">
          <div data-testid="filter-dropdown">
            <label htmlFor="expiration">{requiredField('Expiration')}</label>
            <Select
              defaultValue={{ label: '7 days', value: '7' }}
              id="expiration"
              isSearchable={false}
              options={getJWTTokenExpiryOptions()}
              styles={reactSingleSelectCustomStyle}
              onChange={handleOnChange}
              onMenuClose={() => setIsMenuOpen(false)}
              onMenuOpen={() => setIsMenuOpen(true)}
            />
            {getExpiryDateText()}
          </div>
        </div>
        <div className={classNames('tw-modal-footer tw-justify-end')}>
          <Button
            className={classNames('tw-mr-2')}
            data-testid="discard-button"
            size="regular"
            theme="primary"
            variant="text"
            onClick={onCancel}>
            Cancel
          </Button>
          <Button
            data-testid="confirm-button"
            size="regular"
            theme="primary"
            type="submit"
            variant="contained"
            onClick={handleGenerate}>
            Generate
          </Button>
        </div>
      </div>
    </dialog>
  );
};

export default GenerateTokenModal;
