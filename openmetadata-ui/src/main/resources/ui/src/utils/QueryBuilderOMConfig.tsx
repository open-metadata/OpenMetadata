/*
 *  Copyright 2024 Collate.
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
import type { BasicConfig } from '@react-awesome-query-builder/ui';
import { BasicConfig as QbBasicConfig } from '@react-awesome-query-builder/ui';
import OMBooleanWidget from './queryBuilderWidgets/OMBooleanWidget';
import OMConjs from './queryBuilderWidgets/OMConjs';
import OMDateWidget from './queryBuilderWidgets/OMDateWidget';
import OMFieldSelect from './queryBuilderWidgets/OMFieldSelect';
import OMMultiSelectWidget from './queryBuilderWidgets/OMMultiSelectWidget';
import OMNumberWidget from './queryBuilderWidgets/OMNumberWidget';
import OMSelectWidget from './queryBuilderWidgets/OMSelectWidget';
import OMTextWidget from './queryBuilderWidgets/OMTextWidget';

export const OMConfig: BasicConfig = {
  ...QbBasicConfig,
  settings: {
    ...QbBasicConfig.settings,
    renderField: (props) => <OMFieldSelect {...props} />,
    renderOperator: (props) => <OMFieldSelect {...props} />,
    renderConjs: (props) => <OMConjs {...props} />,
  },
  widgets: {
    ...QbBasicConfig.widgets,
    text: {
      ...QbBasicConfig.widgets.text,
      factory: (props) => <OMTextWidget {...props} />,
    },
    textarea: {
      ...QbBasicConfig.widgets.textarea,
      factory: (props) => <OMTextWidget {...props} />,
    },
    number: {
      ...QbBasicConfig.widgets.number,
      factory: (props) => <OMNumberWidget {...props} />,
    },
    select: {
      ...QbBasicConfig.widgets.select,
      factory: (props) => <OMSelectWidget {...props} />,
    },
    multiselect: {
      ...QbBasicConfig.widgets.multiselect,
      factory: (props) => <OMMultiSelectWidget {...props} />,
    },
    boolean: {
      ...QbBasicConfig.widgets.boolean,
      factory: (props) => <OMBooleanWidget {...props} />,
    },
    date: {
      ...QbBasicConfig.widgets.date,
      factory: (props) => <OMDateWidget {...props} />,
    },
    time: {
      ...QbBasicConfig.widgets.time,
      factory: (props) => <OMDateWidget {...props} />,
    },
    datetime: {
      ...QbBasicConfig.widgets.datetime,
      factory: (props) => <OMDateWidget {...props} />,
    },
  },
};
