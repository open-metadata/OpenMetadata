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

export const DeployIngestion: FC<Props> = ({
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
      d="m9.997 10.253 7.564-7.564m-7.472 7.8 1.893 4.868c.167.429.25.643.37.706a.36.36 0 0 0 .333 0c.12-.063.204-.277.371-.705l4.748-12.165c.15-.387.226-.58.185-.704a.36.36 0 0 0-.228-.228c-.123-.041-.317.034-.704.185L4.892 7.194c-.428.167-.643.25-.705.37a.36.36 0 0 0 0 .333c.063.12.277.204.706.37l4.868 1.894c.087.034.13.05.167.077q.05.034.084.084c.027.036.043.08.077.167m-2.653 1.827-5.437 5.437m7.136-2.671-2.039 2.039m-2.282-6.359L2.776 12.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DeployIngestion.displayName = 'DeployIngestion';
