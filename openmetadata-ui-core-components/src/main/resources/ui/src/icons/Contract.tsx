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

export const Contract: FC<Props> = ({
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
      d="M14.8 5.2c-.038-1.243-.176-1.984-.69-2.497C13.407 2 12.274 2 10.01 2H6.805c-2.265 0-3.398 0-4.101.703C2 3.406 2 4.537 2 6.8v6.4c0 2.263 0 3.394.704 4.097C3.407 18 4.54 18 6.805 18h3.204c2.265 0 3.397 0 4.101-.703.514-.513.652-1.254.69-2.497"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m15.007 8.207-4.213 4.213L10 14.8l2.38-.793 4.213-4.213.942-.941c.216-.217.325-.325.383-.441a.8.8 0 0 0 0-.705c-.058-.117-.166-.225-.383-.441-.216-.217-.324-.325-.441-.383a.8.8 0 0 0-.705 0c-.116.058-.224.166-.44.383zm1.586 1.587-1.586-1.587M4.398 15.602h.273a.86.86 0 0 0 .764-.473.854.854 0 0 1 1.527 0c.145.29.44.473.764.473h.272M5.203 5.2h6.4m-6.4 3.202h4.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Contract.displayName = 'Contract';
