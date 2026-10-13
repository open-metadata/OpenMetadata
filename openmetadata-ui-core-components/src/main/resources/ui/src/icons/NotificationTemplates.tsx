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

export const NotificationTemplates: FC<Props> = ({
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
      d="M6.8 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M6.8 10v1.6c0 1.131 0 1.697.352 2.048.352.352.917.352 2.049.352h1.6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.598 2.4v.4c0 2.264 0 3.396.702 4.099.703.703 1.835.703 4.097.703h.4m-12.399 0c.002-2.356.034-3.573.71-4.41a3.2 3.2 0 0 1 .482-.483C6.469 2 7.767 2 10.363 2c.564 0 .846 0 1.104.091q.081.03.158.066c.248.118.447.318.846.717l3.789 3.79c.462.463.694.694.815.988.122.294.122.622.122 1.276v2.675c0 3.018 0 4.527-.937 5.465-.754.755-1.879.902-3.862.93"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
NotificationTemplates.displayName = 'NotificationTemplates';
