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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const ActivityAssetSoftDeleted: FC<Props> = ({
  size = 24,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="m15.173 4.566-.294 4.767M4.184 4.566l.443 7.345c.113 1.882.17 2.822.64 3.498.232.335.532.617.88.83.491.3 1.1.39 2.066.417M3.082 4.564H16.27m-3.623 0-.5-1.031c-.332-.686-.498-1.029-.785-1.242a1.5 1.5 0 0 0-.201-.126C10.844 2 10.463 2 9.7 2c-.78 0-1.171 0-1.494.172q-.107.057-.204.13c-.29.223-.451.578-.775 1.289l-.444.973"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={13.578}
      cy={14.664}
      r={3.336}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path d="M12.352 14.662h2.46" stroke="currentColor" strokeWidth={1.3} />
  </svg>
);
ActivityAssetSoftDeleted.displayName = 'ActivityAssetSoftDeleted';
