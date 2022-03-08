/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2021 Collate
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

/**
 * This scheam defines the test TableRowCountToBeBetween. Test the number of rows to between
 * to two values.
 */
export interface TableRowCountToBeBetween {
  /**
   * Expected number of rows should be lower than or equal to {maxValue}. if maxValue is not
   * included, minValue is treated as lowerBound and there will eb no maximum number of rows
   */
  maxValue?: number;
  /**
   * Expected number of rows should be greater than or equal to {minValue}. If minValue is not
   * included, maxValue is treated as upperBound and there will be no minimum number of rows
   */
  minValue?: number;
}
