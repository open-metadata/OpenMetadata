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

export const FilterFunnel01: FC<Props> = ({
  size = 20,
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
      d="M1.667 3.833c0-.467 0-.7.091-.878a.83.83 0 0 1 .364-.364C2.3 2.5 2.533 2.5 3 2.5h14c.467 0 .7 0 .878.091a.83.83 0 0 1 .364.364c.091.178.091.412.091.878v.558c0 .223 0 .336-.028.44a.9.9 0 0 1-.117.258c-.061.088-.146.162-.315.308l-5.33 4.619c-.169.147-.254.221-.314.309a.8.8 0 0 0-.118.258c-.028.104-.028.217-.028.441v4.356c0 .163 0 .245-.026.315a.4.4 0 0 1-.111.163c-.055.05-.131.08-.283.142L8.83 17.133c-.306.122-.459.183-.582.158a.42.42 0 0 1-.262-.177c-.069-.105-.069-.27-.069-.6v-5.489c0-.225 0-.337-.028-.441a.8.8 0 0 0-.117-.258c-.061-.088-.146-.162-.315-.308l-5.33-4.62c-.169-.147-.254-.221-.315-.309a.8.8 0 0 1-.117-.258c-.028-.103-.028-.216-.028-.44z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
FilterFunnel01.displayName = 'FilterFunnel01';
