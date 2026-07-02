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

import classNames from 'classnames';
import { CSSProperties, FC } from 'react';
import { ReactComponent as RunFailedIcon } from '../../../assets/svg/agents/run-failed.svg';
import { ReactComponent as RunPartialIcon } from '../../../assets/svg/agents/run-partial.svg';
import { ReactComponent as RunRunningIcon } from '../../../assets/svg/agents/run-running.svg';
import { ReactComponent as RunSkippedIcon } from '../../../assets/svg/agents/run-skipped.svg';
import { ReactComponent as RunSuccessIcon } from '../../../assets/svg/agents/run-success.svg';
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
    Icon: RunSuccessIcon,
    colorClass: 'tw:text-utility-success-500',
  },
  partial: {
    Icon: RunPartialIcon,
    colorClass: 'tw:text-utility-warning-500',
  },
  failed: {
    Icon: RunFailedIcon,
    colorClass: 'tw:text-utility-error-600',
  },
  running: {
    Icon: RunRunningIcon,
    colorClass: 'tw:text-utility-brand-600',
  },
  skipped: {
    Icon: RunSkippedIcon,
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
