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

import type { SVGProps } from 'react';

export const MdFileIcon = ({
  width = 40,
  height = 40,
  ...props
}: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    height={height}
    viewBox="0 0 40 40"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
    {...props}>
    <path
      d="M11 0.75H27C27.1212 0.75 27.2375 0.798089 27.3232 0.883789L38.1162 11.6768C38.2019 11.7625 38.25 11.8788 38.25 12V36C38.25 37.7949 36.7949 39.25 35 39.25H11C9.20507 39.25 7.75 37.7949 7.75 36V4C7.75 2.20507 9.20508 0.75 11 0.75Z"
      stroke="#D5D7DA"
      strokeWidth={1.5}
    />
    <path
      d="M27 0.5V8C27 10.2091 28.7909 12 31 12H38.5"
      stroke="#D5D7DA"
      strokeWidth={1.5}
    />
    <rect fill="#414651" height={16} rx={2} width={23} x={3} y={18} />
    <path
      d="M6.91921 22.7273H8.81552L10.8184 27.6136H10.9036L12.9064 22.7273H14.8027V30H13.3113V25.2663H13.2509L11.3688 29.9645H10.3532L8.47106 25.2486H8.41069V30H6.91921V22.7273ZM18.6477 30H16.0696V22.7273H18.669C19.4006 22.7273 20.0303 22.8729 20.5582 23.1641C21.0862 23.4529 21.4922 23.8684 21.7763 24.4105C22.0627 24.9527 22.206 25.6013 22.206 26.3565C22.206 27.1141 22.0627 27.7652 21.7763 28.3097C21.4922 28.8542 21.0838 29.272 20.5511 29.5632C20.0208 29.8544 19.3864 30 18.6477 30ZM17.6072 28.6825H18.5838C19.0384 28.6825 19.4207 28.602 19.7308 28.4411C20.0433 28.2777 20.2777 28.0256 20.4339 27.6847C20.5926 27.3414 20.6719 26.8987 20.6719 26.3565C20.6719 25.8191 20.5926 25.38 20.4339 25.0391C20.2777 24.6982 20.0445 24.4472 19.7344 24.2862C19.4242 24.1252 19.0419 24.0447 18.5874 24.0447H17.6072V28.6825Z"
      fill="white"
    />
  </svg>
);
