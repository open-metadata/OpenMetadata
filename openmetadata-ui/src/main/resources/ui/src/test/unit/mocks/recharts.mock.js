/*
 *  Copyright 2022 Collate.
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

import React from 'react';
window.React = React;

jest.mock('recharts', () => ({
  Bar: jest.fn().mockImplementation(() => <div>Bar</div>),
  Line: jest.fn().mockImplementation(() => <div>Line</div>),
  Brush: jest.fn().mockImplementation(() => <div>Brush</div>),
  Area: jest.fn().mockImplementation(() => <div>Area</div>),
  Scatter: jest.fn().mockImplementation(() => <div>Scatter</div>),
  CartesianGrid: jest.fn().mockImplementation(() => <div>CartesianGrid</div>),
  Legend: jest.fn().mockImplementation(() => <div>Legend</div>),
  Tooltip: jest.fn().mockImplementation(() => <div>Tooltip</div>),
  XAxis: jest.fn().mockImplementation(() => <div>XAxis</div>),
  YAxis: jest.fn().mockImplementation(() => <div>YAxis</div>),
  BarChart: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  AreaChart: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  LineChart: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  ComposedChart: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  linearGradient: jest
    .fn()
    .mockImplementation(({ children, ...rest }) => (
      <div {...rest}>{children}</div>
    )),
  ResponsiveContainer: jest.fn().mockImplementation(({ children, ...rest }) => (
    <div data-testid="responsive-container" {...rest}>
      {children}
    </div>
  )),
}));
