/*
 *  Copyright 2023 Collate.
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
import { Button, Space, Typography } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { SuggestionItem } from './items';

export type CommandsListState = {
  selectedIndex: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class CommandsList extends React.Component<any, CommandsListState> {
  static isInViewport(ele: HTMLElement, container: HTMLElement) {
    const eleTop = ele.offsetTop;
    const eleBottom = eleTop + ele.clientHeight;

    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;

    // The element is fully visible in the container
    return eleTop >= containerTop && eleBottom <= containerBottom;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(props: any) {
    super(props);
    this.state = {
      selectedIndex: 0,
    };
  }

  // being used by parent
  onKeyDown({ event }: { event: KeyboardEvent }) {
    if (event.key === 'ArrowUp') {
      this.upHandler();

      return true;
    }

    if (event.key === 'ArrowDown') {
      this.downHandler();

      return true;
    }

    if (event.key === 'Enter') {
      this.enterHandler();

      return true;
    }

    return false;
  }

  upHandler() {
    const { items } = this.props;
    this.setState((prev) => {
      const newIndex = (prev.selectedIndex + items.length - 1) % items.length;
      const commandListing = document.getElementById(
        `editor-command-${items[newIndex].title}`
      );
      const commandList = document.getElementById('editor-commands-viewport');
      if (
        commandList &&
        commandListing &&
        !CommandsList.isInViewport(commandListing, commandList)
      ) {
        commandListing.scrollIntoView();
      }

      return {
        selectedIndex: newIndex,
      };
    });
  }

  downHandler() {
    const { items } = this.props;

    this.setState((prev) => {
      const newIndex = (prev.selectedIndex + 1) % items.length;
      const commandListing = document.getElementById(
        `editor-command-${items[newIndex].title}`
      );
      const commandList = document.getElementById('editor-commands-viewport');
      if (
        commandList &&
        commandListing &&
        !CommandsList.isInViewport(commandListing, commandList)
      ) {
        commandListing.scrollIntoView();
      }

      return {
        selectedIndex: newIndex,
      };
    });
  }

  enterHandler() {
    const { selectedIndex } = this.state;
    this.selectItem(selectedIndex);
  }

  selectItem(index: number) {
    const { items, command } = this.props;
    const item = items[index];

    if (item) {
      command(item);
    }
  }

  render() {
    const { props } = this;
    const items = props.items as SuggestionItem[];
    const { selectedIndex } = this.state;

    return items.length > 0 ? (
      <div className="slash-menu-wrapper" id="editor-commands-viewport">
        {items.map((item, index) => (
          <div
            className="d-flex flex-column"
            id={`editor-command-${item.title}`}
            key={item.title}>
            {item.type !== items[index - 1]?.type && (
              <Typography className="m-b-xs">{item.type}</Typography>
            )}
            <Button
              className={classNames('d-flex', {
                'bg-grey-2': index === selectedIndex,
              })}
              key={item.title}
              type="text"
              onClick={() => this.selectItem(index)}>
              <Space align="center">
                <Typography className="font-bold">{item.title}</Typography>
                <Typography>{item.description}</Typography>
              </Space>
            </Button>
          </div>
        ))}
      </div>
    ) : null;
  }
}

export default CommandsList;
