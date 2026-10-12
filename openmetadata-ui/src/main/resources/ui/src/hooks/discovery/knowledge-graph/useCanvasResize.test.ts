/*
 *  Copyright 2026 Collate.
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

import type { Graph } from '@antv/g6';
import type { MutableRefObject } from 'react';
import { attachCanvasResize } from './useCanvasResize';

type Callback = () => void;

interface RectInput {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface MockGraph {
  destroyed: boolean;
  getViewportByCanvas: jest.Mock;
  getSize: jest.Mock;
  resize: jest.Mock;
  translateBy: jest.Mock;
}

const rect = ({ left, top, width, height }: RectInput): DOMRect =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
    }),
  } as DOMRect);

class MockResizeObserver {
  static callbacks: Callback[] = [];
  private cb: Callback;
  constructor(cb: Callback) {
    this.cb = cb;
    MockResizeObserver.callbacks.push(cb);
  }
  observe = jest.fn();
  disconnect = jest.fn(() => {
    MockResizeObserver.callbacks = MockResizeObserver.callbacks.filter(
      (item) => item !== this.cb
    );
  });
  unobserve = jest.fn();
}

(
  globalThis as unknown as { ResizeObserver: typeof MockResizeObserver }
).ResizeObserver = MockResizeObserver;

jest.mock('./KnowledgeGraphCanvas.utils', () => ({
  isFocusInView: jest.fn(),
}));

import { isFocusInView } from './KnowledgeGraphCanvas.utils';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

interface SetupOptions {
  initialRect?: RectInput;
  parentWidth?: number;
  parentHeight?: number;
  windowWidth?: number;
  windowHeight?: number;
  graphSize?: [number, number];
  isDrawn?: () => boolean;
}

const DEFAULT_RECT: RectInput = { left: 0, top: 0, width: 800, height: 600 };

interface Setup {
  container: HTMLDivElement;
  parent: HTMLDivElement;
  graph: MockGraph;
  refitOnResize: MutableRefObject<boolean>;
  onFit: jest.Mock;
  onUpdateRings: jest.Mock;
  onError: jest.Mock;
  setRect: (next: RectInput) => void;
  setWindow: (width: number, height: number) => void;
  dispose: () => void;
  fire: () => void;
}

const setup = (options: SetupOptions = {}): Setup => {
  const {
    initialRect = DEFAULT_RECT,
    parentWidth = 800,
    parentHeight = 600,
    windowWidth = 1024,
    windowHeight = 768,
    graphSize = [800, 600],
  } = options;
  const parent = document.createElement('div');
  const container = document.createElement('div');
  parent.appendChild(container);
  document.body.appendChild(parent);

  Object.defineProperty(parent, 'clientWidth', {
    configurable: true,
    get: () => parentWidth,
  });
  Object.defineProperty(parent, 'clientHeight', {
    configurable: true,
    get: () => parentHeight,
  });
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    get: () => windowWidth,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    get: () => windowHeight,
  });

  let currentRect = rect(initialRect);
  jest
    .spyOn(container, 'getBoundingClientRect')
    .mockImplementation(() => currentRect);
  const setRect = (next: RectInput) => {
    currentRect = rect(next);
  };

  const graph: MockGraph = {
    destroyed: false,
    getViewportByCanvas: jest.fn((point: [number, number]) => point),
    getSize: jest.fn(() => graphSize),
    resize: jest.fn(),
    translateBy: jest.fn().mockResolvedValue(undefined),
  };

  const refitOnResize: MutableRefObject<boolean> = { current: false };
  const onFit = jest.fn();
  const onUpdateRings = jest.fn();
  const onError = jest.fn();
  const isDrawn = options.isDrawn ?? (() => true);

  const dispose = attachCanvasResize({
    container,
    graph: graph as unknown as Graph,
    isDrawn,
    refitOnResize,
    onFit,
    onUpdateRings,
    onError,
    getEntityId: () => 'root',
  });

  return {
    container,
    parent,
    graph,
    refitOnResize,
    onFit,
    onUpdateRings,
    onError,
    setRect,
    setWindow: (width: number, height: number) => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        get: () => width,
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        get: () => height,
      });
    },
    dispose,
    fire: () => MockResizeObserver.callbacks.forEach((cb) => cb()),
  };
};

describe('attachCanvasResize', () => {
  beforeEach(() => {
    MockResizeObserver.callbacks = [];
    (isFocusInView as unknown as jest.Mock).mockReset();
    (isFocusInView as unknown as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('refreshes the cached bounds during a refit so the next height-only resize does not pan by a stale offset', async () => {
    const env = setup({
      initialRect: { left: 0, top: 100, width: 800, height: 600 },
      parentWidth: 800,
      parentHeight: 600,
      graphSize: [800, 600],
    });

    env.refitOnResize.current = true;
    env.setRect({ left: 0, top: 16, width: 800, height: 600 });
    env.fire();
    await flush();

    expect(env.onFit).toHaveBeenCalledTimes(1);
    expect(env.graph.translateBy).not.toHaveBeenCalled();

    env.refitOnResize.current = false;
    env.setRect({ left: 0, top: 16, width: 800, height: 400 });
    env.fire();
    await flush();

    expect(env.graph.translateBy).toHaveBeenCalledTimes(1);
    expect(env.graph.translateBy).toHaveBeenCalledWith([0, 0], false);
    expect(env.onFit).toHaveBeenCalledTimes(1);

    env.dispose();
  });

  it('still translates by the real pane displacement when the pane moves without a refit', async () => {
    const env = setup({
      initialRect: { left: 0, top: 100, width: 800, height: 600 },
      parentWidth: 800,
      parentHeight: 600,
      graphSize: [800, 600],
    });

    env.refitOnResize.current = false;
    env.setRect({ left: 0, top: 60, width: 800, height: 600 });
    env.fire();
    await flush();

    expect(env.graph.translateBy).toHaveBeenCalledWith([0, 40], false);
    expect(env.onFit).not.toHaveBeenCalled();

    env.dispose();
  });

  it('keeps the view centered when only the window dimensions change', async () => {
    const env = setup({
      initialRect: { left: 0, top: 0, width: 800, height: 600 },
      parentWidth: 800,
      parentHeight: 600,
      graphSize: [800, 300],
      windowWidth: 1024,
      windowHeight: 768,
    });

    env.refitOnResize.current = false;
    env.setWindow(1280, 800);
    env.fire();
    await flush();

    expect(env.graph.translateBy).toHaveBeenCalledWith([0, 150], false);

    env.dispose();
  });

  it('does not touch the graph when it is destroyed or not yet drawn', () => {
    const env = setup({ isDrawn: () => false });

    env.refitOnResize.current = false;
    env.fire();

    expect(env.graph.translateBy).not.toHaveBeenCalled();
    expect(env.graph.resize).not.toHaveBeenCalled();
    expect(env.onFit).not.toHaveBeenCalled();
    expect(env.onUpdateRings).not.toHaveBeenCalled();

    env.dispose();
  });

  it('re-fits when a translate leaves the focus node outside the viewport', async () => {
    (isFocusInView as unknown as jest.Mock).mockReturnValue(false);
    const env = setup({
      initialRect: { left: 0, top: 100, width: 800, height: 600 },
      parentWidth: 800,
      parentHeight: 600,
      graphSize: [800, 600],
    });

    env.refitOnResize.current = false;
    env.setRect({ left: 0, top: 60, width: 800, height: 600 });
    env.fire();
    await flush();

    expect(env.graph.translateBy).toHaveBeenCalledWith([0, 40], false);
    expect(env.onFit).toHaveBeenCalledTimes(1);

    env.dispose();
  });

  it('clears the refit flag and updates rings during a refit fire', async () => {
    const env = setup();

    env.refitOnResize.current = true;
    env.fire();
    await flush();

    expect(env.refitOnResize.current).toBe(false);
    expect(env.onFit).toHaveBeenCalledTimes(1);
    expect(env.graph.translateBy).not.toHaveBeenCalled();
    expect(env.onUpdateRings).not.toHaveBeenCalled();

    env.dispose();
  });
});
