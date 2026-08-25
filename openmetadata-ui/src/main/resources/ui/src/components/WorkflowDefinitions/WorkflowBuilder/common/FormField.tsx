/*
 *  Copyright 2025 Collate.
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

import React from 'react';
import { InfoLabel } from './InfoLabel';

interface FormFieldProps {
  label: string;
  description?: string;
  required?: boolean;
  showInfoIcon?: boolean;
  children: React.ReactNode;
  className?: string;
  onInfoClick?: () => void;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  description,
  required = false,
  showInfoIcon = false,
  children,
  className,
  onInfoClick,
}) => {
  const displayLabel = required ? `${label} *` : label;

  return (
    <div
      className={`tw:mb-6 ${className ?? ''}`}
      data-testid={`form-field-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <InfoLabel
        className="tw:mb-1.5"
        description={description}
        showIcon={showInfoIcon}
        text={displayLabel}
        onInfoClick={onInfoClick}
      />
      <div
        className="tw:w-full"
        data-testid={`form-control-${label
          .toLowerCase()
          .replace(/\s+/g, '-')}`}>
        {children}
      </div>
    </div>
  );
};
