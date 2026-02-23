import { cx } from "@/utils/cx";

const sizes = {
    xs: "size-2",
    sm: "size-3",
    md: "size-3.5",
    lg: "size-4",
    xl: "size-4.5",
    "2xl": "size-5 ring-[1.67px]",
};

interface AvatarCompanyIconProps {
    size: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
    src: string;
    alt?: string;
}

export const AvatarCompanyIcon = ({ size, src, alt }: AvatarCompanyIconProps) => (
    <img
        src={src}
        alt={alt}
        className={cx("tw:bg-primary-25 tw:absolute tw:-right-0.5 tw:-bottom-0.5 tw:rounded-full tw:object-cover tw:ring-[1.5px] tw:ring-bg-primary", sizes[size])}
    />
);
