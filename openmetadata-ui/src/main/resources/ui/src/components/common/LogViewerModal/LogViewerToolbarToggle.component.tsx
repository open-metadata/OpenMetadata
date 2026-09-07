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
import { Tooltip, TooltipTrigger } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { LogViewerToolbarToggleProps } from './LogViewerToolbarToggle.interface';

const TOOLTIP_DELAY_MS = 500;

// The log viewer is a bespoke terminal surface with its own `lvm-*` palette, so
// its toolbar toggles cannot use the library's utility buttons (which have no
// pressed state) — this keeps the shared shape in one place instead.
const LogViewerToolbarToggle: FunctionComponent<
  LogViewerToolbarToggleProps
> = ({ icon, isActive, label, testId, onToggle }) => (
  <Tooltip delay={TOOLTIP_DELAY_MS} placement="top" title={label}>
    <TooltipTrigger
      aria-label={label}
      aria-pressed={isActive}
      className={classNames('lvm-icon-button', {
        'lvm-icon-button--active': isActive,
      })}
      data-testid={testId}
      onPress={onToggle}>
      {icon}
    </TooltipTrigger>
  </Tooltip>
);

export default LogViewerToolbarToggle;
