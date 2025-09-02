import type { HTMLAttributes, SVGProps } from "react";
import { useId } from "react";
import { cx } from "@/utils/cx";

export const getStarProgress = (starPosition: number, rating: number, maxRating: number = 5) => {
    // Ensure rating is between 0 and 5
    const clampedRating = Math.min(Math.max(rating, 0), maxRating);

    const diff = clampedRating - starPosition;

    if (diff >= 1) return 100;
    if (diff <= 0) return 0;

    return Math.round(diff * 100);
};

interface StarIconProps extends SVGProps<SVGSVGElement> {
    /**
     * The progress of the star icon. It should be a number between 0 and 100.
     *
     * @default 100
     */
    progress?: number;
}

export const StarIcon = ({ progress = 100, ...props }: StarIconProps) => {
    const id = useId();

    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...props} className={cx("size-5 text-warning-400", props.className)}>
            <path
                d="M9.53834 1.60996C9.70914 1.19932 10.2909 1.19932 10.4617 1.60996L12.5278 6.57744C12.5998 6.75056 12.7626 6.86885 12.9495 6.88383L18.3123 7.31376C18.7556 7.3493 18.9354 7.90256 18.5976 8.19189L14.5117 11.6919C14.3693 11.8139 14.3071 12.0053 14.3506 12.1876L15.5989 17.4208C15.7021 17.8534 15.2315 18.1954 14.8519 17.9635L10.2606 15.1592C10.1006 15.0615 9.89938 15.0615 9.73937 15.1592L5.14806 17.9635C4.76851 18.1954 4.29788 17.8534 4.40108 17.4208L5.64939 12.1876C5.69289 12.0053 5.6307 11.8139 5.48831 11.6919L1.40241 8.19189C1.06464 7.90256 1.24441 7.3493 1.68773 7.31376L7.05054 6.88383C7.23744 6.86885 7.40024 6.75056 7.47225 6.57744L9.53834 1.60996Z"
                className="fill-bg-tertiary"
            />
            <g clipPath={`url(#clip-${id})`}>
                <path
                    d="M9.53834 1.60996C9.70914 1.19932 10.2909 1.19932 10.4617 1.60996L12.5278 6.57744C12.5998 6.75056 12.7626 6.86885 12.9495 6.88383L18.3123 7.31376C18.7556 7.3493 18.9354 7.90256 18.5976 8.19189L14.5117 11.6919C14.3693 11.8139 14.3071 12.0053 14.3506 12.1876L15.5989 17.4208C15.7021 17.8534 15.2315 18.1954 14.8519 17.9635L10.2606 15.1592C10.1006 15.0615 9.89938 15.0615 9.73937 15.1592L5.14806 17.9635C4.76851 18.1954 4.29788 17.8534 4.40108 17.4208L5.64939 12.1876C5.69289 12.0053 5.6307 11.8139 5.48831 11.6919L1.40241 8.19189C1.06464 7.90256 1.24441 7.3493 1.68773 7.31376L7.05054 6.88383C7.23744 6.86885 7.40024 6.75056 7.47225 6.57744L9.53834 1.60996Z"
                    fill="currentColor"
                />
            </g>
            <defs>
                <clipPath id={`clip-${id}`}>
                    <rect width={`${progress}%`} height="20" fill="white" />
                </clipPath>
            </defs>
        </svg>
    );
};

interface RatingStarsProps extends HTMLAttributes<HTMLDivElement> {
    /**
     * The rating to display.
     *
     * @default 5
     */
    rating?: number;
    /**
     * The number of stars to display.
     */
    stars?: number;
    /**
     * The class name of the star icon.
     */
    starClassName?: string;
}

export const RatingStars = ({ rating = 5, stars = 5, starClassName, ...props }: RatingStarsProps) => {
    return (
        <div {...props} className={cx("flex", props.className)}>
            {Array.from({ length: stars }).map((_, index) => (
                <StarIcon key={index} progress={getStarProgress(index, rating, stars)} className={starClassName} />
            ))}
        </div>
    );
};
