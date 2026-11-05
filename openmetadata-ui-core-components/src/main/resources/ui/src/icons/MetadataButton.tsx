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

export const MetadataButton: FC<Props> = ({
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
      d="M5.375 9.694 3.05 9.39c-.476-.062-.795-.523-.583-.953.674-1.37 2.429-2.954 5.725-2.692m-2.817 3.95c.845-1.412 1.883-2.892 2.817-3.95m-2.817 3.95 4.531 4.53m-1.714-8.48c2.937-3.273 5.948-3.963 7.883-3.692a1.725 1.725 0 0 1 1.472 1.472c.271 1.935-.419 4.947-3.691 7.883m-3.95 2.817.304 2.326c.062.476.523.794.954.582 1.37-.673 2.953-2.429 2.692-5.725m-3.95 2.817c1.41-.845 2.89-1.882 3.95-2.817"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.401 6.8a1.6 1.6 0 1 0-3.2 0 1.6 1.6 0 0 0 3.2 0M3.6 18l3.2-3.2M3.6 14l1.2-1.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MetadataButton.displayName = 'MetadataButton';
