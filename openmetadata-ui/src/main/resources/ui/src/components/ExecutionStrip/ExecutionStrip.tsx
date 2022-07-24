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

import {
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import _ from 'lodash';
import { ScrollHandle } from 'Models';
import moment from 'moment';
import React, {
  HTMLAttributes,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Pipeline, PipelineStatus } from '../../generated/entity/data/pipeline';

interface Props extends HTMLAttributes<HTMLDivElement> {
  executions: Pipeline['pipelineStatus'];
  selectedExecution: PipelineStatus;
  onSelectExecution: (e: PipelineStatus) => void;
}

const ExecutionStrip = ({
  executions = [],
  selectedExecution,
  onSelectExecution,
}: Props) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffSet] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [scrollHandle, setScrollHandle] = useState<ScrollHandle>({
    left: true,
    right: true,
  });

  const scrollHandler = (scrlOffset: number) => {
    if (tableRef.current) {
      tableRef.current.scrollLeft += scrlOffset;
      setScrollOffSet(tableRef.current.scrollLeft);
    }
  };

  const getExecutionTooltip = (execution: PipelineStatus) => {
    const executionDate = execution.executionDate as number;
    const momentDate = moment.unix(executionDate).format('DD MMM YYYY');
    const momentTime = moment.unix(executionDate).format('hh:mm A');

    return (
      <>
        <span>{momentDate}</span>
        <br />
        <span>{momentTime}</span>
      </>
    );
  };

  useLayoutEffect(() => {
    setContainerWidth(
      (tableRef.current?.scrollWidth ?? 0) -
        (tableRef.current?.clientWidth ?? 0)
    );
    if (tableRef.current) {
      scrollHandler(tableRef.current?.scrollWidth);
    }
  }, []);

  useEffect(() => {
    const rFlag = scrollOffset !== containerWidth;
    const lFlag = scrollOffset > 0;
    setScrollHandle((pre) => ({ ...pre, right: rFlag, left: lFlag }));
  }, [scrollOffset, containerWidth]);

  return (
    <div
      className="tw-relative execution-timeline-wrapper"
      onScrollCapture={() => {
        setScrollOffSet(tableRef.current?.scrollLeft ?? 0);
      }}>
      {scrollHandle.left ? (
        <button
          className="tw-border tw-border-main tw-fixed tw-left-7 tw-bottom-14 tw-rounded-full tw-shadow-md tw-z-50 tw-bg-body-main tw-w-8 tw-h-8"
          onClick={() => scrollHandler(-100)}>
          <FontAwesomeIcon
            className="tw-text-grey-muted"
            icon={faChevronLeft}
          />
        </button>
      ) : null}
      {scrollHandle.right ? (
        <button
          className="tw-border tw-border-main tw-fixed tw-right-7 tw-bottom-14 tw-rounded-full tw-shadow-md tw-z-50 tw-bg-body-main tw-w-8 tw-h-8"
          onClick={() => scrollHandler(100)}>
          <FontAwesomeIcon
            className="tw-text-grey-muted"
            icon={faChevronRight}
          />
        </button>
      ) : null}
      <div
        className="tw-w-full tw-overflow-x-auto tw-pt-20 tw-pb-3"
        ref={tableRef}>
        <div className="tw-flex" id="executionTimeline">
          {executions
            .map((execution, i) => {
              const isSelected = _.isEqual(execution, selectedExecution);

              return (
                <div className="data-box-wrapper tw-mr-5" key={i}>
                  <div className="tw-relative">
                    <div className="exec-date-time">
                      {getExecutionTooltip(execution)}
                    </div>
                    <div
                      className={classNames(
                        'data-box',
                        execution.executionStatus,
                        {
                          selected: isSelected,
                        }
                      )}
                      onClick={() => onSelectExecution(execution)}>
                      <FontAwesomeIcon
                        className="tw-w-3.5 tw-h-3.5"
                        color={isSelected ? '#FFFFFF' : 'transparent'}
                        icon="check"
                      />
                    </div>
                  </div>
                </div>
              );
            })
            .reverse()}
        </div>
      </div>
    </div>
  );
};

export default ExecutionStrip;
