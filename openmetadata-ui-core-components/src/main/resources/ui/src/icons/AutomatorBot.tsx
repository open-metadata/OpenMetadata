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

export const AutomatorBot: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="m2.99 8.768-.8-1.308a1.3 1.3 0 0 1-.014-1.33l.536-.918a1.3 1.3 0 0 1 1.147-.644l1.496.03a.92.92 0 0 0 .564-.184 7 7 0 0 1 1.26-.733.93.93 0 0 0 .436-.391l.705-1.27a1.3 1.3 0 0 1 1.134-.668h1.092c.471 0 .905.255 1.134.667l.705 1.27c.097.176.253.31.436.392.447.2.87.446 1.26.733.164.12.361.189.564.185l1.496-.031c.471-.01.91.237 1.147.644l.536.918a1.3 1.3 0 0 1-.014 1.33l-.8 1.308a.93.93 0 0 0-.125.572c.041.436.041.884 0 1.32-.019.2.021.402.126.573l.799 1.307a1.3 1.3 0 0 1 .014 1.33l-.536.919a1.3 1.3 0 0 1-1.147.643l-1.496-.03a.93.93 0 0 0-.563.185 7 7 0 0 1-1.26.732.93.93 0 0 0-.437.392l-.705 1.27a1.3 1.3 0 0 1-1.134.668H9.454c-.471 0-.905-.256-1.134-.668l-.705-1.27a.93.93 0 0 0-.436-.392 7 7 0 0 1-1.26-.732.92.92 0 0 0-.565-.185l-1.495.03c-.471.01-.91-.237-1.147-.643l-.535-.919a1.3 1.3 0 0 1 .013-1.33l.8-1.307a.93.93 0 0 0 .125-.572 7 7 0 0 1 0-1.321.93.93 0 0 0-.126-.572"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m11.298 9.134.98-.497c.356-.181.534-.272.72-.19.187.08.234.244.328.57.43 1.487-.194 3.176-1.59 3.981a3.5 3.5 0 0 1-2.6.353m-.433-2.488-.98.497c-.356.181-.534.272-.72.19-.187-.08-.234-.244-.329-.57-.428-1.487.195-3.175 1.59-3.981a3.5 3.5 0 0 1 2.601-.353"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AutomatorBot.displayName = 'AutomatorBot';
