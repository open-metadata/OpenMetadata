import type { HTMLAttributes } from "react";
import { cx } from "@/utils/cx";
import { PlayIcon } from "./icons";

/**
 * Rounded play icon with blurred background and a filled triangle in the middle.
 */
export const PlayButtonIcon = (props: HTMLAttributes<HTMLDivElement>) => {
    return (
        <div
            {...props}
            className={cx(
                "tw:flex tw:size-20 tw:items-center tw:justify-center tw:rounded-full tw:bg-alpha-white/30 tw:backdrop-blur tw:transition tw:duration-100 tw:ease-linear tw:group-hover:bg-alpha-white/50 tw:hover:bg-alpha-white/50",
                props.className,
            )}
        >
            <PlayIcon className="tw:size-5 tw:text-white" />
        </div>
    );
};
