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

export const DataContracts: FC<Props> = ({
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
      d="M14.554 5.173c-.038-1.243-.176-1.984-.69-2.497-.704-.703-1.836-.703-4.101-.703H6.559c-2.265 0-3.398 0-4.101.703-.704.703-.704 1.834-.704 4.097v6.4c0 2.262 0 3.394.704 4.097.703.703 1.836.703 4.101.703h3.204c2.265 0 3.397 0 4.101-.703.514-.513.652-1.255.69-2.497"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m14.76 8.18-4.213 4.213-.793 2.38 2.38-.793 4.213-4.213.942-.942c.216-.216.325-.324.382-.44a.8.8 0 0 0 0-.706c-.057-.116-.166-.224-.382-.44-.216-.217-.325-.325-.441-.383a.8.8 0 0 0-.705 0c-.117.058-.225.166-.44.382zm1.587 1.587L14.76 8.18M4.152 15.574h.272c.324 0 .62-.183.764-.472a.854.854 0 0 1 1.528 0c.145.29.44.472.764.472h.272M4.957 5.172h6.4m-6.4 3.203h4.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DataContracts.displayName = 'DataContracts';
