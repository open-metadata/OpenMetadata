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

export const MlModel: FC<Props> = ({
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
      d="M12 10c0 .553-.223 1.053-.585 1.415m.586-1.414a2 2 0 0 0-2-2m2 2h1.2m-1.786 1.414a2 2 0 0 1-1.414.586m1.414-.586.849.849M10 12a2 2 0 0 1-1.414-.586M10 12v1.2M10 8a2 2 0 0 0-2 2m2-2V6.8m-1.414 4.614A2 2 0 0 1 8 10.001m.586 1.414-.849.849M8.001 10H6.8m4.614-1.414.849-.849m-3.677.849-.849-.849"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M3.6 13.6a2.4 2.4 0 0 0 1.845 2.335c.3.072.547.32.632.618A2 2 0 0 0 10 16a2 2 0 0 0 3.922.553.89.89 0 0 1 .633-.618 2.4 2.4 0 0 0 1.793-2.832c-.08-.382.12-.83.457-1.027a2.4 2.4 0 0 0 0-4.152 1.01 1.01 0 0 1-.457-1.027q.051-.241.052-.497a2.4 2.4 0 0 0-1.845-2.335.89.89 0 0 1-.633-.618A2 2 0 0 0 10 4a2 2 0 0 0-3.923-.553.89.89 0 0 1-.632.618A2.4 2.4 0 0 0 3.65 6.897c.08.382-.118.83-.456 1.027a2.4 2.4 0 0 0 0 4.152c.338.196.537.645.457 1.027q-.051.241-.052.497"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MlModel.displayName = 'MlModel';
