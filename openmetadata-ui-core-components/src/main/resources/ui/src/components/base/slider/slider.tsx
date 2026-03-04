import type { SliderProps as AriaSliderProps } from "react-aria-components";
import {
    Label as AriaLabel,
    Slider as AriaSlider,
    SliderOutput as AriaSliderOutput,
    SliderThumb as AriaSliderThumb,
    SliderTrack as AriaSliderTrack,
} from "react-aria-components";
import { cx, sortCx } from "@/utils/cx";

const styles = sortCx({
    default: "tw:hidden",
    bottom: "tw:absolute tw:top-2 tw:left-1/2 tw:-translate-x-1/2 tw:translate-y-full tw:text-md tw:font-medium tw:text-primary",
    "top-floating":
        "tw:absolute tw:-top-2 tw:left-1/2 tw:-translate-x-1/2 tw:-translate-y-full tw:rounded-lg tw:bg-primary tw:px-3 tw:py-2 tw:text-xs tw:font-semibold tw:text-secondary tw:shadow-lg tw:ring-1 tw:ring-secondary_alt",
});

interface SliderProps extends AriaSliderProps {
    labelPosition?: keyof typeof styles;
    labelFormatter?: (value: number) => string;
}

export const Slider = ({ labelPosition = "default", minValue = 0, maxValue = 100, labelFormatter, formatOptions, ...rest }: SliderProps) => {
    // Format thumb value as percentage by default.
    const defaultFormatOptions: Intl.NumberFormatOptions = {
        style: "percent",
        maximumFractionDigits: 0,
    };

    return (
        <AriaSlider {...rest} {...{ minValue, maxValue }} formatOptions={formatOptions ?? defaultFormatOptions}>
            <AriaLabel />
            <AriaSliderTrack className="tw:relative tw:h-6 tw:w-full">
                {({ state: { values, getThumbValue, getThumbPercent, getFormattedValue } }) => {
                    const left = values.length === 1 ? 0 : getThumbPercent(0);
                    const width = values.length === 1 ? getThumbPercent(0) : getThumbPercent(1) - left;

                    return (
                        <>
                            <span className="tw:absolute tw:top-1/2 tw:h-2 tw:w-full tw:-translate-y-1/2 tw:rounded-full tw:bg-quaternary" />
                            <span
                                className="tw:absolute tw:top-1/2 tw:h-2 tw:w-full tw:-translate-y-1/2 tw:rounded-full tw:bg-brand-solid"
                                style={{
                                    left: `${left * 100}%`,
                                    width: `${width * 100}%`,
                                }}
                            />
                            {values.map((_, index) => {
                                return (
                                    <AriaSliderThumb
                                        key={index}
                                        index={index}
                                        className={({ isFocusVisible, isDragging }) =>
                                            cx(
                                                "tw:top-1/2 tw:box-border tw:size-6 tw:cursor-grab tw:rounded-full tw:bg-slider-handle-bg tw:shadow-md tw:ring-2 tw:ring-slider-handle-border tw:ring-inset",
                                                isFocusVisible && "tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring",
                                                isDragging && "tw:cursor-grabbing",
                                            )
                                        }
                                    >
                                        <AriaSliderOutput className={cx("tw:whitespace-nowrap", styles[labelPosition])}>
                                            {labelFormatter ? labelFormatter(getThumbValue(index)) : getFormattedValue(getThumbValue(index) / 100)}
                                        </AriaSliderOutput>
                                    </AriaSliderThumb>
                                );
                            })}
                        </>
                    );
                }}
            </AriaSliderTrack>
        </AriaSlider>
    );
};
