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

export const AssetsType: FC<Props> = ({
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
      d="M2 14a3.2 3.2 0 0 0 5.402 2.323c.37-.351.555-.526.653-.584a.7.7 0 0 1 .281-.112c.111-.026.26-.026.559-.026h2.204c.189 0 .283 0 .373.021a1 1 0 0 1 .097.03c.087.032.165.084.322.189l.033.021c.323.216.485.324.663.35a.8.8 0 0 0 .279-.007c.175-.036.33-.153.642-.387l.081-.06c.25-.188.376-.282.512-.323a.8.8 0 0 1 .46 0c.137.04.262.134.512.322.287.215.43.322.583.362a.8.8 0 0 0 .508-.036c.146-.061.273-.188.526-.44l.51-.51c.533-.534.8-.8.8-1.132s-.267-.598-.8-1.132c-.231-.23-.347-.346-.494-.407s-.31-.061-.637-.061H8.895c-.298 0-.448 0-.559-.026a.7.7 0 0 1-.28-.112c-.1-.058-.284-.233-.654-.584A3.2 3.2 0 0 0 2 14m14.4-4.8V7.6c0-2.262 0-3.393-.703-4.096S13.863 2.8 11.6 2.8H6.8c-2.263 0-3.394 0-4.097.703S2 5.338 2 7.6v1.6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M5.3 14h-.1m.2 0a.2.2 0 1 1-.4 0 .2.2 0 0 1 .4 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AssetsType.displayName = 'AssetsType';
