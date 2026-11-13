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

export const LearningResources: FC<Props> = ({
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
      d="M6.794 4.371H5.19c-1.512 0-2.268 0-2.737.47s-.47 1.225-.47 2.737v5.53c0 1.202 0 1.803.306 2.224q.151.207.356.356c.421.306 1.022.306 2.223.306h2.687c1.44 0 2.16 0 2.175-.002.296-.03.237.029.268-.268l.001-1.15v-8.44c0-.06 0-.089-.005-.117a.3.3 0 0 0-.025-.074 5 5 0 0 0-.45-.573 3.2 3.2 0 0 0-1.955-.977c-.184-.022-.38-.022-.771-.022M10 5.974v8.6c0 .757 0 1.135.002 1.15.03.297-.03.238.268.268.015.002.735.002 2.174.002h2.687c1.201 0 1.802 0 2.223-.306q.207-.15.356-.356c.306-.42.306-1.022.306-2.224V6.375c0-.372 0-.559-.031-.714a1.6 1.6 0 0 0-1.26-1.26c-.155-.03-.34-.03-.713-.03"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10 6.377s.618-3.397 4.021-4.227c.651-.159.977-.238 1.284.002.306.241.306.634.306 1.42v8.416c0 .697 0 1.045-.171 1.263s-.587.319-1.419.522C10.618 14.603 10 18 10 18"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
LearningResources.displayName = 'LearningResources';
