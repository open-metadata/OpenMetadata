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

import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import AssignErrorPlaceHolder from './AssignErrorPlaceHolder';
import CreateErrorPlaceHolder from './CreateErrorPlaceHolder';
import CustomNoDataPlaceHolder from './CustomNoDataPlaceHolder';
import FilterErrorPlaceHolder from './FilterErrorPlaceHolder';
import NoDataPlaceholder from './NoDataPlaceholder';
import PermissionErrorPlaceholder from './PermissionErrorPlaceholder';
import { ErrorPlaceholderProps } from './placeholder.interface';

const ErrorPlaceHolder = ({
  doc,
  onClick,
  type,
  children,
  heading,
  className,
  size = SIZE.LARGE,
  button,
  permission,
  buttonId,
  icon,
  placeholderText,
  permissionValue,
}: ErrorPlaceholderProps) => {
  const getErrorPlaceHolder = () => {
    switch (type) {
      case ERROR_PLACEHOLDER_TYPE.CREATE:
        return (
          <CreateErrorPlaceHolder
            buttonId={buttonId}
            className={className}
            doc={doc}
            heading={heading}
            permission={permission}
            permissionValue={permissionValue}
            placeholderText={placeholderText}
            size={size}
            onClick={onClick}
          />
        );

      case ERROR_PLACEHOLDER_TYPE.ASSIGN:
        return (
          <AssignErrorPlaceHolder
            button={button}
            className={className}
            heading={heading}
            permission={permission}
            permissionValue={permissionValue}
            size={size}>
            {children}
          </AssignErrorPlaceHolder>
        );

      case ERROR_PLACEHOLDER_TYPE.FILTER:
        return (
          <FilterErrorPlaceHolder
            className={className}
            doc={doc}
            placeholderText={placeholderText}
            size={size}
          />
        );

      case ERROR_PLACEHOLDER_TYPE.PERMISSION:
        return (
          <PermissionErrorPlaceholder
            className={className}
            permissionValue={permissionValue}
            size={size}
          />
        );

      case ERROR_PLACEHOLDER_TYPE.CUSTOM:
        return (
          <CustomNoDataPlaceHolder
            className={className}
            icon={icon}
            size={size}>
            {children}
          </CustomNoDataPlaceHolder>
        );

      default:
        return (
          <NoDataPlaceholder
            className={className}
            placeholderText={placeholderText}
            size={size}>
            {children}
          </NoDataPlaceholder>
        );
    }
  };

  return getErrorPlaceHolder();
};

export default ErrorPlaceHolder;
