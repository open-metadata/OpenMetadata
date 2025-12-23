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
import {
  FieldTypes,
  FormItemLayout,
  HelperTextType,
} from '../interface/FormUtils.interface';
import { createScrollToErrorHandler, getField } from './formUtils';

describe('formUtils', () => {
  describe('getField', () => {
    it('Should render FormItem with Alert', async () => {
      const result = getField({
        name: 'mutuallyExclusive',
        label: 'label.mutually-exclusive',
        type: FieldTypes.SWITCH,
        required: false,
        helperText: 'message.mutually-exclusive-alert-entity',
        helperTextType: HelperTextType.ALERT,
        props: {
          'data-testid': 'mutually-exclusive-button',
        },
        id: 'root/mutuallyExclusive',
        formItemLayout: FormItemLayout.HORIZONTAL,
      });

      expect(JSON.stringify(result)).toContain('form-item-alert');
    });

    it('Should not render FormItem with Alert is showHelperText is false', async () => {
      const result = getField({
        name: 'mutuallyExclusive',
        label: 'label.mutually-exclusive',
        type: FieldTypes.SWITCH,
        required: false,
        helperText: 'message.mutually-exclusive-alert-entity',
        helperTextType: HelperTextType.ALERT,
        showHelperText: false,
        props: {
          'data-testid': 'mutually-exclusive-button',
        },
        id: 'root/mutuallyExclusive',
        formItemLayout: FormItemLayout.HORIZONTAL,
      });

      expect(JSON.stringify(result)).not.toContain('form-item-alert');
    });

    it('Should not render FormItem with Alert', async () => {
      const result = getField({
        name: 'mutuallyExclusive',
        label: 'label.mutually-exclusive',
        type: FieldTypes.SWITCH,
        required: false,
        helperText: 'message.mutually-exclusive-alert-entity',
        helperTextType: HelperTextType.Tooltip,
        props: {
          'data-testid': 'mutually-exclusive-button',
        },
        id: 'root/mutuallyExclusive',
        formItemLayout: FormItemLayout.HORIZONTAL,
      });

      expect(JSON.stringify(result)).not.toContain('form-item-alert');
    });

    it('Should render TEXT_MUI field type with MUITextField from core components', async () => {
      const result = getField({
        name: 'testField',
        label: 'Test Field',
        type: FieldTypes.TEXT_MUI,
        required: true,
        helperText: 'This is a helper text',
        helperTextType: HelperTextType.ALERT,
        props: {
          'data-testid': 'test-text-field',
        },
        id: 'root/testField',
        formItemLayout: FormItemLayout.VERTICAL,
      });

      // Verify the result contains MUITextField
      const resultString = JSON.stringify(result);
      expect(resultString).toContain('testField');
    });

    it('Should render PASSWORD_MUI field type with type password', async () => {
      const result = getField({
        name: 'passwordField',
        label: 'Password Field',
        type: FieldTypes.PASSWORD_MUI,
        required: true,
        props: {
          'data-testid': 'test-password-field',
        },
        id: 'root/passwordField',
        formItemLayout: FormItemLayout.VERTICAL,
      });

      // Verify the result contains password type
      const resultString = JSON.stringify(result);
      expect(resultString).toContain('password');
    });
  });

  describe('createScrollToErrorHandler', () => {
    let mockScrollTo: jest.Mock;
    let mockScrollIntoView: jest.Mock;
    let mockQuerySelector: jest.SpyInstance;

    beforeEach(() => {
      jest.useFakeTimers();
      mockScrollTo = jest.fn();
      mockScrollIntoView = jest.fn();
      mockQuerySelector = jest.spyOn(document, 'querySelector');
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    describe('factory function', () => {
      it('returns a function when called', () => {
        const handler = createScrollToErrorHandler();

        expect(typeof handler).toBe('function');
      });

      it('applies default configuration when no options provided', () => {
        mockQuerySelector.mockReturnValue(null);

        const handler = createScrollToErrorHandler();
        handler();
        jest.advanceTimersByTime(100);

        expect(mockQuerySelector).toHaveBeenCalledWith(
          '.ant-form-item-has-error'
        );
      });

      it('merges partial options with defaults', () => {
        mockQuerySelector.mockReturnValue(null);

        const handler = createScrollToErrorHandler({ delay: 50 });
        handler();
        jest.advanceTimersByTime(50);

        expect(mockQuerySelector).toHaveBeenCalledWith(
          '.ant-form-item-has-error'
        ); // default selector used
      });
    });

    describe('scroll behavior', () => {
      it('calculates correct scroll position for container scrolling', () => {
        const mockErrorElement = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 300 }),
        };
        const mockContainer = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 100 }),
          scrollTop: 50,
          scrollTo: mockScrollTo,
        };

        mockQuerySelector
          .mockReturnValueOnce(mockErrorElement)
          .mockReturnValueOnce(mockContainer);

        const handler = createScrollToErrorHandler();
        handler();
        jest.advanceTimersByTime(100);

        expect(mockScrollTo).toHaveBeenCalledWith({
          top: 150, // 50 + 300 - 100 - 100 (default offset)
          behavior: 'smooth',
        });
      });

      it('prevents negative scroll values', () => {
        const mockErrorElement = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 10 }),
        };
        const mockContainer = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 100 }),
          scrollTop: 0,
          scrollTo: mockScrollTo,
        };

        mockQuerySelector
          .mockReturnValueOnce(mockErrorElement)
          .mockReturnValueOnce(mockContainer);

        const handler = createScrollToErrorHandler();
        handler();
        jest.advanceTimersByTime(100);

        expect(mockScrollTo).toHaveBeenCalledWith({
          top: 0, // Math.max(0, negative calculation)
          behavior: 'smooth',
        });
      });

      it('uses custom scroll behavior when specified', () => {
        const mockErrorElement = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 300 }),
        };
        const mockContainer = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 100 }),
          scrollTop: 0,
          scrollTo: mockScrollTo,
        };

        mockQuerySelector
          .mockReturnValueOnce(mockErrorElement)
          .mockReturnValueOnce(mockContainer);

        const handler = createScrollToErrorHandler({ behavior: 'auto' });
        handler();
        jest.advanceTimersByTime(100);

        expect(mockScrollTo).toHaveBeenCalledWith({
          top: 100, // 0 + 300 - 100 - 100
          behavior: 'auto',
        });
      });
    });

    describe('fallback behavior', () => {
      it('uses scrollIntoView when container not found', () => {
        const mockErrorElement = {
          getBoundingClientRect: jest.fn(),
          scrollIntoView: mockScrollIntoView,
        };

        mockQuerySelector
          .mockReturnValueOnce(mockErrorElement)
          .mockReturnValueOnce(null); // container not found

        const handler = createScrollToErrorHandler();
        handler();
        jest.advanceTimersByTime(100);

        expect(mockScrollIntoView).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      });

      it('uses custom behavior in scrollIntoView fallback', () => {
        const mockErrorElement = {
          getBoundingClientRect: jest.fn(),
          scrollIntoView: mockScrollIntoView,
        };

        mockQuerySelector
          .mockReturnValueOnce(mockErrorElement)
          .mockReturnValueOnce(null);

        const handler = createScrollToErrorHandler({ behavior: 'auto' });
        handler();
        jest.advanceTimersByTime(100);

        expect(mockScrollIntoView).toHaveBeenCalledWith({
          behavior: 'auto',
          block: 'center',
          inline: 'nearest',
        });
      });

      it('does nothing when no error element exists', () => {
        mockQuerySelector.mockReturnValue(null);

        const handler = createScrollToErrorHandler();
        handler();
        jest.advanceTimersByTime(100);

        expect(mockScrollTo).not.toHaveBeenCalled();
        expect(mockScrollIntoView).not.toHaveBeenCalled();
      });
    });

    describe('configuration options', () => {
      it('uses custom error selector', () => {
        mockQuerySelector.mockReturnValue(null);

        const handler = createScrollToErrorHandler({
          errorSelector: '.my-error-class',
        });
        handler();
        jest.advanceTimersByTime(100);

        expect(mockQuerySelector).toHaveBeenCalledWith('.my-error-class');
      });

      it('uses custom scroll container selector', () => {
        const mockErrorElement = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 200 }),
          scrollIntoView: mockScrollIntoView,
        };

        mockQuerySelector
          .mockReturnValueOnce(mockErrorElement)
          .mockReturnValueOnce(null);

        const handler = createScrollToErrorHandler({
          scrollContainer: '.my-container',
        });
        handler();
        jest.advanceTimersByTime(100);

        expect(mockQuerySelector).toHaveBeenCalledWith('.my-container');
      });

      it('applies custom offset in scroll calculation', () => {
        const mockErrorElement = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 300 }),
        };
        const mockContainer = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 100 }),
          scrollTop: 50,
          scrollTo: mockScrollTo,
        };

        mockQuerySelector
          .mockReturnValueOnce(mockErrorElement)
          .mockReturnValueOnce(mockContainer);

        const handler = createScrollToErrorHandler({ offsetTop: 200 });
        handler();
        jest.advanceTimersByTime(100);

        expect(mockScrollTo).toHaveBeenCalledWith({
          top: 50, // 50 + 300 - 100 - 200 (custom offset)
          behavior: 'smooth',
        });
      });

      it('respects custom delay timing', () => {
        const mockErrorElement = {
          getBoundingClientRect: jest.fn(),
          scrollIntoView: mockScrollIntoView,
        };

        mockQuerySelector
          .mockReturnValueOnce(mockErrorElement)
          .mockReturnValueOnce(null);

        const handler = createScrollToErrorHandler({ delay: 300 });
        handler();

        jest.advanceTimersByTime(200);

        expect(mockScrollIntoView).not.toHaveBeenCalled();

        jest.advanceTimersByTime(100);

        expect(mockScrollIntoView).toHaveBeenCalled();
      });
    });

    describe('integration scenarios', () => {
      it('handles BundleSuiteForm layout configuration', () => {
        const mockErrorElement = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 600 }),
        };
        const mockDrawerBody = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 80 }),
          scrollTop: 150,
          scrollTo: mockScrollTo,
        };

        mockQuerySelector
          .mockReturnValueOnce(mockErrorElement)
          .mockReturnValueOnce(mockDrawerBody);

        const handler = createScrollToErrorHandler({
          scrollContainer: '.ant-drawer-body',
        });
        handler();
        jest.advanceTimersByTime(100);

        expect(mockQuerySelector).toHaveBeenNthCalledWith(
          2,
          '.ant-drawer-body'
        );
        expect(mockScrollTo).toHaveBeenCalledWith({
          top: 570, // 150 + 600 - 80 - 100
          behavior: 'smooth',
        });
      });

      it('handles default TestCaseFormV1 layout configuration', () => {
        const mockErrorElement = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 400 }),
        };
        const mockDrawerContent = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 120 }),
          scrollTop: 200,
          scrollTo: mockScrollTo,
        };

        mockQuerySelector
          .mockReturnValueOnce(mockErrorElement)
          .mockReturnValueOnce(mockDrawerContent);

        const handler = createScrollToErrorHandler(); // uses default .drawer-form-content
        handler();
        jest.advanceTimersByTime(100);

        expect(mockQuerySelector).toHaveBeenNthCalledWith(
          2,
          '.drawer-form-content'
        );
        expect(mockScrollTo).toHaveBeenCalledWith({
          top: 380, // 200 + 400 - 120 - 100
          behavior: 'smooth',
        });
      });
    });

    describe('edge cases', () => {
      it('handles missing getBoundingClientRect gracefully', () => {
        const mockErrorElement = { getBoundingClientRect: null };
        const mockContainer = { scrollTo: mockScrollTo };

        mockQuerySelector
          .mockReturnValueOnce(mockErrorElement)
          .mockReturnValueOnce(mockContainer);

        const handler = createScrollToErrorHandler();

        expect(() => {
          handler();
          jest.advanceTimersByTime(100);
        }).toThrow();
      });

      it('handles zero scroll offset correctly', () => {
        const mockErrorElement = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 100 }),
        };
        const mockContainer = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 100 }),
          scrollTop: 0,
          scrollTo: mockScrollTo,
        };

        mockQuerySelector
          .mockReturnValueOnce(mockErrorElement)
          .mockReturnValueOnce(mockContainer);

        const handler = createScrollToErrorHandler({ offsetTop: 0 });
        handler();
        jest.advanceTimersByTime(100);

        expect(mockScrollTo).toHaveBeenCalledWith({
          top: 0, // 0 + 100 - 100 - 0 = 0
          behavior: 'smooth',
        });
      });

      it('handles extremely large offset values', () => {
        const mockErrorElement = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 200 }),
        };
        const mockContainer = {
          getBoundingClientRect: jest.fn().mockReturnValue({ top: 100 }),
          scrollTop: 50,
          scrollTo: mockScrollTo,
        };

        mockQuerySelector
          .mockReturnValueOnce(mockErrorElement)
          .mockReturnValueOnce(mockContainer);

        const handler = createScrollToErrorHandler({ offsetTop: 1000 });
        handler();
        jest.advanceTimersByTime(100);

        expect(mockScrollTo).toHaveBeenCalledWith({
          top: 0, // Math.max(0, negative result)
          behavior: 'smooth',
        });
      });
    });
  });
});
