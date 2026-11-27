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

import {
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  StatusRunning,
  StatusSkipped,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { CSSProperties, FC } from 'react';
import { RunStatus } from '../AgentsPage.interface';

interface RunGlyphProps {
  status: RunStatus;
  size?: number;
}

interface GlyphMeta {
  Icon: SvgComponent;
  colorClass: string;
}

const GLYPH_META: Record<RunStatus, GlyphMeta> = {
  success: {
    Icon: CheckCircleFilled,
    colorClass: 'tw:text-utility-success-500',
  },
  partial: {
    Icon: ExclamationCircleFilled,
    colorClass: 'tw:text-utility-warning-500',
  },
  failed: {
    Icon: CloseCircleFilled,
    colorClass: 'tw:text-utility-error-600',
  },
  running: {
    Icon: StatusRunning,
    colorClass: 'tw:text-utility-brand-600',
  },
  skipped: {
    Icon: StatusSkipped,
    colorClass: 'tw:text-utility-gray-300',
  },
};

const SPIN_STYLE: CSSProperties = {
  animation: 'agspin 1.1s linear infinite',
};

const RunGlyph: FC<RunGlyphProps> = ({ status, size = 16 }) => {
  const { Icon, colorClass } = GLYPH_META[status] ?? GLYPH_META.skipped;

  return (
    <Icon
      className={classNames('tw:flex-shrink-0', colorClass)}
      height={size}
      style={status === 'running' ? SPIN_STYLE : undefined}
      width={size}
    />
  );
};

export default RunGlyph;
