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

export const Uniqueness: FC<Props> = ({
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
      d="m8.511 8.271 1.134-2.403a.39.39 0 0 1 .711 0l1.133 2.403 2.535.388c.326.05.455.468.22.708l-1.834 1.87.433 2.64c.055.34-.285.599-.576.438L10 13.068l-2.266 1.247c-.291.16-.631-.098-.576-.437l.433-2.641-1.834-1.87c-.235-.24-.106-.658.22-.708zM17.273 10h.728M10 2.727V2m0 16v-.727m5.817-1.456-.727-.727m.727-10.906-.727.727M4.184 15.817l.727-.727M4.184 4.184l.727.727M2 10h.727"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Uniqueness.displayName = 'Uniqueness';
