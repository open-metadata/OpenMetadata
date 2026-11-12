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

export const Snowflake01: FC<Props> = ({
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
    <g clipPath="url(#a)">
      <path
        d="m18.41 14.068-2.031-1.173 1.76-1.038a.682.682 0 1 0-.693-1.176l-2.425 1.43L11.365 10l3.656-2.11 2.425 1.429a.682.682 0 1 0 .693-1.176l-1.76-1.038 2.031-1.173a.682.682 0 0 0-.682-1.182l-2.032 1.173-.018-2.044a.682.682 0 1 0-1.365.012l.025 2.816-3.656 2.11v-4.22l2.452-1.386a.683.683 0 0 0-.672-1.188l-1.78 1.005V.682a.682.682 0 1 0-1.365 0v2.346l-1.78-1.005a.683.683 0 1 0-.67 1.188l2.45 1.385v4.222L5.661 6.707l.026-2.816a.68.68 0 0 0-.677-.688h-.006a.68.68 0 0 0-.682.676l-.019 2.044L2.272 4.75a.683.683 0 0 0-.683 1.182l2.032 1.173-1.76 1.038a.683.683 0 0 0 .692 1.176L4.98 7.89 8.635 10l-3.656 2.111-2.426-1.43a.683.683 0 0 0-.693 1.176l1.76 1.038-2.03 1.173a.683.683 0 0 0 .682 1.182l2.031-1.173.019 2.044a.683.683 0 0 0 .682.676h.006a.683.683 0 0 0 .677-.688l-.026-2.816 3.656-2.111v4.221l-2.45 1.386a.683.683 0 0 0 .67 1.188l1.78-1.006v2.346a.683.683 0 0 0 1.365 0v-2.346l1.78 1.006a.683.683 0 0 0 .672-1.188l-2.452-1.386v-4.221l3.656 2.11-.025 2.816a.683.683 0 0 0 .676.69h.006a.683.683 0 0 0 .682-.677l.02-2.044 2.031 1.173a.683.683 0 1 0 .682-1.182"
        fill="currentColor"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path d="M0 0h20v20H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
Snowflake01.displayName = 'Snowflake01';
