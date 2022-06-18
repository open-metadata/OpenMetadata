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

import * as d3 from 'd3';
import Utils from './Utils';

(function () {
  d3.timeline = function () {
    var self = this;
    var DISPLAY_TYPES = ['circle', 'rect'];

    var hover = function () {},
      mouseover = function (d) {
        let date = new Date(d.starting_time);
        let position = d3.event.currentTarget.getBoundingClientRect();

        self.tooltip
          .html(tooltipDateFormat(date) + '<br/>' + tooltipTimeFormat(date))
          .style('left', position.x + 30 + 'px')
          .style('top', position.y - 14 + 'px');
        self.tooltip.style('display', 'block');
      },
      mouseout = function () {
        self.tooltip.style('display', 'none');
      },
      tooltipDateFormat = d3.time.format('%a,%d %b,%Y'),
      tooltipTimeFormat = d3.time.format('%H:%M:%S'),
      click = function () {},
      scroll = function () {},
      labelFunction = function (label) {
        return label;
      },
      navigateLeft = function () {},
      navigateRight = function () {},
      orient = 'top',
      width = null,
      height = null,
      rowSeparatorsColor = null,
      backgroundColor = null,
      timeInterval = 0,
      timeUnit = '',
      tickFormat = {
        format: d3.time.format('%H:00'),
        format2: d3.time.format('%d/%m %H:00'),
        tickInterval: 5,
        tickSize: 6,
        tickTime: d3.time.hours,
        tickValues: null,
      },
      colorCycle = d3.scale.category20(),
      colorPropertyName = null,
      display = 'rect',
      beginning = 0,
      labelMargin = 0,
      ending = 0,
      updatedBegining = beginning,
      updatedEnding = ending,
      margin = { bottom: 30, left: 30, right: 30, top: 30 },
      stacked = false,
      rotateTicks = false,
      timeIsRelative = false,
      fullLengthBackgrounds = false,
      itemHeight = 20,
      itemMargin = 5,
      navMargin = 60,
      showTimeAxis = true,
      showAxisTop = true,
      showTodayLine = false,
      timeAxisTick = false,
      timeAxisTickFormat = { spacing: '4 10', stroke: 'stroke-dasharray' },
      showTodayFormat = {
        color: colorCycle,
        marginBottom: 0,
        marginTop: 25,
        width: 1,
      },
      showBorderLine = false,
      showBorderFormat = {
        color: colorCycle,
        marginBottom: 0,
        marginTop: 25,
        width: 1,
      },
      showAxisHeaderBackground = false,
      showAxisNav = false,
      showAxisCalendarYear = false,
      axisBgColor = 'white',
      chartData = {},
      rightClickAPICall = function () {};

    self.stopLeftClick = true;
    self.stopRightClick = true;

    let constants = {
      clickConstant: 0,
      initialDrag: 0,
      initialScaleDrag: 0,
      moveConstant: 5000,
      offset: 0,
    };

    var wrap = function (text) {
      text.each(function () {
        var text = d3.select(this),
          value = text.text(),
          y = text.attr('y'),
          dy = parseFloat(text.attr('dy')),
          tspan = text
            .text(null)
            .append('tspan')
            .attr('x', 0)
            .attr('y', y)
            .attr('dy', dy + 'em');
        let arr = value.split(' ');

        if (arr.length > 1) {
          tspan.text(arr[1]);
          text
            .append('tspan')
            .attr('x', 0)
            .attr('y', y)
            .attr('dy', -1 + dy + 'em')
            .text(arr[0]);
        } else {
          tspan.text(arr[0]);
        }
      });
    };

    var appendTimeAxis = function (g, xAxis, yPosition) {
      if (showAxisHeaderBackground) {
        appendAxisHeaderBackground(g, 0, 0);
      }

      if (showAxisNav) {
        appendTimeAxisNav(g);
      }

      g.insert('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', '100%')
        .attr('height', 35)
        .attr('fill', '#f7f7f7');
      g.insert('rect')
        .attr('x', 0)
        .attr('y', 35)
        .attr('width', '100%')
        .attr('height', 1)
        .attr('fill', '#e5e5e5');
      g.append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(' + 0 + ',' + yPosition + ')')
        .call(xAxis)
        .selectAll('.tick text')
        .call(wrap);
    };

    var appendTimeAxisCalendarYear = function (nav) {
      var calendarLabel = beginning.getFullYear();

      if (beginning.getFullYear() != ending.getFullYear()) {
        calendarLabel = beginning.getFullYear() + '-' + ending.getFullYear();
      }

      nav
        .append('text')
        .attr('transform', 'translate(' + 20 + ', 0)')
        .attr('x', 0)
        .attr('y', 14)
        .attr('class', 'calendarYear')
        .text(calendarLabel);
    };
    var appendTimeAxisNav = function (g) {
      var timelineBlocks = 6;
      var leftNavMargin = margin.left - navMargin;
      var incrementValue = (width - margin.left) / timelineBlocks;
      var rightNavMargin = width - margin.right - incrementValue + navMargin;

      var nav = g
        .append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(0, 20)');

      if (showAxisCalendarYear) {
        appendTimeAxisCalendarYear(nav);
      }

      nav
        .append('text')
        .attr('transform', 'translate(' + leftNavMargin + ', 0)')
        .attr('x', 0)
        .attr('y', 14)
        .attr('class', 'chevron')
        .text('<')
        .on('click', function () {
          return navigateRight(ending, chartData);
        });

      nav
        .append('text')
        .attr('transform', 'translate(' + rightNavMargin + ', 0)')
        .attr('x', 0)
        .attr('y', 14)
        .attr('class', 'chevron')
        .text('>')
        .on('click', function () {
          return navigateLeft(beginning, chartData);
        });
    };

    var appendAxisHeaderBackground = function (g, xAxis, yAxis) {
      g.insert('rect')
        .attr('class', 'row-green-bar')
        .attr('x', xAxis)
        .attr('width', width)
        .attr('y', yAxis)
        .attr('height', itemHeight)
        .attr('fill', axisBgColor);
    };

    var appendTimeAxisTick = function (g, xAxis, maxStack) {
      g.append('g')
        .attr('class', 'axis')
        .attr(
          'transform',
          'translate(' +
            0 +
            ',' +
            (margin.top + (itemHeight + itemMargin) * maxStack) +
            ')'
        )
        .attr(timeAxisTickFormat.stroke, timeAxisTickFormat.spacing)
        .call(
          xAxis
            .tickFormat('')
            .tickSize(
              -(margin.top + (itemHeight + itemMargin) * (maxStack - 1) + 3),
              0,
              0
            )
        );
    };

    var appendBackgroundBar = function (yAxisMapping, index, g, data, datum) {
      var greenbarYAxis =
        (itemHeight + itemMargin) * yAxisMapping[index] + margin.top;

      g.selectAll('svg')
        .data(data)
        .enter()
        .insert('rect')
        .attr('class', 'row-green-bar')
        .attr('x', fullLengthBackgrounds ? 0 : margin.left)
        .attr(
          'width',
          fullLengthBackgrounds ? width : width - margin.right - margin.left
        )
        .attr('y', greenbarYAxis)
        .attr('height', itemHeight)
        .attr(
          'fill',
          backgroundColor instanceof Function
            ? backgroundColor(datum, index)
            : backgroundColor
        );
    };

    var appendLabel = function (gParent, yAxisMapping, index, hasLabel, datum) {
      var fullItemHeight = itemHeight + itemMargin;
      var rowsDown =
        margin.top +
        fullItemHeight / 2 +
        fullItemHeight * (yAxisMapping[index] || 1);

      gParent
        .append('text')
        .attr('class', 'timeline-label')
        .attr('transform', 'translate(' + labelMargin + ',' + rowsDown + ')')
        .text(hasLabel ? labelFunction(datum.label) : datum.id)
        .on('click', function (d) {
          click(d, index, datum);
        });
    };

    function timeline(gParent) {
      var g = gParent.append('g');
      var gParentSize = gParent[0][0].getBoundingClientRect();

      var gParentItem = d3.select(gParent[0][0]);

      var yAxisMapping = {},
        maxStack = 1,
        minTime = 0,
        maxTime = 0;

      setWidth();

      // check if the user wants relative time
      // if so, substract the first timestamp from each subsequent timestamps
      if (timeIsRelative) {
        g.each(function (d) {
          d.forEach(function (datum, index) {
            datum.times.forEach(function (time, j) {
              if (index === 0 && j === 0) {
                var originTime = time.starting_time; // Store the timestamp that will serve as origin

                time.starting_time = 0; // Set the origin
                time.ending_time = time.ending_time - originTime; // Store the relative time (millis)
              } else {
                time.starting_time = time.starting_time - originTime;
                time.ending_time = time.ending_time - originTime;
              }
            });
          });
        });
      }

      // check how many stacks we're gonna need
      // do this here so that we can draw the axis before the graph
      if (stacked || ending === 0 || beginning === 0) {
        g.each(function (d) {
          d.forEach(function (datum, index) {
            // create y mapping for stacked graph
            if (stacked && Object.keys(yAxisMapping).indexOf(index) == -1) {
              yAxisMapping[index] = maxStack;
              maxStack++;
            }

            // figure out beginning and ending times if they are unspecified
            datum.times.forEach(function (time) {
              if (beginning === 0) {
                if (
                  time.starting_time < minTime ||
                  (minTime === 0 && timeIsRelative === false)
                ) {
                  minTime = time.starting_time;
                }
              }
              if (ending === 0) {
                if (time.ending_time > maxTime) {
                  maxTime = time.ending_time;
                }
              }
            });
          });
        });

        if (ending === 0) {
          ending = maxTime;
        }
        if (beginning === 0) {
          beginning = minTime;
        }
      }

      var scaleFactor =
        (1 / (ending - beginning)) * (width - margin.left - margin.right);

      // draw the axis
      var xScale = d3.time
        .scale()
        .domain([updatedBegining, updatedEnding])
        .range([margin.left, width - margin.right]);

      var xAxis = d3.svg
        .axis()
        .scale(xScale)
        .orient(orient)
        .tickSize(tickFormat.tickSize);

      if (tickFormat.tickValues != null) {
        xAxis.tickValues(tickFormat.tickValues);
      } else {
        xAxis.ticks(
          tickFormat.numTicks || timeUnit
            ? d3.time[timeUnit.toLowerCase()]
            : tickFormat.tickTime,
          timeInterval ? timeInterval : tickFormat.tickInterval
        );
      }

      var dataPos = function (d) {
        if (d < 58) {
          self.stopLeftClick = false;

          return -100;
        } else if (d > gParentSize.width - 45) {
          self.stopRightClick = false;

          return -100;
        } else {
          return d;
        }
      };
      var move = function () {
        if (!self.stopLeftClick && !self.stopRightClick) {
          let translate = d3.event.translate[0];

          if (constants.offset) {
            translate = translate - constants.offset;
            constants.offset += translate;
          }

          var diff = d3.event.translate[0] - constants.initialScaleDrag;

          if (diff == 0) {
            return;
          } else {
            updatedBegining -= constants.moveConstant * diff;
            updatedEnding -= constants.moveConstant * diff;
          }
          moveOp();
          constants.initialDrag = d3.event.translate[0];
          constants.initialScaleDrag = d3.event.translate[0];
        }
      };

      var moveLeft = function (beginning, ending) {
        // multiply by 4 to move that many executions on single click
        constants.clickConstant =
          Utils.numberToMilliseconds(timeInterval, timeUnit) * 4;

        updatedBegining = beginning + constants.clickConstant;
        updatedEnding = ending + constants.clickConstant;
        moveOp();
        leftButton();
        rightButton();
      };

      var moveRight = function (beginning, ending) {
        // multiply by 4 to move that many executions on single click
        constants.clickConstant =
          Utils.numberToMilliseconds(timeInterval, timeUnit) * 4;

        updatedBegining = beginning - constants.clickConstant;
        updatedEnding = ending - constants.clickConstant;
        moveOp();
        leftButton();
        rightButton();
      };

      var moveOp = function () {
        xScale.domain([updatedBegining, updatedEnding]);
        gParent.select('.axis').call(xAxis).selectAll('.tick text').call(wrap);

        gParent.selectAll('.tempRect').forEach((elems) => {
          if (constants.initialDrag) {
            constants.offset = JSON.parse(
              JSON.stringify(constants.initialDrag)
            );
          }
          self.stopLeftClick = true;
          self.stopRightClick = true;
          elems.forEach((obj) => {
            d3.select(obj).attr('x', (d) => {
              d.position = getXPos(d);

              return dataPos(d.position);
            });
          });
        });
        constants.initialDrag = 0;
      };

      var zoom = d3.behavior
        .zoom()
        .x(xScale)
        .scaleExtent([1, 1])
        .on('zoom', move);

      if (self.tooltip) {
        self.tooltip.remove();
      }
      self.tooltip = d3
        .select('body')
        .append('div')
        .attr('class', 'timeline-tooltip')
        .style('display', 'none');

      self.stopLeftClick = true;
      self.stopRightClick = true;
      // draw the chart
      g.each(function (d) {
        chartData = d;
        d.forEach(function (datum, index) {
          var data = datum.times;
          var hasLabel = typeof datum.label != 'undefined';

          // issue warning about using id per data set. Ids should be individual to data elements
          if (typeof datum.id != 'undefined') {
            throw new Error(
              "d3Timeline Warning: Ids per dataset is deprecated in favor of a 'class' key. Ids are now per data element."
            );
          }

          if (backgroundColor) {
            appendBackgroundBar(yAxisMapping, index, g, data, datum);
          }

          g.selectAll('svg')
            .data(data)
            .enter()
            .append(function (d) {
              return document.createElementNS(
                d3.ns.prefix.svg,
                'display' in d ? d.display : display
              );
            })
            .attr('x', (d) => {
              d.position = getXPos(d);

              return dataPos(d.position);
            })
            .attr('y', getStackPosition)
            .attr('width', 24)
            .attr('cy', function (d, i) {
              return getStackPosition(d, i) + itemHeight / 2 + 10;
            })
            .attr('cx', getXPos)
            .attr('r', itemHeight / 2)
            .attr('height', 24) // itemHeight)
            .style('fill', function (d) {
              var dColorPropName;

              if (d.color) {
                return d.color;
              }
              if (colorPropertyName) {
                dColorPropName = d[colorPropertyName];
                if (dColorPropName) {
                  return colorCycle(dColorPropName);
                } else {
                  return colorCycle(datum[colorPropertyName]);
                }
              }

              return colorCycle(index);
            })
            .on('mousemove', function (d) {
              hover(d, index, datum);
            })
            .on('mouseover', function (d, i) {
              mouseover(d, i, datum);
            })
            .on('mouseout', function (d, i) {
              mouseout(d, i, datum);
            })
            .on('click', function (d) {
              click(d, index, datum);
            })
            .attr('class', function () {
              return datum.class
                ? 'tempRect timelineSeries_' + datum.class
                : 'tempRect timelineSeries_' + datum.label;
            })
            .attr('id', function (d, i) {
              // use deprecated id field
              if (datum.id && !d.id) {
                return 'timelineItem_' + datum.id;
              }

              return d.id ? d.id : 'timelineItem_' + index + '_' + i;
            });

          if (rowSeparatorsColor) {
            var lineYAxis =
              itemHeight +
              itemMargin / 2 +
              margin.top +
              (itemHeight + itemMargin) * yAxisMapping[index];

            gParent
              .append('svg:line')
              .attr('class', 'row-separator')
              .attr('x1', 0 + margin.left)
              .attr('x2', width - margin.right)
              .attr('y1', lineYAxis)
              .attr('y2', lineYAxis)
              .attr('stroke-width', 1)
              .attr('stroke', rowSeparatorsColor);
          }

          // add the label
          if (hasLabel) {
            appendLabel(gParent, yAxisMapping, index, hasLabel, datum);
          }

          if (typeof datum.icon !== 'undefined') {
            gParent
              .append('image')
              .attr('class', 'timeline-label')
              .attr(
                'transform',
                'translate(' +
                  0 +
                  ',' +
                  (margin.top +
                    (itemHeight + itemMargin) * yAxisMapping[index]) +
                  ')'
              )
              .attr('xlink:href', datum.icon)
              .attr('width', margin.left)
              .attr('height', itemHeight);
          }

          function getStackPosition() {
            if (stacked) {
              return (
                margin.top + (itemHeight + itemMargin) * yAxisMapping[index]
              );
            }

            return margin.top + 15;
          }

          // function getStackTextPosition() {
          //   if (stacked) {
          //     return (
          //       margin.top +
          //       (itemHeight + itemMargin) * yAxisMapping[index] +
          //       itemHeight * 0.75
          //     );
          //   }

          //   return margin.top + itemHeight * 0.75;
          // }
        });
      });

      var belowLastItem = margin.top + (itemHeight + itemMargin) * maxStack;
      var aboveFirstItem = margin.top + 5;
      var timeAxisYPosition = showAxisTop ? aboveFirstItem : belowLastItem;

      if (showTimeAxis) {
        appendTimeAxis(g, xAxis, timeAxisYPosition);
      }
      if (timeAxisTick) {
        appendTimeAxisTick(g, xAxis, maxStack);
      }

      gParent.attr('class', 'scrollable').call(zoom);

      if (rotateTicks) {
        g.selectAll('.tick text').attr('transform', function () {
          return (
            'rotate(' +
            rotateTicks +
            ')translate(' +
            (this.getBBox().width / 2 + 10) +
            ',' + // TODO: change this 10
            this.getBBox().height / 2 +
            ')'
          );
        });
      }

      var gSize = g[0][0].getBoundingClientRect();

      setHeight();

      if (showBorderLine) {
        g.each(function (d) {
          d.forEach(function (datum) {
            var times = datum.times;

            times.forEach(function (time) {
              appendLine(xScale(time.starting_time), showBorderFormat);
              appendLine(xScale(time.ending_time), showBorderFormat);
            });
          });
        });
      }

      if (showTodayLine) {
        var todayLine = xScale(new Date());

        appendLine(todayLine, showTodayFormat);
      }

      function getXPos(d) {
        return (
          margin.left + (d.starting_time - updatedBegining) * scaleFactor - 12
        );
      }

      // function getXTextPos(d) {
      //   return margin.left + (d.starting_time - beginning) * scaleFactor + 5;
      // }

      function setHeight() {
        if (!height && !gParentItem.attr('height')) {
          if (itemHeight) {
            // set height based off of item height
            height = gSize.height + gSize.top - gParentSize.top;
            // set bounding rectangle height
            d3.select(gParent[0][0]).attr('height', height);
          } else {
            throw 'height of the timeline is not set';
          }
        } else {
          if (!height) {
            height = gParentItem.attr('height');
          } else {
            gParentItem.attr('height', height);
          }
        }
      }

      function setWidth() {
        if (!width && !gParentSize.width) {
          try {
            width = gParentItem.attr('width');
            if (!width) {
              throw 'width of the timeline is not set. As of Firefox 27, timeline().with(x) needs to be explicitly set in order to render';
            }
          } catch (err) {
            throw new Error(err);
          }
        } else if (!(width && gParentSize.width)) {
          try {
            width = gParentSize.width; // gParentItem.attr("width");
          } catch (err) {
            throw new Error(err);
          }
        }
        // if both are set, do nothing
      }

      function appendLine(lineScale, lineFormat) {
        gParent
          .append('svg:line')
          .attr('x1', lineScale)
          .attr('y1', lineFormat.marginTop)
          .attr('x2', lineScale)
          .attr('y2', height - lineFormat.marginBottom)
          .style('stroke', lineFormat.color) // "rgb(6,120,155)")
          .style('stroke-width', lineFormat.width);
      }
      // add left button
      var leftImg = gParent
        .select('g')
        .append('image')
        .attr('xlink:href', function () {
          return 'tier.svg';
        })
        .attr('x', 25)
        .attr('y', 50)
        .attr('width', 20)
        .attr('height', 20)
        .on('click', function (d) {
          if (self.stopLeftClick) {
            leftImg.style('cursor', 'not-allowed').style('opacity', 0.2);
          } else {
            return (
              moveRight(updatedBegining, updatedEnding),
              rightClickAPICall(updatedBegining, updatedEnding, d)
            );
          }
        });

      var leftButton = function () {
        if (self.stopLeftClick) {
          leftImg.style('cursor', 'not-allowed').style('opacity', 0.2);
        } else {
          leftImg.style('cursor', 'grab').style('opacity', 1);
        }
      };

      leftButton();

      // add right button
      var rightImg = gParent
        .select('g')
        .append('image')
        .attr('xlink:href', function () {
          return 'styles/img/Chevron-Right.svg';
        })
        .attr('x', width - 25)
        .attr('y', 50)
        .attr('width', 20)
        .attr('height', 20)
        .on('click', function () {
          if (self.stopRightClick) {
            rightImg.style('cursor', 'not-allowed').style('opacity', 0.2);
          } else {
            return moveLeft(updatedBegining, updatedEnding);
          }
        });

      var rightButton = function () {
        if (self.stopRightClick) {
          rightImg.style('cursor', 'not-allowed').style('opacity', 0.2);
        } else {
          rightImg.style('cursor', 'grab').style('opacity', 1);
        }
      };

      rightButton();
    }

    // SETTINGS

    timeline.margin = function (p) {
      if (!arguments.length) {
        return margin;
      }
      margin = p;

      return timeline;
    };

    timeline.orient = function (orientation) {
      if (!arguments.length) {
        return orient;
      }
      orient = orientation;

      return timeline;
    };

    timeline.itemHeight = function (h) {
      if (!arguments.length) {
        return itemHeight;
      }
      itemHeight = h;

      return timeline;
    };

    timeline.itemMargin = function (h) {
      if (!arguments.length) {
        return itemMargin;
      }
      itemMargin = h;

      return timeline;
    };

    timeline.navMargin = function (h) {
      if (!arguments.length) {
        return navMargin;
      }
      navMargin = h;

      return timeline;
    };

    timeline.height = function (h) {
      if (!arguments.length) {
        return height;
      }
      height = h;

      return timeline;
    };

    timeline.width = function (w) {
      if (!arguments.length) {
        return width;
      }
      width = w;

      return timeline;
    };

    timeline.display = function (displayType) {
      if (!arguments.length || DISPLAY_TYPES.indexOf(displayType) == -1) {
        return display;
      }
      display = displayType;

      return timeline;
    };

    timeline.labelFormat = function (f) {
      if (!arguments.length) {
        return labelFunction;
      }
      labelFunction = f;

      return timeline;
    };

    timeline.tickFormat = function (format) {
      if (!arguments.length) {
        return tickFormat;
      }
      tickFormat = format;

      return timeline;
    };

    timeline.hover = function (hoverFunc) {
      if (!arguments.length) {
        return hover;
      }
      hover = hoverFunc;

      return timeline;
    };

    timeline.mouseover = function (mouseoverFunc) {
      if (!arguments.length) {
        return mouseover;
      }
      mouseover = mouseoverFunc;

      return timeline;
    };

    timeline.mouseout = function (mouseoutFunc) {
      if (!arguments.length) {
        return mouseout;
      }
      mouseout = mouseoutFunc;

      return timeline;
    };

    timeline.click = function (clickFunc) {
      if (!arguments.length) {
        return click;
      }
      click = clickFunc;

      return timeline;
    };

    timeline.scroll = function (scrollFunc) {
      if (!arguments.length) {
        return scroll;
      }
      scroll = scrollFunc;

      return timeline;
    };

    timeline.colors = function (colorFormat) {
      if (!arguments.length) {
        return colorCycle;
      }
      colorCycle = colorFormat;

      return timeline;
    };

    timeline.beginning = function (b) {
      if (!arguments.length) {
        return beginning;
      }
      beginning = b;
      updatedBegining = b;

      return timeline;
    };

    timeline.ending = function (e) {
      if (!arguments.length) {
        return ending;
      }
      ending = e;
      updatedEnding = e;

      return timeline;
    };

    timeline.timeInterval = function (i) {
      if (!arguments.length) {
        return timeInterval;
      }
      timeInterval = i;

      return timeline;
    };

    timeline.timeUnit = function (u) {
      if (!arguments.length) {
        return timeUnit;
      }
      timeUnit = u;

      return timeline;
    };

    timeline.labelMargin = function (m) {
      if (!arguments.length) {
        return labelMargin;
      }
      labelMargin = m;

      return timeline;
    };

    timeline.rotateTicks = function (degrees) {
      if (!arguments.length) {
        return rotateTicks;
      }
      rotateTicks = degrees;

      return timeline;
    };

    timeline.stack = function () {
      stacked = !stacked;

      return timeline;
    };

    timeline.relativeTime = function () {
      timeIsRelative = !timeIsRelative;

      return timeline;
    };

    timeline.showBorderLine = function () {
      showBorderLine = !showBorderLine;

      return timeline;
    };

    timeline.showBorderFormat = function (borderFormat) {
      if (!arguments.length) {
        return showBorderFormat;
      }
      showBorderFormat = borderFormat;

      return timeline;
    };

    timeline.showToday = function () {
      showTodayLine = !showTodayLine;

      return timeline;
    };

    timeline.showTodayFormat = function (todayFormat) {
      if (!arguments.length) {
        return showTodayFormat;
      }
      showTodayFormat = todayFormat;

      return timeline;
    };

    timeline.colorProperty = function (colorProp) {
      if (!arguments.length) {
        return colorPropertyName;
      }
      colorPropertyName = colorProp;

      return timeline;
    };

    timeline.rowSeparators = function (color) {
      if (!arguments.length) {
        return rowSeparatorsColor;
      }
      rowSeparatorsColor = color;

      return timeline;
    };

    timeline.background = function (color) {
      if (!arguments.length) {
        return backgroundColor;
      }
      backgroundColor = color;

      return timeline;
    };

    timeline.showTimeAxis = function () {
      showTimeAxis = !showTimeAxis;

      return timeline;
    };

    timeline.showAxisTop = function () {
      showAxisTop = !showAxisTop;

      return timeline;
    };

    timeline.showAxisCalendarYear = function () {
      showAxisCalendarYear = !showAxisCalendarYear;

      return timeline;
    };

    timeline.showTimeAxisTick = function () {
      timeAxisTick = !timeAxisTick;

      return timeline;
    };

    timeline.fullLengthBackgrounds = function () {
      fullLengthBackgrounds = !fullLengthBackgrounds;

      return timeline;
    };

    timeline.showTimeAxisTickFormat = function (format) {
      if (!arguments.length) {
        return timeAxisTickFormat;
      }
      timeAxisTickFormat = format;

      return timeline;
    };

    timeline.showAxisHeaderBackground = function (bgColor) {
      showAxisHeaderBackground = !showAxisHeaderBackground;
      if (bgColor) {
        axisBgColor = bgColor;
      }

      return timeline;
    };

    timeline.navigate = function (navigateBackwards, navigateForwards) {
      if (!arguments.length) {
        return [navigateLeft, navigateRight];
      }
      navigateLeft = navigateBackwards;
      navigateRight = navigateForwards;
      showAxisNav = !showAxisNav;

      return timeline;
    };

    timeline.rightClick = function (x) {
      if (!arguments.length) {
        return rightClickAPICall;
      }
      rightClickAPICall = x;

      return timeline;
    };

    return timeline;
  };
})();
