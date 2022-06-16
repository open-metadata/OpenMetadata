/**
 * Copyright 2017 Hortonworks.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *   http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
/* eslint-disable */

import * as d3 from 'd3';
import moment from 'moment';
import React, { Component } from 'react';
import './d3-timeline';
// import ViewModeREST from '../rest/ViewModeREST';
import Utils from './Utils';

export default class D3ExecutionStrip extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mount: false,
    };
  }

  componentDidMount() {
    this.setState({ mount: true });
  }

  renderTimeline = () => {
    const { executionInfo, statusObj, startDate } = this.props;
    let start_time = new Date(statusObj?.extra.startExecutionDate).getTime();
    let end_time = new Date(statusObj?.extra.latestExecutionDate).getTime();
    let time_interval = statusObj?.extra.executionInterval || '1';
    let time_unit = statusObj?.extra.executionIntervalUnit || 'Minute';
    let currentOffset = new Date().getTimezoneOffset();

    if (executionInfo.executions) {
      this.totalExecutions = executionInfo.totalResults;
      let data = Utils.sortArray(
        executionInfo.executions,
        'executionDate',
        true
      );
      let timeObj = Utils.findBeginingEndingTime(
        startDate,
        start_time,
        end_time,
        data[data.length - 1],
        time_unit,
        time_interval,
        currentOffset
      );

      // check to update the timeline only if either of the dates have changed
      if (
        this.begining !== timeObj.begining ||
        this.ending !== timeObj.ending ||
        this.prevData !== data
      ) {
        let timelineData = [];

        timelineData = this.syncTimelineData(data, timelineData);
        // After inital 5 API calls, for fetching rest data, count is declared as 4
        this.executionPageCount = 4;
        this.drawTimeline(
          timeObj.begining,
          timeObj.ending,
          time_interval,
          timeObj.timeUnit,
          timelineData,
          data
        );
        this.begining = timeObj.begining;
        this.ending = timeObj.ending;
        this.prevData = data;
      }
    } else {
      let timeObj = Utils.findBeginingEndingTime(
        startDate,
        start_time,
        end_time,
        null,
        time_unit,
        time_interval,
        currentOffset
      );

      this.drawTimeline(
        timeObj.begining,
        timeObj.ending,
        time_interval,
        timeObj.timeUnit,
        [],
        []
      );
    }
  };
  syncTimelineData = (data, timelineData) => {
    data.map((executionObj, index) => {
      let dateMomentObj = moment(executionObj.executionDate);
      let starting_time = dateMomentObj.valueOf();

      // storing 5th execution object's date to compare it later for making API calls
      if (index === 5) {
        this.executionTime = starting_time;
      }
      let obj = {
        starting_time: starting_time,
        ending_time: starting_time + 1250000,
      };
      let existingObj = timelineData.find((d) => {
        return d.label === executionObj.status;
      });

      if (existingObj) {
        if (existingObj.times) {
          existingObj.times.push(obj);
        } else {
          existingObj.times = [obj];
        }
      } else {
        timelineData.push({
          label: executionObj.status,
          times: [obj],
        });
      }
    });

    return timelineData;
  };
  drawTimeline = (begining, ending, interval, unit, timelineData, data) => {
    const { onSelectExecution } = this.props;
    let chart = d3
      .timeline()
      .labelFormat(function label() {
        return '';
      })
      .margin({ left: 70, right: 30, top: 30, bottom: 30 })
      .beginning(begining)
      .ending(ending)
      .timeInterval(interval)
      .timeUnit(unit)
      .click((d) => {
        let o = data.find((executionObj) => {
          return (
            moment(executionObj.executionDate).valueOf() == d.starting_time
          );
        });

        onSelectExecution(o);
        d3.select('.tempRect.selected').classed('selected', false);
        d3.select(d3.event.currentTarget).classed('selected', true);
      })
      .rightClick((begining, ending) => {
        // call API to get older executions only when the timeline is showing last 5 executions
        if (
          begining < this.executionTime &&
          this.totalExecutions !== data.length
        ) {
          this.getOlderExecutions(
            begining,
            ending,
            interval,
            unit,
            timelineData,
            data
          );
        }
      });

    if (this.timelineChart) {
      this.timelineChart.remove();
    }
    this.timelineChart = d3
      .select('#executionTimeline')
      .append('svg')
      .attr('width', '100%')
      .attr('height', 80);
    this.timelineChart.datum(timelineData).call(chart);
  };

  getOlderExecutions = (
    begining,
    ending,
    interval,
    unit,
    timelineData,
    data
  ) => {
    const {
      topologyId,
      namespaceId,
      fromTimeInMS,
      toTimeInMS,
      executionInfoPageSize,
    } = this.props;

    // get older data
    // ViewModeREST.getAllExecutions(topologyId, {
    //   from: fromTimeInMS,
    //   to: toTimeInMS,
    //   pageSize: executionInfoPageSize,
    //   page: ++this.executionPageCount,
    //   namespaceId: namespaceId,
    // }).then((res) => {
    //   let newData = res.executions;

    //   Array.prototype.push.apply(data, newData);
    //   timelineData = this.syncTimelineData(newData, timelineData);
    //   this.drawTimeline(begining, ending, interval, unit, timelineData, data);
    // });
  };

  render() {
    return (
      <div className="clearfix" id="executionTimeline">
        {this.state.mount && this.renderTimeline()}
      </div>
    );
  }
}
