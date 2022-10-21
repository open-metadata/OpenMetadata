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

import classNames from 'classnames';
import React, { useCallback } from 'react';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { LoadingStatus } from '../../utils/EntityLineageUtils';
import SVGIcons from '../../utils/SvgUtils';
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
  const getLoadingStatus = useCallback(() => {
    const editIcon = (
      <SVGIcons
        alt="icon-edit-lineag"
        className="m--t-xss"
        icon={isEditMode ? 'icon-edit-lineage' : 'icon-edit-lineage-color'}
        width="14"
      />
    );

    return LoadingStatus(editIcon, loading, status);
  }, [loading, status, isEditMode]);

  return (
    <CustomControls
      className="absolute top-1 right-3 bottom-full m-l-md m-t-md"
      fitViewParams={{ minZoom: 0.5, maxZoom: 2.5 }}>
      {!deleted && (
        <ControlButton
          className={classNames('h-9 w-9 rounded-full p-x-xss tw-shadow-lg', {
            'bg-primary': isEditMode,
            'bg-primary-hover-lite': !isEditMode,
          })}
          data-testid="edit-lineage"
          disabled={!hasEditAccess}
          title={hasEditAccess ? 'Edit Lineage' : NO_PERMISSION_FOR_ACTION}
          onClick={onClick}>
          {getLoadingStatus()}
        </ControlButton>
      )}
    </CustomControls>
  );
};

export default CustomControlElements;
