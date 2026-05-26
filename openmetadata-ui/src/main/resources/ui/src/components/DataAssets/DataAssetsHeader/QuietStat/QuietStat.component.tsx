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
import { Tooltip } from 'antd';
import classNames from 'classnames';
import { ReactNode } from 'react';
import './quiet-stat.less';

interface QuietStatProps {
  icon: ReactNode;
  count: ReactNode;
  label: string;
  active?: boolean;
  className?: string;
  onClick?: () => void;
  testId?: string;
}

const QuietStat = ({
  icon,
  count,
  label,
  active,
  className,
  onClick,
  testId,
}: QuietStatProps) => {
  const content = (
    <span
      className={classNames('quiet-stat', className, {
        'quiet-stat--active': active,
        'quiet-stat--clickable': Boolean(onClick),
      })}
      data-testid={testId}
      onClick={onClick}>
      <span className="quiet-stat__icon">{icon}</span>
      <span className="quiet-stat__count">{count}</span>
    </span>
  );

  return (
    <Tooltip placement="bottom" title={label}>
      {content}
    </Tooltip>
  );
};

export default QuietStat;
