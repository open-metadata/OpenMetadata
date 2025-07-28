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
import { isUndefined, omitBy, round } from 'lodash';
import { TestCaseChartDataType } from '../../components/Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import { COLORS } from '../../constants/profiler.constant';
import { Thread } from '../../generated/entity/feed/thread';
import {
  TestCaseParameterValue,
  TestCaseResult,
} from '../../generated/tests/testCase';
import { getRandomHexColor } from '../DataInsightUtils';

export type PrepareChartDataType = {
  testCaseParameterValue: TestCaseParameterValue[];
  testCaseResults: TestCaseResult[];
  entityThread: Thread[];
};

export const prepareChartData = ({
  testCaseParameterValue,
  testCaseResults,
  entityThread,
}: PrepareChartDataType) => {
  // Bond will only be shown if params length is 2 and both values are present
  const params =
    testCaseParameterValue.length === 2 ? testCaseParameterValue : [];
  const dataPoints: TestCaseChartDataType['data'] = [];
  const yValues = params.reduce((acc, curr, i) => {
    // value is a string, so we need to parse it to an integer
    const value = parseInt(curr.value ?? '');

    // checking for NaN values to set undefined
    return { ...acc, [`y${i + 1}`]: isNaN(value) ? undefined : value };
  }, {});
  let showAILearningBanner = false;
  testCaseResults.forEach((result) => {
    const values = result.testResultValue?.reduce((acc, curr) => {
      const value = round(parseFloat(curr.value ?? ''), 2) || 0;

      return {
        ...acc,
        [curr.name ?? 'value']: value,
      };
    }, {});
    const metric = {
      passedRows: result.passedRows,
      failedRows: result.failedRows,
      passedRowsPercentage: isUndefined(result.passedRowsPercentage)
        ? undefined
        : `${round(result.passedRowsPercentage, 2)}%`,
      failedRowsPercentage: isUndefined(result.failedRowsPercentage)
        ? undefined
        : `${round(result.failedRowsPercentage, 2)}%`,
    };
    // if minBound or maxBound is not present, will fallback to calculated yValues from params
    const y1 = result?.minBound ?? yValues.y1;
    const y2 = result?.maxBound ?? yValues.y2;

    // if one of y1 or y2 is undefined, will not show the bound area
    const boundArea = isUndefined(y1) || isUndefined(y2) ? undefined : [y1, y2];

    if (isUndefined(boundArea)) {
      showAILearningBanner = true;
    }

    dataPoints.push({
      name: result.timestamp,
      status: result.testCaseStatus,
      ...values,
      ...omitBy(metric, isUndefined),
      boundArea,
      incidentId: result.incidentId,
      task: entityThread.find(
        (task) => task.task?.testCaseResolutionStatusId === result.incidentId
      ),
    });
  });

  dataPoints.reverse();

  // get params from the result
  const testCaseResultParams = testCaseResults.find(
    (result) => result.testResultValue?.length
  );

  return {
    information:
      testCaseResultParams?.testResultValue?.map((info, i) => ({
        label: info.name ?? '',
        color: COLORS[i] ?? getRandomHexColor(),
      })) ?? [],
    data: dataPoints,
    showAILearningBanner,
  };
};
