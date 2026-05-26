/*
 *  Copyright 2026 Collate.
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
import { ReactNode } from 'react';
import './metadata-chip.less';

interface MetadataChipProps {
  label: string;
  children: ReactNode;
  className?: string;
  testId?: string;
}

const MetadataChip = ({
  label,
  children,
  className,
  testId,
}: MetadataChipProps) => {
  return (
    <div
      className={classNames('metadata-chip', className)}
      data-testid={testId ?? `metadata-chip-${label.toLowerCase()}`}>
      <div className="metadata-chip__label">{label}</div>
      <div className="metadata-chip__value">{children}</div>
    </div>
  );
};

export default MetadataChip;
