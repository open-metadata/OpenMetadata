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

/* eslint-disable */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import $ from 'jquery';
import _ from 'lodash';
import moment from 'moment';
import React, { Component } from 'react';
// import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import PopOver from '../components/common/popover/PopOver';
import Utils from './Utils';

export default class ExecutionStrip extends Component {
  constructor(props) {
    super(props);
    this.state = {
      enableLeftArrow: true,
      enableRightArrow: false,
    };
  }

  componentDidMount() {
    const { executions } = this.props;
    var $elem = $('#executionTimeline');

    if (executions) {
      // scroll till the end on load
      $elem.animate(
        {
          scrollLeft: $elem.get(0).scrollWidth,
        },
        500
      );

      // scroll method to enable/disable the arrows
      $elem.scroll(() => {
        let newScrollLeft = $elem.scrollLeft(),
          width = $elem.outerWidth(),
          scrollWidth = $elem.get(0).scrollWidth;

        this.setState({
          enableRightArrow: scrollWidth - newScrollLeft !== width,
        });
        this.setState({ enableLeftArrow: newScrollLeft !== 0 });
      });
    }
  }

  scroll = ({ left }) => {
    var $elem = $('#executionTimeline');
    const leftPos = $elem.scrollLeft(),
      scrollLength = 500;

    $elem.animate(
      {
        scrollLeft: left ? leftPos - scrollLength : leftPos + scrollLength,
      },
      500
    );
  };

  getExecutionTooltip = (execution) => {
    let { executionName, executionDate } = execution;

    if (
      executionName &&
      executionName.toLowerCase() !== executionDate.toLowerCase()
    ) {
      return (
        executionName +
        ' - ' +
        moment.unix(executionDate / 1000).format('DD MMM YYYY hh:mm a')
      );
    } else {
      return moment.unix(executionDate / 1000).format('DD MMM YYYY hh:mm a');
    }
  };

  render() {
    const { executions, selectedExecution, onSelectExecution, statusObj } =
      this.props;
    const { enableRightArrow, enableLeftArrow } = this.state;

    return (
      <div className="execution-timeline-wrapper">
        <button
          className={`btn btn-xs btn-link timeline-left ${
            enableLeftArrow ? '' : 'disabled'
          }`}
          type="button"
          onClick={this.scroll.bind(this, { left: true })}>
          <i className="fa fa-chevron-left" />
        </button>
        <button
          className={`btn btn-xs btn-link timeline-right ${
            enableRightArrow ? '' : 'disabled'
          }`}
          type="button"
          onClick={this.scroll.bind(this, { left: false })}>
          <i className="fa fa-chevron-right" />
        </button>
        <div className="clearfix tw-flex" id="executionTimeline">
          {executions
            .map((execution, i) => {
              let isExecutionLatest = _.isEqual(
                new Date(execution.executionDate).getTime(),
                new Date(statusObj.extra.latestSubmission).getTime()
              );
              let className = 'data-box ';
              const status = Utils.getStatusBox({
                status: isExecutionLatest
                  ? statusObj.extra.latestSubmissionStatus
                  : execution.status,
              });

              className += status.className;
              className += _.isEqual(execution, selectedExecution)
                ? ' selected'
                : '';
              className += isExecutionLatest ? ' latest' : '';

              return (
                <div className="data-box-wrapper tw-mr-3" key={i}>
                  {/* <OverlayTrigger
                  overlay={
                    <Tooltip id={`tooltip-${i}`}>
                      <strong>{this.getExecutionTooltip(execution)}</strong>
                    </Tooltip>
                  }
                  placement="top">
                  <div
                    className={className}
                    onClick={() => onSelectExecution(execution)}>
                    <i className="fa fa-check" />
                  </div>
                </OverlayTrigger> */}
                  <PopOver
                    html={
                      <strong>{this.getExecutionTooltip(execution)}</strong>
                    }
                    position="top"
                    size="regular"
                    trigger="mouseenter">
                    <div
                      className={classNames(
                        className,
                        execution.executionStatus
                      )}
                      onClick={() => onSelectExecution(execution)}>
                      <FontAwesomeIcon
                        className="tw-w-3.5 tw-h-3.5"
                        color="#FFFFFF"
                        icon="check"
                      />
                    </div>
                  </PopOver>
                </div>
              );
            })
            .reverse()}
        </div>
      </div>
    );
  }
}
