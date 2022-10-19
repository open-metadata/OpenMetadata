/*
 *  Copyright 2022 Collate
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
import React from 'react';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import SVGIcons from '../../utils/SvgUtils';
import Loader from '../Loader/Loader';
import CustomControls, { ControlButton } from './CustomControls.component';
import { CustomControlElementsProps } from './EntityLineage.interface';

const CustomControlElements = ({
  deleted,
  isEditMode,
  hasEditAccess,
  onClick,
  loading,
  status,
}: CustomControlElementsProps) => {
  return (
    <CustomControls
      className="tw-absolute tw-top-1 tw-right-3 tw-bottom-full tw-ml-4 tw-mt-4"
      fitViewParams={{ minZoom: 0.5, maxZoom: 2.5 }}>
      {!deleted && (
        <ControlButton
          className={classNames(
            'tw-h-9 tw-w-9 tw-rounded-full tw-px-1 tw-shadow-lg',
            {
              'tw-bg-primary': isEditMode,
              'tw-bg-primary-hover-lite': !isEditMode,
            }
          )}
          data-testid="edit-lineage"
          disabled={!hasEditAccess}
          title={hasEditAccess ? 'Edit Lineage' : NO_PERMISSION_FOR_ACTION}
          onClick={onClick}>
          {loading ? (
            <Loader size="small" type="white" />
          ) : status === 'success' ? (
            <FontAwesomeIcon className="tw-text-white" icon="check" />
          ) : (
            <SVGIcons
              alt="icon-edit-lineag"
              className="tw--mt-1"
              icon={
                !isEditMode ? 'icon-edit-lineage-color' : 'icon-edit-lineage'
              }
              width="14"
            />
          )}
        </ControlButton>
      )}
    </CustomControls>
  );
};

export default CustomControlElements;
