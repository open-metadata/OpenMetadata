import type { SVGProps } from "react";

export const GridCheck = (props: Omit<SVGProps<SVGSVGElement>, "size"> & { size?: "sm" | "md" }) => {
    const { size = "md", className } = props;
    const Pattern = sizes[size];

    return <Pattern className={className} />;
};

const md = (props: SVGProps<SVGSVGElement>) => {
    return (
        <svg width="960" height="960" viewBox="0 0 960 960" fill="none" {...props}>
            <mask id="mask0_4940_405685" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="960" height="960">
                <rect width="960" height="960" fill="url(#paint0_radial_4940_405685)" />
            </mask>
            <g mask="url(#mask0_4940_405685)">
                <g clipPath="url(#clip0_4940_405685)">
                    <mask id="path-3-inside-1_4940_405685" fill="white">
                        <path d="M0 0H96V96H0V0Z" />
                    </mask>
                    <path d="M96 96V97H97V96H96ZM95 0V96H97V0H95ZM96 95H0V97H96V95Z" fill="#D0D5DD" mask="url(#path-3-inside-1_4940_405685)" />
                    <mask id="path-5-inside-2_4940_405685" fill="white">
                        <path d="M96 0H192V96H96V0Z" />
                    </mask>
                    <path d="M192 96V97H193V96H192ZM191 0V96H193V0H191ZM192 95H96V97H192V95Z" fill="#D0D5DD" mask="url(#path-5-inside-2_4940_405685)" />
                    <mask id="path-7-inside-3_4940_405685" fill="white">
                        <path d="M192 0H288V96H192V0Z" />
                    </mask>
                    <path d="M288 96V97H289V96H288ZM287 0V96H289V0H287ZM288 95H192V97H288V95Z" fill="#D0D5DD" mask="url(#path-7-inside-3_4940_405685)" />
                    <mask id="path-9-inside-4_4940_405685" fill="white">
                        <path d="M288 0H384V96H288V0Z" />
                    </mask>
                    <path d="M384 96V97H385V96H384ZM383 0V96H385V0H383ZM384 95H288V97H384V95Z" fill="#D0D5DD" mask="url(#path-9-inside-4_4940_405685)" />
                    <mask id="path-11-inside-5_4940_405685" fill="white">
                        <path d="M384 0H480V96H384V0Z" />
                    </mask>
                    <path d="M480 96V97H481V96H480ZM479 0V96H481V0H479ZM480 95H384V97H480V95Z" fill="#D0D5DD" mask="url(#path-11-inside-5_4940_405685)" />
                    <mask id="path-13-inside-6_4940_405685" fill="white">
                        <path d="M480 0H576V96H480V0Z" />
                    </mask>
                    <path d="M576 96V97H577V96H576ZM575 0V96H577V0H575ZM576 95H480V97H576V95Z" fill="#D0D5DD" mask="url(#path-13-inside-6_4940_405685)" />
                    <mask id="path-15-inside-7_4940_405685" fill="white">
                        <path d="M576 0H672V96H576V0Z" />
                    </mask>
                    <path d="M672 96V97H673V96H672ZM671 0V96H673V0H671ZM672 95H576V97H672V95Z" fill="#D0D5DD" mask="url(#path-15-inside-7_4940_405685)" />
                    <mask id="path-17-inside-8_4940_405685" fill="white">
                        <path d="M672 0H768V96H672V0Z" />
                    </mask>
                    <path d="M768 96V97H769V96H768ZM767 0V96H769V0H767ZM768 95H672V97H768V95Z" fill="#D0D5DD" mask="url(#path-17-inside-8_4940_405685)" />
                    <mask id="path-19-inside-9_4940_405685" fill="white">
                        <path d="M768 0H864V96H768V0Z" />
                    </mask>
                    <path d="M864 96V97H865V96H864ZM863 0V96H865V0H863ZM864 95H768V97H864V95Z" fill="#D0D5DD" mask="url(#path-19-inside-9_4940_405685)" />
                    <mask id="path-21-inside-10_4940_405685" fill="white">
                        <path d="M864 0H960V96H864V0Z" />
                    </mask>
                    <path d="M960 96V97H961V96H960ZM959 0V96H961V0H959ZM960 95H864V97H960V95Z" fill="#D0D5DD" mask="url(#path-21-inside-10_4940_405685)" />
                    <mask id="path-23-inside-11_4940_405685" fill="white">
                        <path d="M0 96H96V192H0V96Z" />
                    </mask>
                    <path d="M96 192V193H97V192H96ZM95 96V192H97V96H95ZM96 191H0V193H96V191Z" fill="#D0D5DD" mask="url(#path-23-inside-11_4940_405685)" />
                    <mask id="path-25-inside-12_4940_405685" fill="white">
                        <path d="M96 96H192V192H96V96Z" />
                    </mask>
                    <path
                        d="M192 192V193H193V192H192ZM191 96V192H193V96H191ZM192 191H96V193H192V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-25-inside-12_4940_405685)"
                    />
                    <mask id="path-27-inside-13_4940_405685" fill="white">
                        <path d="M192 96H288V192H192V96Z" />
                    </mask>
                    <path d="M192 96H288V192H192V96Z" fill="#F2F4F7" />
                    <path
                        d="M288 192V193H289V192H288ZM287 96V192H289V96H287ZM288 191H192V193H288V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-27-inside-13_4940_405685)"
                    />
                    <mask id="path-29-inside-14_4940_405685" fill="white">
                        <path d="M288 96H384V192H288V96Z" />
                    </mask>
                    <path
                        d="M384 192V193H385V192H384ZM383 96V192H385V96H383ZM384 191H288V193H384V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-29-inside-14_4940_405685)"
                    />
                    <mask id="path-31-inside-15_4940_405685" fill="white">
                        <path d="M384 96H480V192H384V96Z" />
                    </mask>
                    <path
                        d="M480 192V193H481V192H480ZM479 96V192H481V96H479ZM480 191H384V193H480V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-31-inside-15_4940_405685)"
                    />
                    <mask id="path-33-inside-16_4940_405685" fill="white">
                        <path d="M480 96H576V192H480V96Z" />
                    </mask>
                    <path
                        d="M576 192V193H577V192H576ZM575 96V192H577V96H575ZM576 191H480V193H576V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-33-inside-16_4940_405685)"
                    />
                    <mask id="path-35-inside-17_4940_405685" fill="white">
                        <path d="M576 96H672V192H576V96Z" />
                    </mask>
                    <path
                        d="M672 192V193H673V192H672ZM671 96V192H673V96H671ZM672 191H576V193H672V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-35-inside-17_4940_405685)"
                    />
                    <mask id="path-37-inside-18_4940_405685" fill="white">
                        <path d="M672 96H768V192H672V96Z" />
                    </mask>
                    <path
                        d="M768 192V193H769V192H768ZM767 96V192H769V96H767ZM768 191H672V193H768V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-37-inside-18_4940_405685)"
                    />
                    <mask id="path-39-inside-19_4940_405685" fill="white">
                        <path d="M768 96H864V192H768V96Z" />
                    </mask>
                    <path d="M768 96H864V192H768V96Z" fill="#F2F4F7" />
                    <path
                        d="M864 192V193H865V192H864ZM863 96V192H865V96H863ZM864 191H768V193H864V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-39-inside-19_4940_405685)"
                    />
                    <mask id="path-41-inside-20_4940_405685" fill="white">
                        <path d="M864 96H960V192H864V96Z" />
                    </mask>
                    <path
                        d="M960 192V193H961V192H960ZM959 96V192H961V96H959ZM960 191H864V193H960V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-41-inside-20_4940_405685)"
                    />
                    <mask id="path-43-inside-21_4940_405685" fill="white">
                        <path d="M0 192H96V288H0V192Z" />
                    </mask>
                    <path d="M0 192H96V288H0V192Z" fill="#F2F4F7" />
                    <path d="M96 288V289H97V288H96ZM95 192V288H97V192H95ZM96 287H0V289H96V287Z" fill="#D0D5DD" mask="url(#path-43-inside-21_4940_405685)" />
                    <mask id="path-45-inside-22_4940_405685" fill="white">
                        <path d="M96 192H192V288H96V192Z" />
                    </mask>
                    <path
                        d="M192 288V289H193V288H192ZM191 192V288H193V192H191ZM192 287H96V289H192V287Z"
                        fill="#D0D5DD"
                        mask="url(#path-45-inside-22_4940_405685)"
                    />
                    <mask id="path-47-inside-23_4940_405685" fill="white">
                        <path d="M192 192H288V288H192V192Z" />
                    </mask>
                    <path
                        d="M288 288V289H289V288H288ZM287 192V288H289V192H287ZM288 287H192V289H288V287Z"
                        fill="#D0D5DD"
                        mask="url(#path-47-inside-23_4940_405685)"
                    />
                    <mask id="path-49-inside-24_4940_405685" fill="white">
                        <path d="M288 192H384V288H288V192Z" />
                    </mask>
                    <path
                        d="M384 288V289H385V288H384ZM383 192V288H385V192H383ZM384 287H288V289H384V287Z"
                        fill="#D0D5DD"
                        mask="url(#path-49-inside-24_4940_405685)"
                    />
                    <mask id="path-51-inside-25_4940_405685" fill="white">
                        <path d="M384 192H480V288H384V192Z" />
                    </mask>
                    <path
                        d="M480 288V289H481V288H480ZM479 192V288H481V192H479ZM480 287H384V289H480V287Z"
                        fill="#D0D5DD"
                        mask="url(#path-51-inside-25_4940_405685)"
                    />
                    <mask id="path-53-inside-26_4940_405685" fill="white">
                        <path d="M480 192H576V288H480V192Z" />
                    </mask>
                    <path
                        d="M576 288V289H577V288H576ZM575 192V288H577V192H575ZM576 287H480V289H576V287Z"
                        fill="#D0D5DD"
                        mask="url(#path-53-inside-26_4940_405685)"
                    />
                    <mask id="path-55-inside-27_4940_405685" fill="white">
                        <path d="M576 192H672V288H576V192Z" />
                    </mask>
                    <path d="M576 192H672V288H576V192Z" fill="#F2F4F7" />
                    <path
                        d="M672 288V289H673V288H672ZM671 192V288H673V192H671ZM672 287H576V289H672V287Z"
                        fill="#D0D5DD"
                        mask="url(#path-55-inside-27_4940_405685)"
                    />
                    <mask id="path-57-inside-28_4940_405685" fill="white">
                        <path d="M672 192H768V288H672V192Z" />
                    </mask>
                    <path
                        d="M768 288V289H769V288H768ZM767 192V288H769V192H767ZM768 287H672V289H768V287Z"
                        fill="#D0D5DD"
                        mask="url(#path-57-inside-28_4940_405685)"
                    />
                    <mask id="path-59-inside-29_4940_405685" fill="white">
                        <path d="M768 192H864V288H768V192Z" />
                    </mask>
                    <path
                        d="M864 288V289H865V288H864ZM863 192V288H865V192H863ZM864 287H768V289H864V287Z"
                        fill="#D0D5DD"
                        mask="url(#path-59-inside-29_4940_405685)"
                    />
                    <mask id="path-61-inside-30_4940_405685" fill="white">
                        <path d="M864 192H960V288H864V192Z" />
                    </mask>
                    <path
                        d="M960 288V289H961V288H960ZM959 192V288H961V192H959ZM960 287H864V289H960V287Z"
                        fill="#D0D5DD"
                        mask="url(#path-61-inside-30_4940_405685)"
                    />
                    <mask id="path-63-inside-31_4940_405685" fill="white">
                        <path d="M0 288H96V384H0V288Z" />
                    </mask>
                    <path d="M96 384V385H97V384H96ZM95 288V384H97V288H95ZM96 383H0V385H96V383Z" fill="#D0D5DD" mask="url(#path-63-inside-31_4940_405685)" />
                    <mask id="path-65-inside-32_4940_405685" fill="white">
                        <path d="M96 288H192V384H96V288Z" />
                    </mask>
                    <path
                        d="M192 384V385H193V384H192ZM191 288V384H193V288H191ZM192 383H96V385H192V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-65-inside-32_4940_405685)"
                    />
                    <mask id="path-67-inside-33_4940_405685" fill="white">
                        <path d="M192 288H288V384H192V288Z" />
                    </mask>
                    <path
                        d="M288 384V385H289V384H288ZM287 288V384H289V288H287ZM288 383H192V385H288V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-67-inside-33_4940_405685)"
                    />
                    <mask id="path-69-inside-34_4940_405685" fill="white">
                        <path d="M288 288H384V384H288V288Z" />
                    </mask>
                    <path
                        d="M384 384V385H385V384H384ZM383 288V384H385V288H383ZM384 383H288V385H384V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-69-inside-34_4940_405685)"
                    />
                    <mask id="path-71-inside-35_4940_405685" fill="white">
                        <path d="M384 288H480V384H384V288Z" />
                    </mask>
                    <path
                        d="M480 384V385H481V384H480ZM479 288V384H481V288H479ZM480 383H384V385H480V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-71-inside-35_4940_405685)"
                    />
                    <mask id="path-73-inside-36_4940_405685" fill="white">
                        <path d="M480 288H576V384H480V288Z" />
                    </mask>
                    <path
                        d="M576 384V385H577V384H576ZM575 288V384H577V288H575ZM576 383H480V385H576V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-73-inside-36_4940_405685)"
                    />
                    <mask id="path-75-inside-37_4940_405685" fill="white">
                        <path d="M576 288H672V384H576V288Z" />
                    </mask>
                    <path
                        d="M672 384V385H673V384H672ZM671 288V384H673V288H671ZM672 383H576V385H672V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-75-inside-37_4940_405685)"
                    />
                    <mask id="path-77-inside-38_4940_405685" fill="white">
                        <path d="M672 288H768V384H672V288Z" />
                    </mask>
                    <path
                        d="M768 384V385H769V384H768ZM767 288V384H769V288H767ZM768 383H672V385H768V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-77-inside-38_4940_405685)"
                    />
                    <mask id="path-79-inside-39_4940_405685" fill="white">
                        <path d="M768 288H864V384H768V288Z" />
                    </mask>
                    <path
                        d="M864 384V385H865V384H864ZM863 288V384H865V288H863ZM864 383H768V385H864V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-79-inside-39_4940_405685)"
                    />
                    <mask id="path-81-inside-40_4940_405685" fill="white">
                        <path d="M864 288H960V384H864V288Z" />
                    </mask>
                    <path d="M864 288H960V384H864V288Z" fill="#F2F4F7" />
                    <path
                        d="M960 384V385H961V384H960ZM959 288V384H961V288H959ZM960 383H864V385H960V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-81-inside-40_4940_405685)"
                    />
                    <mask id="path-83-inside-41_4940_405685" fill="white">
                        <path d="M0 384H96V480H0V384Z" />
                    </mask>
                    <path d="M96 480V481H97V480H96ZM95 384V480H97V384H95ZM96 479H0V481H96V479Z" fill="#D0D5DD" mask="url(#path-83-inside-41_4940_405685)" />
                    <mask id="path-85-inside-42_4940_405685" fill="white">
                        <path d="M96 384H192V480H96V384Z" />
                    </mask>
                    <path
                        d="M192 480V481H193V480H192ZM191 384V480H193V384H191ZM192 479H96V481H192V479Z"
                        fill="#D0D5DD"
                        mask="url(#path-85-inside-42_4940_405685)"
                    />
                    <mask id="path-87-inside-43_4940_405685" fill="white">
                        <path d="M192 384H288V480H192V384Z" />
                    </mask>
                    <path
                        d="M288 480V481H289V480H288ZM287 384V480H289V384H287ZM288 479H192V481H288V479Z"
                        fill="#D0D5DD"
                        mask="url(#path-87-inside-43_4940_405685)"
                    />
                    <mask id="path-89-inside-44_4940_405685" fill="white">
                        <path d="M288 384H384V480H288V384Z" />
                    </mask>
                    <path d="M288 384H384V480H288V384Z" fill="#F2F4F7" />
                    <path
                        d="M384 480V481H385V480H384ZM383 384V480H385V384H383ZM384 479H288V481H384V479Z"
                        fill="#D0D5DD"
                        mask="url(#path-89-inside-44_4940_405685)"
                    />
                    <mask id="path-91-inside-45_4940_405685" fill="white">
                        <path d="M384 384H480V480H384V384Z" />
                    </mask>
                    <path
                        d="M480 480V481H481V480H480ZM479 384V480H481V384H479ZM480 479H384V481H480V479Z"
                        fill="#D0D5DD"
                        mask="url(#path-91-inside-45_4940_405685)"
                    />
                    <mask id="path-93-inside-46_4940_405685" fill="white">
                        <path d="M480 384H576V480H480V384Z" />
                    </mask>
                    <path
                        d="M576 480V481H577V480H576ZM575 384V480H577V384H575ZM576 479H480V481H576V479Z"
                        fill="#D0D5DD"
                        mask="url(#path-93-inside-46_4940_405685)"
                    />
                    <mask id="path-95-inside-47_4940_405685" fill="white">
                        <path d="M576 384H672V480H576V384Z" />
                    </mask>
                    <path
                        d="M672 480V481H673V480H672ZM671 384V480H673V384H671ZM672 479H576V481H672V479Z"
                        fill="#D0D5DD"
                        mask="url(#path-95-inside-47_4940_405685)"
                    />
                    <mask id="path-97-inside-48_4940_405685" fill="white">
                        <path d="M672 384H768V480H672V384Z" />
                    </mask>
                    <path
                        d="M768 480V481H769V480H768ZM767 384V480H769V384H767ZM768 479H672V481H768V479Z"
                        fill="#D0D5DD"
                        mask="url(#path-97-inside-48_4940_405685)"
                    />
                    <mask id="path-99-inside-49_4940_405685" fill="white">
                        <path d="M768 384H864V480H768V384Z" />
                    </mask>
                    <path
                        d="M864 480V481H865V480H864ZM863 384V480H865V384H863ZM864 479H768V481H864V479Z"
                        fill="#D0D5DD"
                        mask="url(#path-99-inside-49_4940_405685)"
                    />
                    <mask id="path-101-inside-50_4940_405685" fill="white">
                        <path d="M864 384H960V480H864V384Z" />
                    </mask>
                    <path
                        d="M960 480V481H961V480H960ZM959 384V480H961V384H959ZM960 479H864V481H960V479Z"
                        fill="#D0D5DD"
                        mask="url(#path-101-inside-50_4940_405685)"
                    />
                    <mask id="path-103-inside-51_4940_405685" fill="white">
                        <path d="M0 480H96V576H0V480Z" />
                    </mask>
                    <path d="M0 480H96V576H0V480Z" fill="#F2F4F7" />
                    <path d="M96 576V577H97V576H96ZM95 480V576H97V480H95ZM96 575H0V577H96V575Z" fill="#D0D5DD" mask="url(#path-103-inside-51_4940_405685)" />
                    <mask id="path-105-inside-52_4940_405685" fill="white">
                        <path d="M96 480H192V576H96V480Z" />
                    </mask>
                    <path
                        d="M192 576V577H193V576H192ZM191 480V576H193V480H191ZM192 575H96V577H192V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-105-inside-52_4940_405685)"
                    />
                    <mask id="path-107-inside-53_4940_405685" fill="white">
                        <path d="M192 480H288V576H192V480Z" />
                    </mask>
                    <path
                        d="M288 576V577H289V576H288ZM287 480V576H289V480H287ZM288 575H192V577H288V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-107-inside-53_4940_405685)"
                    />
                    <mask id="path-109-inside-54_4940_405685" fill="white">
                        <path d="M288 480H384V576H288V480Z" />
                    </mask>
                    <path
                        d="M384 576V577H385V576H384ZM383 480V576H385V480H383ZM384 575H288V577H384V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-109-inside-54_4940_405685)"
                    />
                    <mask id="path-111-inside-55_4940_405685" fill="white">
                        <path d="M384 480H480V576H384V480Z" />
                    </mask>
                    <path
                        d="M480 576V577H481V576H480ZM479 480V576H481V480H479ZM480 575H384V577H480V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-111-inside-55_4940_405685)"
                    />
                    <mask id="path-113-inside-56_4940_405685" fill="white">
                        <path d="M480 480H576V576H480V480Z" />
                    </mask>
                    <path
                        d="M576 576V577H577V576H576ZM575 480V576H577V480H575ZM576 575H480V577H576V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-113-inside-56_4940_405685)"
                    />
                    <mask id="path-115-inside-57_4940_405685" fill="white">
                        <path d="M576 480H672V576H576V480Z" />
                    </mask>
                    <path d="M576 480H672V576H576V480Z" fill="#F2F4F7" />
                    <path
                        d="M672 576V577H673V576H672ZM671 480V576H673V480H671ZM672 575H576V577H672V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-115-inside-57_4940_405685)"
                    />
                    <mask id="path-117-inside-58_4940_405685" fill="white">
                        <path d="M672 480H768V576H672V480Z" />
                    </mask>
                    <path
                        d="M768 576V577H769V576H768ZM767 480V576H769V480H767ZM768 575H672V577H768V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-117-inside-58_4940_405685)"
                    />
                    <mask id="path-119-inside-59_4940_405685" fill="white">
                        <path d="M768 480H864V576H768V480Z" />
                    </mask>
                    <path
                        d="M864 576V577H865V576H864ZM863 480V576H865V480H863ZM864 575H768V577H864V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-119-inside-59_4940_405685)"
                    />
                    <mask id="path-121-inside-60_4940_405685" fill="white">
                        <path d="M864 480H960V576H864V480Z" />
                    </mask>
                    <path
                        d="M960 576V577H961V576H960ZM959 480V576H961V480H959ZM960 575H864V577H960V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-121-inside-60_4940_405685)"
                    />
                    <mask id="path-123-inside-61_4940_405685" fill="white">
                        <path d="M0 576H96V672H0V576Z" />
                    </mask>
                    <path d="M96 672V673H97V672H96ZM95 576V672H97V576H95ZM96 671H0V673H96V671Z" fill="#D0D5DD" mask="url(#path-123-inside-61_4940_405685)" />
                    <mask id="path-125-inside-62_4940_405685" fill="white">
                        <path d="M96 576H192V672H96V576Z" />
                    </mask>
                    <path
                        d="M192 672V673H193V672H192ZM191 576V672H193V576H191ZM192 671H96V673H192V671Z"
                        fill="#D0D5DD"
                        mask="url(#path-125-inside-62_4940_405685)"
                    />
                    <mask id="path-127-inside-63_4940_405685" fill="white">
                        <path d="M192 576H288V672H192V576Z" />
                    </mask>
                    <path
                        d="M288 672V673H289V672H288ZM287 576V672H289V576H287ZM288 671H192V673H288V671Z"
                        fill="#D0D5DD"
                        mask="url(#path-127-inside-63_4940_405685)"
                    />
                    <mask id="path-129-inside-64_4940_405685" fill="white">
                        <path d="M288 576H384V672H288V576Z" />
                    </mask>
                    <path
                        d="M384 672V673H385V672H384ZM383 576V672H385V576H383ZM384 671H288V673H384V671Z"
                        fill="#D0D5DD"
                        mask="url(#path-129-inside-64_4940_405685)"
                    />
                    <mask id="path-131-inside-65_4940_405685" fill="white">
                        <path d="M384 576H480V672H384V576Z" />
                    </mask>
                    <path
                        d="M480 672V673H481V672H480ZM479 576V672H481V576H479ZM480 671H384V673H480V671Z"
                        fill="#D0D5DD"
                        mask="url(#path-131-inside-65_4940_405685)"
                    />
                    <mask id="path-133-inside-66_4940_405685" fill="white">
                        <path d="M480 576H576V672H480V576Z" />
                    </mask>
                    <path
                        d="M576 672V673H577V672H576ZM575 576V672H577V576H575ZM576 671H480V673H576V671Z"
                        fill="#D0D5DD"
                        mask="url(#path-133-inside-66_4940_405685)"
                    />
                    <mask id="path-135-inside-67_4940_405685" fill="white">
                        <path d="M576 576H672V672H576V576Z" />
                    </mask>
                    <path
                        d="M672 672V673H673V672H672ZM671 576V672H673V576H671ZM672 671H576V673H672V671Z"
                        fill="#D0D5DD"
                        mask="url(#path-135-inside-67_4940_405685)"
                    />
                    <mask id="path-137-inside-68_4940_405685" fill="white">
                        <path d="M672 576H768V672H672V576Z" />
                    </mask>
                    <path
                        d="M768 672V673H769V672H768ZM767 576V672H769V576H767ZM768 671H672V673H768V671Z"
                        fill="#D0D5DD"
                        mask="url(#path-137-inside-68_4940_405685)"
                    />
                    <mask id="path-139-inside-69_4940_405685" fill="white">
                        <path d="M768 576H864V672H768V576Z" />
                    </mask>
                    <path
                        d="M864 672V673H865V672H864ZM863 576V672H865V576H863ZM864 671H768V673H864V671Z"
                        fill="#D0D5DD"
                        mask="url(#path-139-inside-69_4940_405685)"
                    />
                    <mask id="path-141-inside-70_4940_405685" fill="white">
                        <path d="M864 576H960V672H864V576Z" />
                    </mask>
                    <path
                        d="M960 672V673H961V672H960ZM959 576V672H961V576H959ZM960 671H864V673H960V671Z"
                        fill="#D0D5DD"
                        mask="url(#path-141-inside-70_4940_405685)"
                    />
                    <mask id="path-143-inside-71_4940_405685" fill="white">
                        <path d="M0 672H96V768H0V672Z" />
                    </mask>
                    <path d="M96 768V769H97V768H96ZM95 672V768H97V672H95ZM96 767H0V769H96V767Z" fill="#D0D5DD" mask="url(#path-143-inside-71_4940_405685)" />
                    <mask id="path-145-inside-72_4940_405685" fill="white">
                        <path d="M96 672H192V768H96V672Z" />
                    </mask>
                    <path
                        d="M192 768V769H193V768H192ZM191 672V768H193V672H191ZM192 767H96V769H192V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-145-inside-72_4940_405685)"
                    />
                    <mask id="path-147-inside-73_4940_405685" fill="white">
                        <path d="M192 672H288V768H192V672Z" />
                    </mask>
                    <path
                        d="M288 768V769H289V768H288ZM287 672V768H289V672H287ZM288 767H192V769H288V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-147-inside-73_4940_405685)"
                    />
                    <mask id="path-149-inside-74_4940_405685" fill="white">
                        <path d="M288 672H384V768H288V672Z" />
                    </mask>
                    <path d="M288 672H384V768H288V672Z" fill="#F2F4F7" />
                    <path
                        d="M384 768V769H385V768H384ZM383 672V768H385V672H383ZM384 767H288V769H384V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-149-inside-74_4940_405685)"
                    />
                    <mask id="path-151-inside-75_4940_405685" fill="white">
                        <path d="M384 672H480V768H384V672Z" />
                    </mask>
                    <path
                        d="M480 768V769H481V768H480ZM479 672V768H481V672H479ZM480 767H384V769H480V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-151-inside-75_4940_405685)"
                    />
                    <mask id="path-153-inside-76_4940_405685" fill="white">
                        <path d="M480 672H576V768H480V672Z" />
                    </mask>
                    <path
                        d="M576 768V769H577V768H576ZM575 672V768H577V672H575ZM576 767H480V769H576V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-153-inside-76_4940_405685)"
                    />
                    <mask id="path-155-inside-77_4940_405685" fill="white">
                        <path d="M576 672H672V768H576V672Z" />
                    </mask>
                    <path
                        d="M672 768V769H673V768H672ZM671 672V768H673V672H671ZM672 767H576V769H672V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-155-inside-77_4940_405685)"
                    />
                    <mask id="path-157-inside-78_4940_405685" fill="white">
                        <path d="M672 672H768V768H672V672Z" />
                    </mask>
                    <path
                        d="M768 768V769H769V768H768ZM767 672V768H769V672H767ZM768 767H672V769H768V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-157-inside-78_4940_405685)"
                    />
                    <mask id="path-159-inside-79_4940_405685" fill="white">
                        <path d="M768 672H864V768H768V672Z" />
                    </mask>
                    <path
                        d="M864 768V769H865V768H864ZM863 672V768H865V672H863ZM864 767H768V769H864V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-159-inside-79_4940_405685)"
                    />
                    <mask id="path-161-inside-80_4940_405685" fill="white">
                        <path d="M864 672H960V768H864V672Z" />
                    </mask>
                    <path d="M864 672H960V768H864V672Z" fill="#F2F4F7" />
                    <path
                        d="M960 768V769H961V768H960ZM959 672V768H961V672H959ZM960 767H864V769H960V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-161-inside-80_4940_405685)"
                    />
                    <mask id="path-163-inside-81_4940_405685" fill="white">
                        <path d="M0 768H96V864H0V768Z" />
                    </mask>
                    <path d="M0 768H96V864H0V768Z" fill="#F2F4F7" />
                    <path d="M96 864V865H97V864H96ZM95 768V864H97V768H95ZM96 863H0V865H96V863Z" fill="#D0D5DD" mask="url(#path-163-inside-81_4940_405685)" />
                    <mask id="path-165-inside-82_4940_405685" fill="white">
                        <path d="M96 768H192V864H96V768Z" />
                    </mask>
                    <path
                        d="M192 864V865H193V864H192ZM191 768V864H193V768H191ZM192 863H96V865H192V863Z"
                        fill="#D0D5DD"
                        mask="url(#path-165-inside-82_4940_405685)"
                    />
                    <mask id="path-167-inside-83_4940_405685" fill="white">
                        <path d="M192 768H288V864H192V768Z" />
                    </mask>
                    <path
                        d="M288 864V865H289V864H288ZM287 768V864H289V768H287ZM288 863H192V865H288V863Z"
                        fill="#D0D5DD"
                        mask="url(#path-167-inside-83_4940_405685)"
                    />
                    <mask id="path-169-inside-84_4940_405685" fill="white">
                        <path d="M288 768H384V864H288V768Z" />
                    </mask>
                    <path
                        d="M384 864V865H385V864H384ZM383 768V864H385V768H383ZM384 863H288V865H384V863Z"
                        fill="#D0D5DD"
                        mask="url(#path-169-inside-84_4940_405685)"
                    />
                    <mask id="path-171-inside-85_4940_405685" fill="white">
                        <path d="M384 768H480V864H384V768Z" />
                    </mask>
                    <path
                        d="M480 864V865H481V864H480ZM479 768V864H481V768H479ZM480 863H384V865H480V863Z"
                        fill="#D0D5DD"
                        mask="url(#path-171-inside-85_4940_405685)"
                    />
                    <mask id="path-173-inside-86_4940_405685" fill="white">
                        <path d="M480 768H576V864H480V768Z" />
                    </mask>
                    <path
                        d="M576 864V865H577V864H576ZM575 768V864H577V768H575ZM576 863H480V865H576V863Z"
                        fill="#D0D5DD"
                        mask="url(#path-173-inside-86_4940_405685)"
                    />
                    <mask id="path-175-inside-87_4940_405685" fill="white">
                        <path d="M576 768H672V864H576V768Z" />
                    </mask>
                    <path d="M576 768H672V864H576V768Z" fill="#F2F4F7" />
                    <path
                        d="M672 864V865H673V864H672ZM671 768V864H673V768H671ZM672 863H576V865H672V863Z"
                        fill="#D0D5DD"
                        mask="url(#path-175-inside-87_4940_405685)"
                    />
                    <mask id="path-177-inside-88_4940_405685" fill="white">
                        <path d="M672 768H768V864H672V768Z" />
                    </mask>
                    <path
                        d="M768 864V865H769V864H768ZM767 768V864H769V768H767ZM768 863H672V865H768V863Z"
                        fill="#D0D5DD"
                        mask="url(#path-177-inside-88_4940_405685)"
                    />
                    <mask id="path-179-inside-89_4940_405685" fill="white">
                        <path d="M768 768H864V864H768V768Z" />
                    </mask>
                    <path
                        d="M864 864V865H865V864H864ZM863 768V864H865V768H863ZM864 863H768V865H864V863Z"
                        fill="#D0D5DD"
                        mask="url(#path-179-inside-89_4940_405685)"
                    />
                    <mask id="path-181-inside-90_4940_405685" fill="white">
                        <path d="M864 768H960V864H864V768Z" />
                    </mask>
                    <path
                        d="M960 864V865H961V864H960ZM959 768V864H961V768H959ZM960 863H864V865H960V863Z"
                        fill="#D0D5DD"
                        mask="url(#path-181-inside-90_4940_405685)"
                    />
                    <mask id="path-183-inside-91_4940_405685" fill="white">
                        <path d="M0 864H96V960H0V864Z" />
                    </mask>
                    <path d="M96 960V961H97V960H96ZM95 864V960H97V864H95ZM96 959H0V961H96V959Z" fill="#D0D5DD" mask="url(#path-183-inside-91_4940_405685)" />
                    <mask id="path-185-inside-92_4940_405685" fill="white">
                        <path d="M96 864H192V960H96V864Z" />
                    </mask>
                    <path
                        d="M192 960V961H193V960H192ZM191 864V960H193V864H191ZM192 959H96V961H192V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-185-inside-92_4940_405685)"
                    />
                    <mask id="path-187-inside-93_4940_405685" fill="white">
                        <path d="M192 864H288V960H192V864Z" />
                    </mask>
                    <path
                        d="M288 960V961H289V960H288ZM287 864V960H289V864H287ZM288 959H192V961H288V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-187-inside-93_4940_405685)"
                    />
                    <mask id="path-189-inside-94_4940_405685" fill="white">
                        <path d="M288 864H384V960H288V864Z" />
                    </mask>
                    <path
                        d="M384 960V961H385V960H384ZM383 864V960H385V864H383ZM384 959H288V961H384V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-189-inside-94_4940_405685)"
                    />
                    <mask id="path-191-inside-95_4940_405685" fill="white">
                        <path d="M384 864H480V960H384V864Z" />
                    </mask>
                    <path
                        d="M480 960V961H481V960H480ZM479 864V960H481V864H479ZM480 959H384V961H480V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-191-inside-95_4940_405685)"
                    />
                    <mask id="path-193-inside-96_4940_405685" fill="white">
                        <path d="M480 864H576V960H480V864Z" />
                    </mask>
                    <path
                        d="M576 960V961H577V960H576ZM575 864V960H577V864H575ZM576 959H480V961H576V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-193-inside-96_4940_405685)"
                    />
                    <mask id="path-195-inside-97_4940_405685" fill="white">
                        <path d="M576 864H672V960H576V864Z" />
                    </mask>
                    <path
                        d="M672 960V961H673V960H672ZM671 864V960H673V864H671ZM672 959H576V961H672V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-195-inside-97_4940_405685)"
                    />
                    <mask id="path-197-inside-98_4940_405685" fill="white">
                        <path d="M672 864H768V960H672V864Z" />
                    </mask>
                    <path
                        d="M768 960V961H769V960H768ZM767 864V960H769V864H767ZM768 959H672V961H768V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-197-inside-98_4940_405685)"
                    />
                    <mask id="path-199-inside-99_4940_405685" fill="white">
                        <path d="M768 864H864V960H768V864Z" />
                    </mask>
                    <path
                        d="M864 960V961H865V960H864ZM863 864V960H865V864H863ZM864 959H768V961H864V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-199-inside-99_4940_405685)"
                    />
                    <mask id="path-201-inside-100_4940_405685" fill="white">
                        <path d="M864 864H960V960H864V864Z" />
                    </mask>
                    <path
                        d="M960 960V961H961V960H960ZM959 864V960H961V864H959ZM960 959H864V961H960V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-201-inside-100_4940_405685)"
                    />
                </g>
                <rect x="0.5" y="0.5" width="959" height="959" stroke="#D0D5DD" />
            </g>
            <defs>
                <radialGradient
                    id="paint0_radial_4940_405685"
                    cx="0"
                    cy="0"
                    r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(480 -0.000114441) rotate(90) scale(960 501.059)"
                >
                    <stop />
                    <stop offset="0.953125" stopOpacity="0" />
                </radialGradient>
                <clipPath id="clip0_4940_405685">
                    <rect width="960" height="960" fill="white" />
                </clipPath>
            </defs>
        </svg>
    );
};

const sm = (props: SVGProps<SVGSVGElement>) => {
    return (
        <svg width="960" height="960" viewBox="0 0 960 960" fill="none" {...props}>
            <mask id="mask0_4940_405682" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="960" height="960">
                <rect width="960" height="960" fill="url(#paint0_radial_4940_405682)" />
            </mask>
            <g mask="url(#mask0_4940_405682)">
                <g clipPath="url(#clip0_4940_405682)">
                    <mask id="path-3-inside-1_4940_405682" fill="white">
                        <path d="M0 0H64V64H0V0Z" />
                    </mask>
                    <path d="M64 64V65H65V64H64ZM63 0V64H65V0H63ZM64 63H0V65H64V63Z" fill="#D0D5DD" mask="url(#path-3-inside-1_4940_405682)" />
                    <mask id="path-5-inside-2_4940_405682" fill="white">
                        <path d="M64 0H128V64H64V0Z" />
                    </mask>
                    <path d="M128 64V65H129V64H128ZM127 0V64H129V0H127ZM128 63H64V65H128V63Z" fill="#D0D5DD" mask="url(#path-5-inside-2_4940_405682)" />
                    <mask id="path-7-inside-3_4940_405682" fill="white">
                        <path d="M128 0H192V64H128V0Z" />
                    </mask>
                    <path d="M192 64V65H193V64H192ZM191 0V64H193V0H191ZM192 63H128V65H192V63Z" fill="#D0D5DD" mask="url(#path-7-inside-3_4940_405682)" />
                    <mask id="path-9-inside-4_4940_405682" fill="white">
                        <path d="M192 0H256V64H192V0Z" />
                    </mask>
                    <path d="M256 64V65H257V64H256ZM255 0V64H257V0H255ZM256 63H192V65H256V63Z" fill="#D0D5DD" mask="url(#path-9-inside-4_4940_405682)" />
                    <mask id="path-11-inside-5_4940_405682" fill="white">
                        <path d="M256 0H320V64H256V0Z" />
                    </mask>
                    <path d="M320 64V65H321V64H320ZM319 0V64H321V0H319ZM320 63H256V65H320V63Z" fill="#D0D5DD" mask="url(#path-11-inside-5_4940_405682)" />
                    <mask id="path-13-inside-6_4940_405682" fill="white">
                        <path d="M320 0H384V64H320V0Z" />
                    </mask>
                    <path d="M384 64V65H385V64H384ZM383 0V64H385V0H383ZM384 63H320V65H384V63Z" fill="#D0D5DD" mask="url(#path-13-inside-6_4940_405682)" />
                    <mask id="path-15-inside-7_4940_405682" fill="white">
                        <path d="M384 0H448V64H384V0Z" />
                    </mask>
                    <path d="M448 64V65H449V64H448ZM447 0V64H449V0H447ZM448 63H384V65H448V63Z" fill="#D0D5DD" mask="url(#path-15-inside-7_4940_405682)" />
                    <mask id="path-17-inside-8_4940_405682" fill="white">
                        <path d="M448 0H512V64H448V0Z" />
                    </mask>
                    <path d="M512 64V65H513V64H512ZM511 0V64H513V0H511ZM512 63H448V65H512V63Z" fill="#D0D5DD" mask="url(#path-17-inside-8_4940_405682)" />
                    <mask id="path-19-inside-9_4940_405682" fill="white">
                        <path d="M512 0H576V64H512V0Z" />
                    </mask>
                    <path d="M576 64V65H577V64H576ZM575 0V64H577V0H575ZM576 63H512V65H576V63Z" fill="#D0D5DD" mask="url(#path-19-inside-9_4940_405682)" />
                    <mask id="path-21-inside-10_4940_405682" fill="white">
                        <path d="M576 0H640V64H576V0Z" />
                    </mask>
                    <path d="M640 64V65H641V64H640ZM639 0V64H641V0H639ZM640 63H576V65H640V63Z" fill="#D0D5DD" mask="url(#path-21-inside-10_4940_405682)" />
                    <mask id="path-23-inside-11_4940_405682" fill="white">
                        <path d="M640 0H704V64H640V0Z" />
                    </mask>
                    <path d="M704 64V65H705V64H704ZM703 0V64H705V0H703ZM704 63H640V65H704V63Z" fill="#D0D5DD" mask="url(#path-23-inside-11_4940_405682)" />
                    <mask id="path-25-inside-12_4940_405682" fill="white">
                        <path d="M704 0H768V64H704V0Z" />
                    </mask>
                    <path d="M768 64V65H769V64H768ZM767 0V64H769V0H767ZM768 63H704V65H768V63Z" fill="#D0D5DD" mask="url(#path-25-inside-12_4940_405682)" />
                    <mask id="path-27-inside-13_4940_405682" fill="white">
                        <path d="M768 0H832V64H768V0Z" />
                    </mask>
                    <path d="M832 64V65H833V64H832ZM831 0V64H833V0H831ZM832 63H768V65H832V63Z" fill="#D0D5DD" mask="url(#path-27-inside-13_4940_405682)" />
                    <mask id="path-29-inside-14_4940_405682" fill="white">
                        <path d="M832 0H896V64H832V0Z" />
                    </mask>
                    <path d="M896 64V65H897V64H896ZM895 0V64H897V0H895ZM896 63H832V65H896V63Z" fill="#D0D5DD" mask="url(#path-29-inside-14_4940_405682)" />
                    <mask id="path-31-inside-15_4940_405682" fill="white">
                        <path d="M896 0H960V64H896V0Z" />
                    </mask>
                    <path d="M960 64V65H961V64H960ZM959 0V64H961V0H959ZM960 63H896V65H960V63Z" fill="#D0D5DD" mask="url(#path-31-inside-15_4940_405682)" />
                    <mask id="path-33-inside-16_4940_405682" fill="white">
                        <path d="M0 64H64V128H0V64Z" />
                    </mask>
                    <path d="M64 128V129H65V128H64ZM63 64V128H65V64H63ZM64 127H0V129H64V127Z" fill="#D0D5DD" mask="url(#path-33-inside-16_4940_405682)" />
                    <mask id="path-35-inside-17_4940_405682" fill="white">
                        <path d="M64 64H128V128H64V64Z" />
                    </mask>
                    <path
                        d="M128 128V129H129V128H128ZM127 64V128H129V64H127ZM128 127H64V129H128V127Z"
                        fill="#D0D5DD"
                        mask="url(#path-35-inside-17_4940_405682)"
                    />
                    <mask id="path-37-inside-18_4940_405682" fill="white">
                        <path d="M128 64H192V128H128V64Z" />
                    </mask>
                    <path d="M128 64H192V128H128V64Z" fill="#F2F4F7" />
                    <path
                        d="M192 128V129H193V128H192ZM191 64V128H193V64H191ZM192 127H128V129H192V127Z"
                        fill="#D0D5DD"
                        mask="url(#path-37-inside-18_4940_405682)"
                    />
                    <mask id="path-39-inside-19_4940_405682" fill="white">
                        <path d="M192 64H256V128H192V64Z" />
                    </mask>
                    <path
                        d="M256 128V129H257V128H256ZM255 64V128H257V64H255ZM256 127H192V129H256V127Z"
                        fill="#D0D5DD"
                        mask="url(#path-39-inside-19_4940_405682)"
                    />
                    <mask id="path-41-inside-20_4940_405682" fill="white">
                        <path d="M256 64H320V128H256V64Z" />
                    </mask>
                    <path
                        d="M320 128V129H321V128H320ZM319 64V128H321V64H319ZM320 127H256V129H320V127Z"
                        fill="#D0D5DD"
                        mask="url(#path-41-inside-20_4940_405682)"
                    />
                    <mask id="path-43-inside-21_4940_405682" fill="white">
                        <path d="M320 64H384V128H320V64Z" />
                    </mask>
                    <path
                        d="M384 128V129H385V128H384ZM383 64V128H385V64H383ZM384 127H320V129H384V127Z"
                        fill="#D0D5DD"
                        mask="url(#path-43-inside-21_4940_405682)"
                    />
                    <mask id="path-45-inside-22_4940_405682" fill="white">
                        <path d="M384 64H448V128H384V64Z" />
                    </mask>
                    <path
                        d="M448 128V129H449V128H448ZM447 64V128H449V64H447ZM448 127H384V129H448V127Z"
                        fill="#D0D5DD"
                        mask="url(#path-45-inside-22_4940_405682)"
                    />
                    <mask id="path-47-inside-23_4940_405682" fill="white">
                        <path d="M448 64H512V128H448V64Z" />
                    </mask>
                    <path
                        d="M512 128V129H513V128H512ZM511 64V128H513V64H511ZM512 127H448V129H512V127Z"
                        fill="#D0D5DD"
                        mask="url(#path-47-inside-23_4940_405682)"
                    />
                    <mask id="path-49-inside-24_4940_405682" fill="white">
                        <path d="M512 64H576V128H512V64Z" />
                    </mask>
                    <path
                        d="M576 128V129H577V128H576ZM575 64V128H577V64H575ZM576 127H512V129H576V127Z"
                        fill="#D0D5DD"
                        mask="url(#path-49-inside-24_4940_405682)"
                    />
                    <mask id="path-51-inside-25_4940_405682" fill="white">
                        <path d="M576 64H640V128H576V64Z" />
                    </mask>
                    <path
                        d="M640 128V129H641V128H640ZM639 64V128H641V64H639ZM640 127H576V129H640V127Z"
                        fill="#D0D5DD"
                        mask="url(#path-51-inside-25_4940_405682)"
                    />
                    <mask id="path-53-inside-26_4940_405682" fill="white">
                        <path d="M640 64H704V128H640V64Z" />
                    </mask>
                    <path
                        d="M704 128V129H705V128H704ZM703 64V128H705V64H703ZM704 127H640V129H704V127Z"
                        fill="#D0D5DD"
                        mask="url(#path-53-inside-26_4940_405682)"
                    />
                    <mask id="path-55-inside-27_4940_405682" fill="white">
                        <path d="M704 64H768V128H704V64Z" />
                    </mask>
                    <path d="M704 64H768V128H704V64Z" fill="#F2F4F7" />
                    <path
                        d="M768 128V129H769V128H768ZM767 64V128H769V64H767ZM768 127H704V129H768V127Z"
                        fill="#D0D5DD"
                        mask="url(#path-55-inside-27_4940_405682)"
                    />
                    <mask id="path-57-inside-28_4940_405682" fill="white">
                        <path d="M768 64H832V128H768V64Z" />
                    </mask>
                    <path
                        d="M832 128V129H833V128H832ZM831 64V128H833V64H831ZM832 127H768V129H832V127Z"
                        fill="#D0D5DD"
                        mask="url(#path-57-inside-28_4940_405682)"
                    />
                    <mask id="path-59-inside-29_4940_405682" fill="white">
                        <path d="M832 64H896V128H832V64Z" />
                    </mask>
                    <path
                        d="M896 128V129H897V128H896ZM895 64V128H897V64H895ZM896 127H832V129H896V127Z"
                        fill="#D0D5DD"
                        mask="url(#path-59-inside-29_4940_405682)"
                    />
                    <mask id="path-61-inside-30_4940_405682" fill="white">
                        <path d="M896 64H960V128H896V64Z" />
                    </mask>
                    <path
                        d="M960 128V129H961V128H960ZM959 64V128H961V64H959ZM960 127H896V129H960V127Z"
                        fill="#D0D5DD"
                        mask="url(#path-61-inside-30_4940_405682)"
                    />
                    <mask id="path-63-inside-31_4940_405682" fill="white">
                        <path d="M0 128H64V192H0V128Z" />
                    </mask>
                    <path d="M64 192V193H65V192H64ZM63 128V192H65V128H63ZM64 191H0V193H64V191Z" fill="#D0D5DD" mask="url(#path-63-inside-31_4940_405682)" />
                    <mask id="path-65-inside-32_4940_405682" fill="white">
                        <path d="M64 128H128V192H64V128Z" />
                    </mask>
                    <path
                        d="M128 192V193H129V192H128ZM127 128V192H129V128H127ZM128 191H64V193H128V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-65-inside-32_4940_405682)"
                    />
                    <mask id="path-67-inside-33_4940_405682" fill="white">
                        <path d="M128 128H192V192H128V128Z" />
                    </mask>
                    <path
                        d="M192 192V193H193V192H192ZM191 128V192H193V128H191ZM192 191H128V193H192V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-67-inside-33_4940_405682)"
                    />
                    <mask id="path-69-inside-34_4940_405682" fill="white">
                        <path d="M192 128H256V192H192V128Z" />
                    </mask>
                    <path
                        d="M256 192V193H257V192H256ZM255 128V192H257V128H255ZM256 191H192V193H256V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-69-inside-34_4940_405682)"
                    />
                    <mask id="path-71-inside-35_4940_405682" fill="white">
                        <path d="M256 128H320V192H256V128Z" />
                    </mask>
                    <path d="M256 128H320V192H256V128Z" fill="#F2F4F7" />
                    <path
                        d="M320 192V193H321V192H320ZM319 128V192H321V128H319ZM320 191H256V193H320V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-71-inside-35_4940_405682)"
                    />
                    <mask id="path-73-inside-36_4940_405682" fill="white">
                        <path d="M320 128H384V192H320V128Z" />
                    </mask>
                    <path
                        d="M384 192V193H385V192H384ZM383 128V192H385V128H383ZM384 191H320V193H384V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-73-inside-36_4940_405682)"
                    />
                    <mask id="path-75-inside-37_4940_405682" fill="white">
                        <path d="M384 128H448V192H384V128Z" />
                    </mask>
                    <path
                        d="M448 192V193H449V192H448ZM447 128V192H449V128H447ZM448 191H384V193H448V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-75-inside-37_4940_405682)"
                    />
                    <mask id="path-77-inside-38_4940_405682" fill="white">
                        <path d="M448 128H512V192H448V128Z" />
                    </mask>
                    <path
                        d="M512 192V193H513V192H512ZM511 128V192H513V128H511ZM512 191H448V193H512V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-77-inside-38_4940_405682)"
                    />
                    <mask id="path-79-inside-39_4940_405682" fill="white">
                        <path d="M512 128H576V192H512V128Z" />
                    </mask>
                    <path d="M512 128H576V192H512V128Z" fill="#F2F4F7" />
                    <path
                        d="M576 192V193H577V192H576ZM575 128V192H577V128H575ZM576 191H512V193H576V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-79-inside-39_4940_405682)"
                    />
                    <mask id="path-81-inside-40_4940_405682" fill="white">
                        <path d="M576 128H640V192H576V128Z" />
                    </mask>
                    <path
                        d="M640 192V193H641V192H640ZM639 128V192H641V128H639ZM640 191H576V193H640V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-81-inside-40_4940_405682)"
                    />
                    <mask id="path-83-inside-41_4940_405682" fill="white">
                        <path d="M640 128H704V192H640V128Z" />
                    </mask>
                    <path
                        d="M704 192V193H705V192H704ZM703 128V192H705V128H703ZM704 191H640V193H704V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-83-inside-41_4940_405682)"
                    />
                    <mask id="path-85-inside-42_4940_405682" fill="white">
                        <path d="M704 128H768V192H704V128Z" />
                    </mask>
                    <path
                        d="M768 192V193H769V192H768ZM767 128V192H769V128H767ZM768 191H704V193H768V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-85-inside-42_4940_405682)"
                    />
                    <mask id="path-87-inside-43_4940_405682" fill="white">
                        <path d="M768 128H832V192H768V128Z" />
                    </mask>
                    <path
                        d="M832 192V193H833V192H832ZM831 128V192H833V128H831ZM832 191H768V193H832V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-87-inside-43_4940_405682)"
                    />
                    <mask id="path-89-inside-44_4940_405682" fill="white">
                        <path d="M832 128H896V192H832V128Z" />
                    </mask>
                    <path
                        d="M896 192V193H897V192H896ZM895 128V192H897V128H895ZM896 191H832V193H896V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-89-inside-44_4940_405682)"
                    />
                    <mask id="path-91-inside-45_4940_405682" fill="white">
                        <path d="M896 128H960V192H896V128Z" />
                    </mask>
                    <path
                        d="M960 192V193H961V192H960ZM959 128V192H961V128H959ZM960 191H896V193H960V191Z"
                        fill="#D0D5DD"
                        mask="url(#path-91-inside-45_4940_405682)"
                    />
                    <mask id="path-93-inside-46_4940_405682" fill="white">
                        <path d="M0 192H64V256H0V192Z" />
                    </mask>
                    <path d="M64 256V257H65V256H64ZM63 192V256H65V192H63ZM64 255H0V257H64V255Z" fill="#D0D5DD" mask="url(#path-93-inside-46_4940_405682)" />
                    <mask id="path-95-inside-47_4940_405682" fill="white">
                        <path d="M64 192H128V256H64V192Z" />
                    </mask>
                    <path
                        d="M128 256V257H129V256H128ZM127 192V256H129V192H127ZM128 255H64V257H128V255Z"
                        fill="#D0D5DD"
                        mask="url(#path-95-inside-47_4940_405682)"
                    />
                    <mask id="path-97-inside-48_4940_405682" fill="white">
                        <path d="M128 192H192V256H128V192Z" />
                    </mask>
                    <path
                        d="M192 256V257H193V256H192ZM191 192V256H193V192H191ZM192 255H128V257H192V255Z"
                        fill="#D0D5DD"
                        mask="url(#path-97-inside-48_4940_405682)"
                    />
                    <mask id="path-99-inside-49_4940_405682" fill="white">
                        <path d="M192 192H256V256H192V192Z" />
                    </mask>
                    <path
                        d="M256 256V257H257V256H256ZM255 192V256H257V192H255ZM256 255H192V257H256V255Z"
                        fill="#D0D5DD"
                        mask="url(#path-99-inside-49_4940_405682)"
                    />
                    <mask id="path-101-inside-50_4940_405682" fill="white">
                        <path d="M256 192H320V256H256V192Z" />
                    </mask>
                    <path
                        d="M320 256V257H321V256H320ZM319 192V256H321V192H319ZM320 255H256V257H320V255Z"
                        fill="#D0D5DD"
                        mask="url(#path-101-inside-50_4940_405682)"
                    />
                    <mask id="path-103-inside-51_4940_405682" fill="white">
                        <path d="M320 192H384V256H320V192Z" />
                    </mask>
                    <path
                        d="M384 256V257H385V256H384ZM383 192V256H385V192H383ZM384 255H320V257H384V255Z"
                        fill="#D0D5DD"
                        mask="url(#path-103-inside-51_4940_405682)"
                    />
                    <mask id="path-105-inside-52_4940_405682" fill="white">
                        <path d="M384 192H448V256H384V192Z" />
                    </mask>
                    <path
                        d="M448 256V257H449V256H448ZM447 192V256H449V192H447ZM448 255H384V257H448V255Z"
                        fill="#D0D5DD"
                        mask="url(#path-105-inside-52_4940_405682)"
                    />
                    <mask id="path-107-inside-53_4940_405682" fill="white">
                        <path d="M448 192H512V256H448V192Z" />
                    </mask>
                    <path
                        d="M512 256V257H513V256H512ZM511 192V256H513V192H511ZM512 255H448V257H512V255Z"
                        fill="#D0D5DD"
                        mask="url(#path-107-inside-53_4940_405682)"
                    />
                    <mask id="path-109-inside-54_4940_405682" fill="white">
                        <path d="M512 192H576V256H512V192Z" />
                    </mask>
                    <path
                        d="M576 256V257H577V256H576ZM575 192V256H577V192H575ZM576 255H512V257H576V255Z"
                        fill="#D0D5DD"
                        mask="url(#path-109-inside-54_4940_405682)"
                    />
                    <mask id="path-111-inside-55_4940_405682" fill="white">
                        <path d="M576 192H640V256H576V192Z" />
                    </mask>
                    <path
                        d="M640 256V257H641V256H640ZM639 192V256H641V192H639ZM640 255H576V257H640V255Z"
                        fill="#D0D5DD"
                        mask="url(#path-111-inside-55_4940_405682)"
                    />
                    <mask id="path-113-inside-56_4940_405682" fill="white">
                        <path d="M640 192H704V256H640V192Z" />
                    </mask>
                    <path
                        d="M704 256V257H705V256H704ZM703 192V256H705V192H703ZM704 255H640V257H704V255Z"
                        fill="#D0D5DD"
                        mask="url(#path-113-inside-56_4940_405682)"
                    />
                    <mask id="path-115-inside-57_4940_405682" fill="white">
                        <path d="M704 192H768V256H704V192Z" />
                    </mask>
                    <path
                        d="M768 256V257H769V256H768ZM767 192V256H769V192H767ZM768 255H704V257H768V255Z"
                        fill="#D0D5DD"
                        mask="url(#path-115-inside-57_4940_405682)"
                    />
                    <mask id="path-117-inside-58_4940_405682" fill="white">
                        <path d="M768 192H832V256H768V192Z" />
                    </mask>
                    <path d="M768 192H832V256H768V192Z" fill="#F2F4F7" />
                    <path
                        d="M832 256V257H833V256H832ZM831 192V256H833V192H831ZM832 255H768V257H832V255Z"
                        fill="#D0D5DD"
                        mask="url(#path-117-inside-58_4940_405682)"
                    />
                    <mask id="path-119-inside-59_4940_405682" fill="white">
                        <path d="M832 192H896V256H832V192Z" />
                    </mask>
                    <path
                        d="M896 256V257H897V256H896ZM895 192V256H897V192H895ZM896 255H832V257H896V255Z"
                        fill="#D0D5DD"
                        mask="url(#path-119-inside-59_4940_405682)"
                    />
                    <mask id="path-121-inside-60_4940_405682" fill="white">
                        <path d="M896 192H960V256H896V192Z" />
                    </mask>
                    <path
                        d="M960 256V257H961V256H960ZM959 192V256H961V192H959ZM960 255H896V257H960V255Z"
                        fill="#D0D5DD"
                        mask="url(#path-121-inside-60_4940_405682)"
                    />
                    <mask id="path-123-inside-61_4940_405682" fill="white">
                        <path d="M0 256H64V320H0V256Z" />
                    </mask>
                    <path d="M0 256H64V320H0V256Z" fill="#F2F4F7" />
                    <path d="M64 320V321H65V320H64ZM63 256V320H65V256H63ZM64 319H0V321H64V319Z" fill="#D0D5DD" mask="url(#path-123-inside-61_4940_405682)" />
                    <mask id="path-125-inside-62_4940_405682" fill="white">
                        <path d="M64 256H128V320H64V256Z" />
                    </mask>
                    <path
                        d="M128 320V321H129V320H128ZM127 256V320H129V256H127ZM128 319H64V321H128V319Z"
                        fill="#D0D5DD"
                        mask="url(#path-125-inside-62_4940_405682)"
                    />
                    <mask id="path-127-inside-63_4940_405682" fill="white">
                        <path d="M128 256H192V320H128V256Z" />
                    </mask>
                    <path
                        d="M192 320V321H193V320H192ZM191 256V320H193V256H191ZM192 319H128V321H192V319Z"
                        fill="#D0D5DD"
                        mask="url(#path-127-inside-63_4940_405682)"
                    />
                    <mask id="path-129-inside-64_4940_405682" fill="white">
                        <path d="M192 256H256V320H192V256Z" />
                    </mask>
                    <path
                        d="M256 320V321H257V320H256ZM255 256V320H257V256H255ZM256 319H192V321H256V319Z"
                        fill="#D0D5DD"
                        mask="url(#path-129-inside-64_4940_405682)"
                    />
                    <mask id="path-131-inside-65_4940_405682" fill="white">
                        <path d="M256 256H320V320H256V256Z" />
                    </mask>
                    <path
                        d="M320 320V321H321V320H320ZM319 256V320H321V256H319ZM320 319H256V321H320V319Z"
                        fill="#D0D5DD"
                        mask="url(#path-131-inside-65_4940_405682)"
                    />
                    <mask id="path-133-inside-66_4940_405682" fill="white">
                        <path d="M320 256H384V320H320V256Z" />
                    </mask>
                    <path d="M320 256H384V320H320V256Z" fill="#F2F4F7" />
                    <path
                        d="M384 320V321H385V320H384ZM383 256V320H385V256H383ZM384 319H320V321H384V319Z"
                        fill="#D0D5DD"
                        mask="url(#path-133-inside-66_4940_405682)"
                    />
                    <mask id="path-135-inside-67_4940_405682" fill="white">
                        <path d="M384 256H448V320H384V256Z" />
                    </mask>
                    <path
                        d="M448 320V321H449V320H448ZM447 256V320H449V256H447ZM448 319H384V321H448V319Z"
                        fill="#D0D5DD"
                        mask="url(#path-135-inside-67_4940_405682)"
                    />
                    <mask id="path-137-inside-68_4940_405682" fill="white">
                        <path d="M448 256H512V320H448V256Z" />
                    </mask>
                    <path
                        d="M512 320V321H513V320H512ZM511 256V320H513V256H511ZM512 319H448V321H512V319Z"
                        fill="#D0D5DD"
                        mask="url(#path-137-inside-68_4940_405682)"
                    />
                    <mask id="path-139-inside-69_4940_405682" fill="white">
                        <path d="M512 256H576V320H512V256Z" />
                    </mask>
                    <path
                        d="M576 320V321H577V320H576ZM575 256V320H577V256H575ZM576 319H512V321H576V319Z"
                        fill="#D0D5DD"
                        mask="url(#path-139-inside-69_4940_405682)"
                    />
                    <mask id="path-141-inside-70_4940_405682" fill="white">
                        <path d="M576 256H640V320H576V256Z" />
                    </mask>
                    <path
                        d="M640 320V321H641V320H640ZM639 256V320H641V256H639ZM640 319H576V321H640V319Z"
                        fill="#D0D5DD"
                        mask="url(#path-141-inside-70_4940_405682)"
                    />
                    <mask id="path-143-inside-71_4940_405682" fill="white">
                        <path d="M640 256H704V320H640V256Z" />
                    </mask>
                    <path
                        d="M704 320V321H705V320H704ZM703 256V320H705V256H703ZM704 319H640V321H704V319Z"
                        fill="#D0D5DD"
                        mask="url(#path-143-inside-71_4940_405682)"
                    />
                    <mask id="path-145-inside-72_4940_405682" fill="white">
                        <path d="M704 256H768V320H704V256Z" />
                    </mask>
                    <path
                        d="M768 320V321H769V320H768ZM767 256V320H769V256H767ZM768 319H704V321H768V319Z"
                        fill="#D0D5DD"
                        mask="url(#path-145-inside-72_4940_405682)"
                    />
                    <mask id="path-147-inside-73_4940_405682" fill="white">
                        <path d="M768 256H832V320H768V256Z" />
                    </mask>
                    <path
                        d="M832 320V321H833V320H832ZM831 256V320H833V256H831ZM832 319H768V321H832V319Z"
                        fill="#D0D5DD"
                        mask="url(#path-147-inside-73_4940_405682)"
                    />
                    <mask id="path-149-inside-74_4940_405682" fill="white">
                        <path d="M832 256H896V320H832V256Z" />
                    </mask>
                    <path
                        d="M896 320V321H897V320H896ZM895 256V320H897V256H895ZM896 319H832V321H896V319Z"
                        fill="#D0D5DD"
                        mask="url(#path-149-inside-74_4940_405682)"
                    />
                    <mask id="path-151-inside-75_4940_405682" fill="white">
                        <path d="M896 256H960V320H896V256Z" />
                    </mask>
                    <path
                        d="M960 320V321H961V320H960ZM959 256V320H961V256H959ZM960 319H896V321H960V319Z"
                        fill="#D0D5DD"
                        mask="url(#path-151-inside-75_4940_405682)"
                    />
                    <mask id="path-153-inside-76_4940_405682" fill="white">
                        <path d="M0 320H64V384H0V320Z" />
                    </mask>
                    <path d="M64 384V385H65V384H64ZM63 320V384H65V320H63ZM64 383H0V385H64V383Z" fill="#D0D5DD" mask="url(#path-153-inside-76_4940_405682)" />
                    <mask id="path-155-inside-77_4940_405682" fill="white">
                        <path d="M64 320H128V384H64V320Z" />
                    </mask>
                    <path
                        d="M128 384V385H129V384H128ZM127 320V384H129V320H127ZM128 383H64V385H128V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-155-inside-77_4940_405682)"
                    />
                    <mask id="path-157-inside-78_4940_405682" fill="white">
                        <path d="M128 320H192V384H128V320Z" />
                    </mask>
                    <path
                        d="M192 384V385H193V384H192ZM191 320V384H193V320H191ZM192 383H128V385H192V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-157-inside-78_4940_405682)"
                    />
                    <mask id="path-159-inside-79_4940_405682" fill="white">
                        <path d="M192 320H256V384H192V320Z" />
                    </mask>
                    <path d="M192 320H256V384H192V320Z" fill="#F2F4F7" />
                    <path
                        d="M256 384V385H257V384H256ZM255 320V384H257V320H255ZM256 383H192V385H256V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-159-inside-79_4940_405682)"
                    />
                    <mask id="path-161-inside-80_4940_405682" fill="white">
                        <path d="M256 320H320V384H256V320Z" />
                    </mask>
                    <path
                        d="M320 384V385H321V384H320ZM319 320V384H321V320H319ZM320 383H256V385H320V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-161-inside-80_4940_405682)"
                    />
                    <mask id="path-163-inside-81_4940_405682" fill="white">
                        <path d="M320 320H384V384H320V320Z" />
                    </mask>
                    <path
                        d="M384 384V385H385V384H384ZM383 320V384H385V320H383ZM384 383H320V385H384V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-163-inside-81_4940_405682)"
                    />
                    <mask id="path-165-inside-82_4940_405682" fill="white">
                        <path d="M384 320H448V384H384V320Z" />
                    </mask>
                    <path
                        d="M448 384V385H449V384H448ZM447 320V384H449V320H447ZM448 383H384V385H448V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-165-inside-82_4940_405682)"
                    />
                    <mask id="path-167-inside-83_4940_405682" fill="white">
                        <path d="M448 320H512V384H448V320Z" />
                    </mask>
                    <path
                        d="M512 384V385H513V384H512ZM511 320V384H513V320H511ZM512 383H448V385H512V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-167-inside-83_4940_405682)"
                    />
                    <mask id="path-169-inside-84_4940_405682" fill="white">
                        <path d="M512 320H576V384H512V320Z" />
                    </mask>
                    <path
                        d="M576 384V385H577V384H576ZM575 320V384H577V320H575ZM576 383H512V385H576V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-169-inside-84_4940_405682)"
                    />
                    <mask id="path-171-inside-85_4940_405682" fill="white">
                        <path d="M576 320H640V384H576V320Z" />
                    </mask>
                    <path d="M576 320H640V384H576V320Z" fill="#F2F4F7" />
                    <path
                        d="M640 384V385H641V384H640ZM639 320V384H641V320H639ZM640 383H576V385H640V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-171-inside-85_4940_405682)"
                    />
                    <mask id="path-173-inside-86_4940_405682" fill="white">
                        <path d="M640 320H704V384H640V320Z" />
                    </mask>
                    <path
                        d="M704 384V385H705V384H704ZM703 320V384H705V320H703ZM704 383H640V385H704V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-173-inside-86_4940_405682)"
                    />
                    <mask id="path-175-inside-87_4940_405682" fill="white">
                        <path d="M704 320H768V384H704V320Z" />
                    </mask>
                    <path
                        d="M768 384V385H769V384H768ZM767 320V384H769V320H767ZM768 383H704V385H768V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-175-inside-87_4940_405682)"
                    />
                    <mask id="path-177-inside-88_4940_405682" fill="white">
                        <path d="M768 320H832V384H768V320Z" />
                    </mask>
                    <path d="M768 320H832V384H768V320Z" fill="#F2F4F7" />
                    <path
                        d="M832 384V385H833V384H832ZM831 320V384H833V320H831ZM832 383H768V385H832V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-177-inside-88_4940_405682)"
                    />
                    <mask id="path-179-inside-89_4940_405682" fill="white">
                        <path d="M832 320H896V384H832V320Z" />
                    </mask>
                    <path
                        d="M896 384V385H897V384H896ZM895 320V384H897V320H895ZM896 383H832V385H896V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-179-inside-89_4940_405682)"
                    />
                    <mask id="path-181-inside-90_4940_405682" fill="white">
                        <path d="M896 320H960V384H896V320Z" />
                    </mask>
                    <path
                        d="M960 384V385H961V384H960ZM959 320V384H961V320H959ZM960 383H896V385H960V383Z"
                        fill="#D0D5DD"
                        mask="url(#path-181-inside-90_4940_405682)"
                    />
                    <mask id="path-183-inside-91_4940_405682" fill="white">
                        <path d="M0 384H64V448H0V384Z" />
                    </mask>
                    <path d="M64 448V449H65V448H64ZM63 384V448H65V384H63ZM64 447H0V449H64V447Z" fill="#D0D5DD" mask="url(#path-183-inside-91_4940_405682)" />
                    <mask id="path-185-inside-92_4940_405682" fill="white">
                        <path d="M64 384H128V448H64V384Z" />
                    </mask>
                    <path
                        d="M128 448V449H129V448H128ZM127 384V448H129V384H127ZM128 447H64V449H128V447Z"
                        fill="#D0D5DD"
                        mask="url(#path-185-inside-92_4940_405682)"
                    />
                    <mask id="path-187-inside-93_4940_405682" fill="white">
                        <path d="M128 384H192V448H128V384Z" />
                    </mask>
                    <path
                        d="M192 448V449H193V448H192ZM191 384V448H193V384H191ZM192 447H128V449H192V447Z"
                        fill="#D0D5DD"
                        mask="url(#path-187-inside-93_4940_405682)"
                    />
                    <mask id="path-189-inside-94_4940_405682" fill="white">
                        <path d="M192 384H256V448H192V384Z" />
                    </mask>
                    <path
                        d="M256 448V449H257V448H256ZM255 384V448H257V384H255ZM256 447H192V449H256V447Z"
                        fill="#D0D5DD"
                        mask="url(#path-189-inside-94_4940_405682)"
                    />
                    <mask id="path-191-inside-95_4940_405682" fill="white">
                        <path d="M256 384H320V448H256V384Z" />
                    </mask>
                    <path
                        d="M320 448V449H321V448H320ZM319 384V448H321V384H319ZM320 447H256V449H320V447Z"
                        fill="#D0D5DD"
                        mask="url(#path-191-inside-95_4940_405682)"
                    />
                    <mask id="path-193-inside-96_4940_405682" fill="white">
                        <path d="M320 384H384V448H320V384Z" />
                    </mask>
                    <path
                        d="M384 448V449H385V448H384ZM383 384V448H385V384H383ZM384 447H320V449H384V447Z"
                        fill="#D0D5DD"
                        mask="url(#path-193-inside-96_4940_405682)"
                    />
                    <mask id="path-195-inside-97_4940_405682" fill="white">
                        <path d="M384 384H448V448H384V384Z" />
                    </mask>
                    <path d="M384 384H448V448H384V384Z" fill="#F2F4F7" />
                    <path
                        d="M448 448V449H449V448H448ZM447 384V448H449V384H447ZM448 447H384V449H448V447Z"
                        fill="#D0D5DD"
                        mask="url(#path-195-inside-97_4940_405682)"
                    />
                    <mask id="path-197-inside-98_4940_405682" fill="white">
                        <path d="M448 384H512V448H448V384Z" />
                    </mask>
                    <path
                        d="M512 448V449H513V448H512ZM511 384V448H513V384H511ZM512 447H448V449H512V447Z"
                        fill="#D0D5DD"
                        mask="url(#path-197-inside-98_4940_405682)"
                    />
                    <mask id="path-199-inside-99_4940_405682" fill="white">
                        <path d="M512 384H576V448H512V384Z" />
                    </mask>
                    <path
                        d="M576 448V449H577V448H576ZM575 384V448H577V384H575ZM576 447H512V449H576V447Z"
                        fill="#D0D5DD"
                        mask="url(#path-199-inside-99_4940_405682)"
                    />
                    <mask id="path-201-inside-100_4940_405682" fill="white">
                        <path d="M576 384H640V448H576V384Z" />
                    </mask>
                    <path
                        d="M640 448V449H641V448H640ZM639 384V448H641V384H639ZM640 447H576V449H640V447Z"
                        fill="#D0D5DD"
                        mask="url(#path-201-inside-100_4940_405682)"
                    />
                    <mask id="path-203-inside-101_4940_405682" fill="white">
                        <path d="M640 384H704V448H640V384Z" />
                    </mask>
                    <path
                        d="M704 448V449H705V448H704ZM703 384V448H705V384H703ZM704 447H640V449H704V447Z"
                        fill="#D0D5DD"
                        mask="url(#path-203-inside-101_4940_405682)"
                    />
                    <mask id="path-205-inside-102_4940_405682" fill="white">
                        <path d="M704 384H768V448H704V384Z" />
                    </mask>
                    <path
                        d="M768 448V449H769V448H768ZM767 384V448H769V384H767ZM768 447H704V449H768V447Z"
                        fill="#D0D5DD"
                        mask="url(#path-205-inside-102_4940_405682)"
                    />
                    <mask id="path-207-inside-103_4940_405682" fill="white">
                        <path d="M768 384H832V448H768V384Z" />
                    </mask>
                    <path
                        d="M832 448V449H833V448H832ZM831 384V448H833V384H831ZM832 447H768V449H832V447Z"
                        fill="#D0D5DD"
                        mask="url(#path-207-inside-103_4940_405682)"
                    />
                    <mask id="path-209-inside-104_4940_405682" fill="white">
                        <path d="M832 384H896V448H832V384Z" />
                    </mask>
                    <path
                        d="M896 448V449H897V448H896ZM895 384V448H897V384H895ZM896 447H832V449H896V447Z"
                        fill="#D0D5DD"
                        mask="url(#path-209-inside-104_4940_405682)"
                    />
                    <mask id="path-211-inside-105_4940_405682" fill="white">
                        <path d="M896 384H960V448H896V384Z" />
                    </mask>
                    <path
                        d="M960 448V449H961V448H960ZM959 384V448H961V384H959ZM960 447H896V449H960V447Z"
                        fill="#D0D5DD"
                        mask="url(#path-211-inside-105_4940_405682)"
                    />
                    <mask id="path-213-inside-106_4940_405682" fill="white">
                        <path d="M0 448H64V512H0V448Z" />
                    </mask>
                    <path d="M64 512V513H65V512H64ZM63 448V512H65V448H63ZM64 511H0V513H64V511Z" fill="#D0D5DD" mask="url(#path-213-inside-106_4940_405682)" />
                    <mask id="path-215-inside-107_4940_405682" fill="white">
                        <path d="M64 448H128V512H64V448Z" />
                    </mask>
                    <path
                        d="M128 512V513H129V512H128ZM127 448V512H129V448H127ZM128 511H64V513H128V511Z"
                        fill="#D0D5DD"
                        mask="url(#path-215-inside-107_4940_405682)"
                    />
                    <mask id="path-217-inside-108_4940_405682" fill="white">
                        <path d="M128 448H192V512H128V448Z" />
                    </mask>
                    <path
                        d="M192 512V513H193V512H192ZM191 448V512H193V448H191ZM192 511H128V513H192V511Z"
                        fill="#D0D5DD"
                        mask="url(#path-217-inside-108_4940_405682)"
                    />
                    <mask id="path-219-inside-109_4940_405682" fill="white">
                        <path d="M192 448H256V512H192V448Z" />
                    </mask>
                    <path
                        d="M256 512V513H257V512H256ZM255 448V512H257V448H255ZM256 511H192V513H256V511Z"
                        fill="#D0D5DD"
                        mask="url(#path-219-inside-109_4940_405682)"
                    />
                    <mask id="path-221-inside-110_4940_405682" fill="white">
                        <path d="M256 448H320V512H256V448Z" />
                    </mask>
                    <path d="M256 448H320V512H256V448Z" fill="#F2F4F7" />
                    <path
                        d="M320 512V513H321V512H320ZM319 448V512H321V448H319ZM320 511H256V513H320V511Z"
                        fill="#D0D5DD"
                        mask="url(#path-221-inside-110_4940_405682)"
                    />
                    <mask id="path-223-inside-111_4940_405682" fill="white">
                        <path d="M320 448H384V512H320V448Z" />
                    </mask>
                    <path
                        d="M384 512V513H385V512H384ZM383 448V512H385V448H383ZM384 511H320V513H384V511Z"
                        fill="#D0D5DD"
                        mask="url(#path-223-inside-111_4940_405682)"
                    />
                    <mask id="path-225-inside-112_4940_405682" fill="white">
                        <path d="M384 448H448V512H384V448Z" />
                    </mask>
                    <path
                        d="M448 512V513H449V512H448ZM447 448V512H449V448H447ZM448 511H384V513H448V511Z"
                        fill="#D0D5DD"
                        mask="url(#path-225-inside-112_4940_405682)"
                    />
                    <mask id="path-227-inside-113_4940_405682" fill="white">
                        <path d="M448 448H512V512H448V448Z" />
                    </mask>
                    <path
                        d="M512 512V513H513V512H512ZM511 448V512H513V448H511ZM512 511H448V513H512V511Z"
                        fill="#D0D5DD"
                        mask="url(#path-227-inside-113_4940_405682)"
                    />
                    <mask id="path-229-inside-114_4940_405682" fill="white">
                        <path d="M512 448H576V512H512V448Z" />
                    </mask>
                    <path
                        d="M576 512V513H577V512H576ZM575 448V512H577V448H575ZM576 511H512V513H576V511Z"
                        fill="#D0D5DD"
                        mask="url(#path-229-inside-114_4940_405682)"
                    />
                    <mask id="path-231-inside-115_4940_405682" fill="white">
                        <path d="M576 448H640V512H576V448Z" />
                    </mask>
                    <path
                        d="M640 512V513H641V512H640ZM639 448V512H641V448H639ZM640 511H576V513H640V511Z"
                        fill="#D0D5DD"
                        mask="url(#path-231-inside-115_4940_405682)"
                    />
                    <mask id="path-233-inside-116_4940_405682" fill="white">
                        <path d="M640 448H704V512H640V448Z" />
                    </mask>
                    <path d="M640 448H704V512H640V448Z" fill="#F2F4F7" />
                    <path
                        d="M704 512V513H705V512H704ZM703 448V512H705V448H703ZM704 511H640V513H704V511Z"
                        fill="#D0D5DD"
                        mask="url(#path-233-inside-116_4940_405682)"
                    />
                    <mask id="path-235-inside-117_4940_405682" fill="white">
                        <path d="M704 448H768V512H704V448Z" />
                    </mask>
                    <path
                        d="M768 512V513H769V512H768ZM767 448V512H769V448H767ZM768 511H704V513H768V511Z"
                        fill="#D0D5DD"
                        mask="url(#path-235-inside-117_4940_405682)"
                    />
                    <mask id="path-237-inside-118_4940_405682" fill="white">
                        <path d="M768 448H832V512H768V448Z" />
                    </mask>
                    <path
                        d="M832 512V513H833V512H832ZM831 448V512H833V448H831ZM832 511H768V513H832V511Z"
                        fill="#D0D5DD"
                        mask="url(#path-237-inside-118_4940_405682)"
                    />
                    <mask id="path-239-inside-119_4940_405682" fill="white">
                        <path d="M832 448H896V512H832V448Z" />
                    </mask>
                    <path
                        d="M896 512V513H897V512H896ZM895 448V512H897V448H895ZM896 511H832V513H896V511Z"
                        fill="#D0D5DD"
                        mask="url(#path-239-inside-119_4940_405682)"
                    />
                    <mask id="path-241-inside-120_4940_405682" fill="white">
                        <path d="M896 448H960V512H896V448Z" />
                    </mask>
                    <path
                        d="M960 512V513H961V512H960ZM959 448V512H961V448H959ZM960 511H896V513H960V511Z"
                        fill="#D0D5DD"
                        mask="url(#path-241-inside-120_4940_405682)"
                    />
                    <mask id="path-243-inside-121_4940_405682" fill="white">
                        <path d="M0 512H64V576H0V512Z" />
                    </mask>
                    <path d="M64 576V577H65V576H64ZM63 512V576H65V512H63ZM64 575H0V577H64V575Z" fill="#D0D5DD" mask="url(#path-243-inside-121_4940_405682)" />
                    <mask id="path-245-inside-122_4940_405682" fill="white">
                        <path d="M64 512H128V576H64V512Z" />
                    </mask>
                    <path
                        d="M128 576V577H129V576H128ZM127 512V576H129V512H127ZM128 575H64V577H128V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-245-inside-122_4940_405682)"
                    />
                    <mask id="path-247-inside-123_4940_405682" fill="white">
                        <path d="M128 512H192V576H128V512Z" />
                    </mask>
                    <path d="M128 512H192V576H128V512Z" fill="#F2F4F7" />
                    <path
                        d="M192 576V577H193V576H192ZM191 512V576H193V512H191ZM192 575H128V577H192V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-247-inside-123_4940_405682)"
                    />
                    <mask id="path-249-inside-124_4940_405682" fill="white">
                        <path d="M192 512H256V576H192V512Z" />
                    </mask>
                    <path
                        d="M256 576V577H257V576H256ZM255 512V576H257V512H255ZM256 575H192V577H256V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-249-inside-124_4940_405682)"
                    />
                    <mask id="path-251-inside-125_4940_405682" fill="white">
                        <path d="M256 512H320V576H256V512Z" />
                    </mask>
                    <path
                        d="M320 576V577H321V576H320ZM319 512V576H321V512H319ZM320 575H256V577H320V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-251-inside-125_4940_405682)"
                    />
                    <mask id="path-253-inside-126_4940_405682" fill="white">
                        <path d="M320 512H384V576H320V512Z" />
                    </mask>
                    <path
                        d="M384 576V577H385V576H384ZM383 512V576H385V512H383ZM384 575H320V577H384V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-253-inside-126_4940_405682)"
                    />
                    <mask id="path-255-inside-127_4940_405682" fill="white">
                        <path d="M384 512H448V576H384V512Z" />
                    </mask>
                    <path
                        d="M448 576V577H449V576H448ZM447 512V576H449V512H447ZM448 575H384V577H448V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-255-inside-127_4940_405682)"
                    />
                    <mask id="path-257-inside-128_4940_405682" fill="white">
                        <path d="M448 512H512V576H448V512Z" />
                    </mask>
                    <path
                        d="M512 576V577H513V576H512ZM511 512V576H513V512H511ZM512 575H448V577H512V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-257-inside-128_4940_405682)"
                    />
                    <mask id="path-259-inside-129_4940_405682" fill="white">
                        <path d="M512 512H576V576H512V512Z" />
                    </mask>
                    <path
                        d="M576 576V577H577V576H576ZM575 512V576H577V512H575ZM576 575H512V577H576V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-259-inside-129_4940_405682)"
                    />
                    <mask id="path-261-inside-130_4940_405682" fill="white">
                        <path d="M576 512H640V576H576V512Z" />
                    </mask>
                    <path
                        d="M640 576V577H641V576H640ZM639 512V576H641V512H639ZM640 575H576V577H640V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-261-inside-130_4940_405682)"
                    />
                    <mask id="path-263-inside-131_4940_405682" fill="white">
                        <path d="M640 512H704V576H640V512Z" />
                    </mask>
                    <path
                        d="M704 576V577H705V576H704ZM703 512V576H705V512H703ZM704 575H640V577H704V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-263-inside-131_4940_405682)"
                    />
                    <mask id="path-265-inside-132_4940_405682" fill="white">
                        <path d="M704 512H768V576H704V512Z" />
                    </mask>
                    <path
                        d="M768 576V577H769V576H768ZM767 512V576H769V512H767ZM768 575H704V577H768V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-265-inside-132_4940_405682)"
                    />
                    <mask id="path-267-inside-133_4940_405682" fill="white">
                        <path d="M768 512H832V576H768V512Z" />
                    </mask>
                    <path
                        d="M832 576V577H833V576H832ZM831 512V576H833V512H831ZM832 575H768V577H832V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-267-inside-133_4940_405682)"
                    />
                    <mask id="path-269-inside-134_4940_405682" fill="white">
                        <path d="M832 512H896V576H832V512Z" />
                    </mask>
                    <path d="M832 512H896V576H832V512Z" fill="#F2F4F7" />
                    <path
                        d="M896 576V577H897V576H896ZM895 512V576H897V512H895ZM896 575H832V577H896V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-269-inside-134_4940_405682)"
                    />
                    <mask id="path-271-inside-135_4940_405682" fill="white">
                        <path d="M896 512H960V576H896V512Z" />
                    </mask>
                    <path
                        d="M960 576V577H961V576H960ZM959 512V576H961V512H959ZM960 575H896V577H960V575Z"
                        fill="#D0D5DD"
                        mask="url(#path-271-inside-135_4940_405682)"
                    />
                    <mask id="path-273-inside-136_4940_405682" fill="white">
                        <path d="M0 576H64V640H0V576Z" />
                    </mask>
                    <path d="M64 640V641H65V640H64ZM63 576V640H65V576H63ZM64 639H0V641H64V639Z" fill="#D0D5DD" mask="url(#path-273-inside-136_4940_405682)" />
                    <mask id="path-275-inside-137_4940_405682" fill="white">
                        <path d="M64 576H128V640H64V576Z" />
                    </mask>
                    <path
                        d="M128 640V641H129V640H128ZM127 576V640H129V576H127ZM128 639H64V641H128V639Z"
                        fill="#D0D5DD"
                        mask="url(#path-275-inside-137_4940_405682)"
                    />
                    <mask id="path-277-inside-138_4940_405682" fill="white">
                        <path d="M128 576H192V640H128V576Z" />
                    </mask>
                    <path
                        d="M192 640V641H193V640H192ZM191 576V640H193V576H191ZM192 639H128V641H192V639Z"
                        fill="#D0D5DD"
                        mask="url(#path-277-inside-138_4940_405682)"
                    />
                    <mask id="path-279-inside-139_4940_405682" fill="white">
                        <path d="M192 576H256V640H192V576Z" />
                    </mask>
                    <path
                        d="M256 640V641H257V640H256ZM255 576V640H257V576H255ZM256 639H192V641H256V639Z"
                        fill="#D0D5DD"
                        mask="url(#path-279-inside-139_4940_405682)"
                    />
                    <mask id="path-281-inside-140_4940_405682" fill="white">
                        <path d="M256 576H320V640H256V576Z" />
                    </mask>
                    <path
                        d="M320 640V641H321V640H320ZM319 576V640H321V576H319ZM320 639H256V641H320V639Z"
                        fill="#D0D5DD"
                        mask="url(#path-281-inside-140_4940_405682)"
                    />
                    <mask id="path-283-inside-141_4940_405682" fill="white">
                        <path d="M320 576H384V640H320V576Z" />
                    </mask>
                    <path
                        d="M384 640V641H385V640H384ZM383 576V640H385V576H383ZM384 639H320V641H384V639Z"
                        fill="#D0D5DD"
                        mask="url(#path-283-inside-141_4940_405682)"
                    />
                    <mask id="path-285-inside-142_4940_405682" fill="white">
                        <path d="M384 576H448V640H384V576Z" />
                    </mask>
                    <path d="M384 576H448V640H384V576Z" fill="#F2F4F7" />
                    <path
                        d="M448 640V641H449V640H448ZM447 576V640H449V576H447ZM448 639H384V641H448V639Z"
                        fill="#D0D5DD"
                        mask="url(#path-285-inside-142_4940_405682)"
                    />
                    <mask id="path-287-inside-143_4940_405682" fill="white">
                        <path d="M448 576H512V640H448V576Z" />
                    </mask>
                    <path
                        d="M512 640V641H513V640H512ZM511 576V640H513V576H511ZM512 639H448V641H512V639Z"
                        fill="#D0D5DD"
                        mask="url(#path-287-inside-143_4940_405682)"
                    />
                    <mask id="path-289-inside-144_4940_405682" fill="white">
                        <path d="M512 576H576V640H512V576Z" />
                    </mask>
                    <path
                        d="M576 640V641H577V640H576ZM575 576V640H577V576H575ZM576 639H512V641H576V639Z"
                        fill="#D0D5DD"
                        mask="url(#path-289-inside-144_4940_405682)"
                    />
                    <mask id="path-291-inside-145_4940_405682" fill="white">
                        <path d="M576 576H640V640H576V576Z" />
                    </mask>
                    <path
                        d="M640 640V641H641V640H640ZM639 576V640H641V576H639ZM640 639H576V641H640V639Z"
                        fill="#D0D5DD"
                        mask="url(#path-291-inside-145_4940_405682)"
                    />
                    <mask id="path-293-inside-146_4940_405682" fill="white">
                        <path d="M640 576H704V640H640V576Z" />
                    </mask>
                    <path
                        d="M704 640V641H705V640H704ZM703 576V640H705V576H703ZM704 639H640V641H704V639Z"
                        fill="#D0D5DD"
                        mask="url(#path-293-inside-146_4940_405682)"
                    />
                    <mask id="path-295-inside-147_4940_405682" fill="white">
                        <path d="M704 576H768V640H704V576Z" />
                    </mask>
                    <path
                        d="M768 640V641H769V640H768ZM767 576V640H769V576H767ZM768 639H704V641H768V639Z"
                        fill="#D0D5DD"
                        mask="url(#path-295-inside-147_4940_405682)"
                    />
                    <mask id="path-297-inside-148_4940_405682" fill="white">
                        <path d="M768 576H832V640H768V576Z" />
                    </mask>
                    <path
                        d="M832 640V641H833V640H832ZM831 576V640H833V576H831ZM832 639H768V641H832V639Z"
                        fill="#D0D5DD"
                        mask="url(#path-297-inside-148_4940_405682)"
                    />
                    <mask id="path-299-inside-149_4940_405682" fill="white">
                        <path d="M832 576H896V640H832V576Z" />
                    </mask>
                    <path
                        d="M896 640V641H897V640H896ZM895 576V640H897V576H895ZM896 639H832V641H896V639Z"
                        fill="#D0D5DD"
                        mask="url(#path-299-inside-149_4940_405682)"
                    />
                    <mask id="path-301-inside-150_4940_405682" fill="white">
                        <path d="M896 576H960V640H896V576Z" />
                    </mask>
                    <path
                        d="M960 640V641H961V640H960ZM959 576V640H961V576H959ZM960 639H896V641H960V639Z"
                        fill="#D0D5DD"
                        mask="url(#path-301-inside-150_4940_405682)"
                    />
                    <mask id="path-303-inside-151_4940_405682" fill="white">
                        <path d="M0 640H64V704H0V640Z" />
                    </mask>
                    <path d="M64 704V705H65V704H64ZM63 640V704H65V640H63ZM64 703H0V705H64V703Z" fill="#D0D5DD" mask="url(#path-303-inside-151_4940_405682)" />
                    <mask id="path-305-inside-152_4940_405682" fill="white">
                        <path d="M64 640H128V704H64V640Z" />
                    </mask>
                    <path
                        d="M128 704V705H129V704H128ZM127 640V704H129V640H127ZM128 703H64V705H128V703Z"
                        fill="#D0D5DD"
                        mask="url(#path-305-inside-152_4940_405682)"
                    />
                    <mask id="path-307-inside-153_4940_405682" fill="white">
                        <path d="M128 640H192V704H128V640Z" />
                    </mask>
                    <path
                        d="M192 704V705H193V704H192ZM191 640V704H193V640H191ZM192 703H128V705H192V703Z"
                        fill="#D0D5DD"
                        mask="url(#path-307-inside-153_4940_405682)"
                    />
                    <mask id="path-309-inside-154_4940_405682" fill="white">
                        <path d="M192 640H256V704H192V640Z" />
                    </mask>
                    <path
                        d="M256 704V705H257V704H256ZM255 640V704H257V640H255ZM256 703H192V705H256V703Z"
                        fill="#D0D5DD"
                        mask="url(#path-309-inside-154_4940_405682)"
                    />
                    <mask id="path-311-inside-155_4940_405682" fill="white">
                        <path d="M256 640H320V704H256V640Z" />
                    </mask>
                    <path d="M256 640H320V704H256V640Z" fill="#F2F4F7" />
                    <path
                        d="M320 704V705H321V704H320ZM319 640V704H321V640H319ZM320 703H256V705H320V703Z"
                        fill="#D0D5DD"
                        mask="url(#path-311-inside-155_4940_405682)"
                    />
                    <mask id="path-313-inside-156_4940_405682" fill="white">
                        <path d="M320 640H384V704H320V640Z" />
                    </mask>
                    <path
                        d="M384 704V705H385V704H384ZM383 640V704H385V640H383ZM384 703H320V705H384V703Z"
                        fill="#D0D5DD"
                        mask="url(#path-313-inside-156_4940_405682)"
                    />
                    <mask id="path-315-inside-157_4940_405682" fill="white">
                        <path d="M384 640H448V704H384V640Z" />
                    </mask>
                    <path
                        d="M448 704V705H449V704H448ZM447 640V704H449V640H447ZM448 703H384V705H448V703Z"
                        fill="#D0D5DD"
                        mask="url(#path-315-inside-157_4940_405682)"
                    />
                    <mask id="path-317-inside-158_4940_405682" fill="white">
                        <path d="M448 640H512V704H448V640Z" />
                    </mask>
                    <path
                        d="M512 704V705H513V704H512ZM511 640V704H513V640H511ZM512 703H448V705H512V703Z"
                        fill="#D0D5DD"
                        mask="url(#path-317-inside-158_4940_405682)"
                    />
                    <mask id="path-319-inside-159_4940_405682" fill="white">
                        <path d="M512 640H576V704H512V640Z" />
                    </mask>
                    <path
                        d="M576 704V705H577V704H576ZM575 640V704H577V640H575ZM576 703H512V705H576V703Z"
                        fill="#D0D5DD"
                        mask="url(#path-319-inside-159_4940_405682)"
                    />
                    <mask id="path-321-inside-160_4940_405682" fill="white">
                        <path d="M576 640H640V704H576V640Z" />
                    </mask>
                    <path
                        d="M640 704V705H641V704H640ZM639 640V704H641V640H639ZM640 703H576V705H640V703Z"
                        fill="#D0D5DD"
                        mask="url(#path-321-inside-160_4940_405682)"
                    />
                    <mask id="path-323-inside-161_4940_405682" fill="white">
                        <path d="M640 640H704V704H640V640Z" />
                    </mask>
                    <path
                        d="M704 704V705H705V704H704ZM703 640V704H705V640H703ZM704 703H640V705H704V703Z"
                        fill="#D0D5DD"
                        mask="url(#path-323-inside-161_4940_405682)"
                    />
                    <mask id="path-325-inside-162_4940_405682" fill="white">
                        <path d="M704 640H768V704H704V640Z" />
                    </mask>
                    <path d="M704 640H768V704H704V640Z" fill="#F2F4F7" />
                    <path
                        d="M768 704V705H769V704H768ZM767 640V704H769V640H767ZM768 703H704V705H768V703Z"
                        fill="#D0D5DD"
                        mask="url(#path-325-inside-162_4940_405682)"
                    />
                    <mask id="path-327-inside-163_4940_405682" fill="white">
                        <path d="M768 640H832V704H768V640Z" />
                    </mask>
                    <path
                        d="M832 704V705H833V704H832ZM831 640V704H833V640H831ZM832 703H768V705H832V703Z"
                        fill="#D0D5DD"
                        mask="url(#path-327-inside-163_4940_405682)"
                    />
                    <mask id="path-329-inside-164_4940_405682" fill="white">
                        <path d="M832 640H896V704H832V640Z" />
                    </mask>
                    <path
                        d="M896 704V705H897V704H896ZM895 640V704H897V640H895ZM896 703H832V705H896V703Z"
                        fill="#D0D5DD"
                        mask="url(#path-329-inside-164_4940_405682)"
                    />
                    <mask id="path-331-inside-165_4940_405682" fill="white">
                        <path d="M896 640H960V704H896V640Z" />
                    </mask>
                    <path
                        d="M960 704V705H961V704H960ZM959 640V704H961V640H959ZM960 703H896V705H960V703Z"
                        fill="#D0D5DD"
                        mask="url(#path-331-inside-165_4940_405682)"
                    />
                    <mask id="path-333-inside-166_4940_405682" fill="white">
                        <path d="M0 704H64V768H0V704Z" />
                    </mask>
                    <path d="M64 768V769H65V768H64ZM63 704V768H65V704H63ZM64 767H0V769H64V767Z" fill="#D0D5DD" mask="url(#path-333-inside-166_4940_405682)" />
                    <mask id="path-335-inside-167_4940_405682" fill="white">
                        <path d="M64 704H128V768H64V704Z" />
                    </mask>
                    <path
                        d="M128 768V769H129V768H128ZM127 704V768H129V704H127ZM128 767H64V769H128V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-335-inside-167_4940_405682)"
                    />
                    <mask id="path-337-inside-168_4940_405682" fill="white">
                        <path d="M128 704H192V768H128V704Z" />
                    </mask>
                    <path
                        d="M192 768V769H193V768H192ZM191 704V768H193V704H191ZM192 767H128V769H192V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-337-inside-168_4940_405682)"
                    />
                    <mask id="path-339-inside-169_4940_405682" fill="white">
                        <path d="M192 704H256V768H192V704Z" />
                    </mask>
                    <path
                        d="M256 768V769H257V768H256ZM255 704V768H257V704H255ZM256 767H192V769H256V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-339-inside-169_4940_405682)"
                    />
                    <mask id="path-341-inside-170_4940_405682" fill="white">
                        <path d="M256 704H320V768H256V704Z" />
                    </mask>
                    <path
                        d="M320 768V769H321V768H320ZM319 704V768H321V704H319ZM320 767H256V769H320V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-341-inside-170_4940_405682)"
                    />
                    <mask id="path-343-inside-171_4940_405682" fill="white">
                        <path d="M320 704H384V768H320V704Z" />
                    </mask>
                    <path
                        d="M384 768V769H385V768H384ZM383 704V768H385V704H383ZM384 767H320V769H384V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-343-inside-171_4940_405682)"
                    />
                    <mask id="path-345-inside-172_4940_405682" fill="white">
                        <path d="M384 704H448V768H384V704Z" />
                    </mask>
                    <path
                        d="M448 768V769H449V768H448ZM447 704V768H449V704H447ZM448 767H384V769H448V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-345-inside-172_4940_405682)"
                    />
                    <mask id="path-347-inside-173_4940_405682" fill="white">
                        <path d="M448 704H512V768H448V704Z" />
                    </mask>
                    <path
                        d="M512 768V769H513V768H512ZM511 704V768H513V704H511ZM512 767H448V769H512V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-347-inside-173_4940_405682)"
                    />
                    <mask id="path-349-inside-174_4940_405682" fill="white">
                        <path d="M512 704H576V768H512V704Z" />
                    </mask>
                    <path d="M512 704H576V768H512V704Z" fill="#F2F4F7" />
                    <path
                        d="M576 768V769H577V768H576ZM575 704V768H577V704H575ZM576 767H512V769H576V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-349-inside-174_4940_405682)"
                    />
                    <mask id="path-351-inside-175_4940_405682" fill="white">
                        <path d="M576 704H640V768H576V704Z" />
                    </mask>
                    <path
                        d="M640 768V769H641V768H640ZM639 704V768H641V704H639ZM640 767H576V769H640V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-351-inside-175_4940_405682)"
                    />
                    <mask id="path-353-inside-176_4940_405682" fill="white">
                        <path d="M640 704H704V768H640V704Z" />
                    </mask>
                    <path
                        d="M704 768V769H705V768H704ZM703 704V768H705V704H703ZM704 767H640V769H704V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-353-inside-176_4940_405682)"
                    />
                    <mask id="path-355-inside-177_4940_405682" fill="white">
                        <path d="M704 704H768V768H704V704Z" />
                    </mask>
                    <path
                        d="M768 768V769H769V768H768ZM767 704V768H769V704H767ZM768 767H704V769H768V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-355-inside-177_4940_405682)"
                    />
                    <mask id="path-357-inside-178_4940_405682" fill="white">
                        <path d="M768 704H832V768H768V704Z" />
                    </mask>
                    <path
                        d="M832 768V769H833V768H832ZM831 704V768H833V704H831ZM832 767H768V769H832V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-357-inside-178_4940_405682)"
                    />
                    <mask id="path-359-inside-179_4940_405682" fill="white">
                        <path d="M832 704H896V768H832V704Z" />
                    </mask>
                    <path d="M832 704H896V768H832V704Z" fill="#F2F4F7" />
                    <path
                        d="M896 768V769H897V768H896ZM895 704V768H897V704H895ZM896 767H832V769H896V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-359-inside-179_4940_405682)"
                    />
                    <mask id="path-361-inside-180_4940_405682" fill="white">
                        <path d="M896 704H960V768H896V704Z" />
                    </mask>
                    <path
                        d="M960 768V769H961V768H960ZM959 704V768H961V704H959ZM960 767H896V769H960V767Z"
                        fill="#D0D5DD"
                        mask="url(#path-361-inside-180_4940_405682)"
                    />
                    <mask id="path-363-inside-181_4940_405682" fill="white">
                        <path d="M0 768H64V832H0V768Z" />
                    </mask>
                    <path d="M64 832V833H65V832H64ZM63 768V832H65V768H63ZM64 831H0V833H64V831Z" fill="#D0D5DD" mask="url(#path-363-inside-181_4940_405682)" />
                    <mask id="path-365-inside-182_4940_405682" fill="white">
                        <path d="M64 768H128V832H64V768Z" />
                    </mask>
                    <path
                        d="M128 832V833H129V832H128ZM127 768V832H129V768H127ZM128 831H64V833H128V831Z"
                        fill="#D0D5DD"
                        mask="url(#path-365-inside-182_4940_405682)"
                    />
                    <mask id="path-367-inside-183_4940_405682" fill="white">
                        <path d="M128 768H192V832H128V768Z" />
                    </mask>
                    <path
                        d="M192 832V833H193V832H192ZM191 768V832H193V768H191ZM192 831H128V833H192V831Z"
                        fill="#D0D5DD"
                        mask="url(#path-367-inside-183_4940_405682)"
                    />
                    <mask id="path-369-inside-184_4940_405682" fill="white">
                        <path d="M192 768H256V832H192V768Z" />
                    </mask>
                    <path
                        d="M256 832V833H257V832H256ZM255 768V832H257V768H255ZM256 831H192V833H256V831Z"
                        fill="#D0D5DD"
                        mask="url(#path-369-inside-184_4940_405682)"
                    />
                    <mask id="path-371-inside-185_4940_405682" fill="white">
                        <path d="M256 768H320V832H256V768Z" />
                    </mask>
                    <path d="M256 768H320V832H256V768Z" fill="#F2F4F7" />
                    <path
                        d="M320 832V833H321V832H320ZM319 768V832H321V768H319ZM320 831H256V833H320V831Z"
                        fill="#D0D5DD"
                        mask="url(#path-371-inside-185_4940_405682)"
                    />
                    <mask id="path-373-inside-186_4940_405682" fill="white">
                        <path d="M320 768H384V832H320V768Z" />
                    </mask>
                    <path
                        d="M384 832V833H385V832H384ZM383 768V832H385V768H383ZM384 831H320V833H384V831Z"
                        fill="#D0D5DD"
                        mask="url(#path-373-inside-186_4940_405682)"
                    />
                    <mask id="path-375-inside-187_4940_405682" fill="white">
                        <path d="M384 768H448V832H384V768Z" />
                    </mask>
                    <path
                        d="M448 832V833H449V832H448ZM447 768V832H449V768H447ZM448 831H384V833H448V831Z"
                        fill="#D0D5DD"
                        mask="url(#path-375-inside-187_4940_405682)"
                    />
                    <mask id="path-377-inside-188_4940_405682" fill="white">
                        <path d="M448 768H512V832H448V768Z" />
                    </mask>
                    <path
                        d="M512 832V833H513V832H512ZM511 768V832H513V768H511ZM512 831H448V833H512V831Z"
                        fill="#D0D5DD"
                        mask="url(#path-377-inside-188_4940_405682)"
                    />
                    <mask id="path-379-inside-189_4940_405682" fill="white">
                        <path d="M512 768H576V832H512V768Z" />
                    </mask>
                    <path
                        d="M576 832V833H577V832H576ZM575 768V832H577V768H575ZM576 831H512V833H576V831Z"
                        fill="#D0D5DD"
                        mask="url(#path-379-inside-189_4940_405682)"
                    />
                    <mask id="path-381-inside-190_4940_405682" fill="white">
                        <path d="M576 768H640V832H576V768Z" />
                    </mask>
                    <path
                        d="M640 832V833H641V832H640ZM639 768V832H641V768H639ZM640 831H576V833H640V831Z"
                        fill="#D0D5DD"
                        mask="url(#path-381-inside-190_4940_405682)"
                    />
                    <mask id="path-383-inside-191_4940_405682" fill="white">
                        <path d="M640 768H704V832H640V768Z" />
                    </mask>
                    <path
                        d="M704 832V833H705V832H704ZM703 768V832H705V768H703ZM704 831H640V833H704V831Z"
                        fill="#D0D5DD"
                        mask="url(#path-383-inside-191_4940_405682)"
                    />
                    <mask id="path-385-inside-192_4940_405682" fill="white">
                        <path d="M704 768H768V832H704V768Z" />
                    </mask>
                    <path
                        d="M768 832V833H769V832H768ZM767 768V832H769V768H767ZM768 831H704V833H768V831Z"
                        fill="#D0D5DD"
                        mask="url(#path-385-inside-192_4940_405682)"
                    />
                    <mask id="path-387-inside-193_4940_405682" fill="white">
                        <path d="M768 768H832V832H768V768Z" />
                    </mask>
                    <path
                        d="M832 832V833H833V832H832ZM831 768V832H833V768H831ZM832 831H768V833H832V831Z"
                        fill="#D0D5DD"
                        mask="url(#path-387-inside-193_4940_405682)"
                    />
                    <mask id="path-389-inside-194_4940_405682" fill="white">
                        <path d="M832 768H896V832H832V768Z" />
                    </mask>
                    <path
                        d="M896 832V833H897V832H896ZM895 768V832H897V768H895ZM896 831H832V833H896V831Z"
                        fill="#D0D5DD"
                        mask="url(#path-389-inside-194_4940_405682)"
                    />
                    <mask id="path-391-inside-195_4940_405682" fill="white">
                        <path d="M896 768H960V832H896V768Z" />
                    </mask>
                    <path
                        d="M960 832V833H961V832H960ZM959 768V832H961V768H959ZM960 831H896V833H960V831Z"
                        fill="#D0D5DD"
                        mask="url(#path-391-inside-195_4940_405682)"
                    />
                    <mask id="path-393-inside-196_4940_405682" fill="white">
                        <path d="M0 832H64V896H0V832Z" />
                    </mask>
                    <path d="M64 896V897H65V896H64ZM63 832V896H65V832H63ZM64 895H0V897H64V895Z" fill="#D0D5DD" mask="url(#path-393-inside-196_4940_405682)" />
                    <mask id="path-395-inside-197_4940_405682" fill="white">
                        <path d="M64 832H128V896H64V832Z" />
                    </mask>
                    <path d="M64 832H128V896H64V832Z" fill="#F2F4F7" />
                    <path
                        d="M128 896V897H129V896H128ZM127 832V896H129V832H127ZM128 895H64V897H128V895Z"
                        fill="#D0D5DD"
                        mask="url(#path-395-inside-197_4940_405682)"
                    />
                    <mask id="path-397-inside-198_4940_405682" fill="white">
                        <path d="M128 832H192V896H128V832Z" />
                    </mask>
                    <path
                        d="M192 896V897H193V896H192ZM191 832V896H193V832H191ZM192 895H128V897H192V895Z"
                        fill="#D0D5DD"
                        mask="url(#path-397-inside-198_4940_405682)"
                    />
                    <mask id="path-399-inside-199_4940_405682" fill="white">
                        <path d="M192 832H256V896H192V832Z" />
                    </mask>
                    <path
                        d="M256 896V897H257V896H256ZM255 832V896H257V832H255ZM256 895H192V897H256V895Z"
                        fill="#D0D5DD"
                        mask="url(#path-399-inside-199_4940_405682)"
                    />
                    <mask id="path-401-inside-200_4940_405682" fill="white">
                        <path d="M256 832H320V896H256V832Z" />
                    </mask>
                    <path
                        d="M320 896V897H321V896H320ZM319 832V896H321V832H319ZM320 895H256V897H320V895Z"
                        fill="#D0D5DD"
                        mask="url(#path-401-inside-200_4940_405682)"
                    />
                    <mask id="path-403-inside-201_4940_405682" fill="white">
                        <path d="M320 832H384V896H320V832Z" />
                    </mask>
                    <path
                        d="M384 896V897H385V896H384ZM383 832V896H385V832H383ZM384 895H320V897H384V895Z"
                        fill="#D0D5DD"
                        mask="url(#path-403-inside-201_4940_405682)"
                    />
                    <mask id="path-405-inside-202_4940_405682" fill="white">
                        <path d="M384 832H448V896H384V832Z" />
                    </mask>
                    <path
                        d="M448 896V897H449V896H448ZM447 832V896H449V832H447ZM448 895H384V897H448V895Z"
                        fill="#D0D5DD"
                        mask="url(#path-405-inside-202_4940_405682)"
                    />
                    <mask id="path-407-inside-203_4940_405682" fill="white">
                        <path d="M448 832H512V896H448V832Z" />
                    </mask>
                    <path
                        d="M512 896V897H513V896H512ZM511 832V896H513V832H511ZM512 895H448V897H512V895Z"
                        fill="#D0D5DD"
                        mask="url(#path-407-inside-203_4940_405682)"
                    />
                    <mask id="path-409-inside-204_4940_405682" fill="white">
                        <path d="M512 832H576V896H512V832Z" />
                    </mask>
                    <path
                        d="M576 896V897H577V896H576ZM575 832V896H577V832H575ZM576 895H512V897H576V895Z"
                        fill="#D0D5DD"
                        mask="url(#path-409-inside-204_4940_405682)"
                    />
                    <mask id="path-411-inside-205_4940_405682" fill="white">
                        <path d="M576 832H640V896H576V832Z" />
                    </mask>
                    <path
                        d="M640 896V897H641V896H640ZM639 832V896H641V832H639ZM640 895H576V897H640V895Z"
                        fill="#D0D5DD"
                        mask="url(#path-411-inside-205_4940_405682)"
                    />
                    <mask id="path-413-inside-206_4940_405682" fill="white">
                        <path d="M640 832H704V896H640V832Z" />
                    </mask>
                    <path d="M640 832H704V896H640V832Z" fill="#F2F4F7" />
                    <path
                        d="M704 896V897H705V896H704ZM703 832V896H705V832H703ZM704 895H640V897H704V895Z"
                        fill="#D0D5DD"
                        mask="url(#path-413-inside-206_4940_405682)"
                    />
                    <mask id="path-415-inside-207_4940_405682" fill="white">
                        <path d="M704 832H768V896H704V832Z" />
                    </mask>
                    <path
                        d="M768 896V897H769V896H768ZM767 832V896H769V832H767ZM768 895H704V897H768V895Z"
                        fill="#D0D5DD"
                        mask="url(#path-415-inside-207_4940_405682)"
                    />
                    <mask id="path-417-inside-208_4940_405682" fill="white">
                        <path d="M768 832H832V896H768V832Z" />
                    </mask>
                    <path
                        d="M832 896V897H833V896H832ZM831 832V896H833V832H831ZM832 895H768V897H832V895Z"
                        fill="#D0D5DD"
                        mask="url(#path-417-inside-208_4940_405682)"
                    />
                    <mask id="path-419-inside-209_4940_405682" fill="white">
                        <path d="M832 832H896V896H832V832Z" />
                    </mask>
                    <path
                        d="M896 896V897H897V896H896ZM895 832V896H897V832H895ZM896 895H832V897H896V895Z"
                        fill="#D0D5DD"
                        mask="url(#path-419-inside-209_4940_405682)"
                    />
                    <mask id="path-421-inside-210_4940_405682" fill="white">
                        <path d="M896 832H960V896H896V832Z" />
                    </mask>
                    <path
                        d="M960 896V897H961V896H960ZM959 832V896H961V832H959ZM960 895H896V897H960V895Z"
                        fill="#D0D5DD"
                        mask="url(#path-421-inside-210_4940_405682)"
                    />
                    <mask id="path-423-inside-211_4940_405682" fill="white">
                        <path d="M0 896H64V960H0V896Z" />
                    </mask>
                    <path d="M64 960V961H65V960H64ZM63 896V960H65V896H63ZM64 959H0V961H64V959Z" fill="#D0D5DD" mask="url(#path-423-inside-211_4940_405682)" />
                    <mask id="path-425-inside-212_4940_405682" fill="white">
                        <path d="M64 896H128V960H64V896Z" />
                    </mask>
                    <path
                        d="M128 960V961H129V960H128ZM127 896V960H129V896H127ZM128 959H64V961H128V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-425-inside-212_4940_405682)"
                    />
                    <mask id="path-427-inside-213_4940_405682" fill="white">
                        <path d="M128 896H192V960H128V896Z" />
                    </mask>
                    <path
                        d="M192 960V961H193V960H192ZM191 896V960H193V896H191ZM192 959H128V961H192V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-427-inside-213_4940_405682)"
                    />
                    <mask id="path-429-inside-214_4940_405682" fill="white">
                        <path d="M192 896H256V960H192V896Z" />
                    </mask>
                    <path
                        d="M256 960V961H257V960H256ZM255 896V960H257V896H255ZM256 959H192V961H256V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-429-inside-214_4940_405682)"
                    />
                    <mask id="path-431-inside-215_4940_405682" fill="white">
                        <path d="M256 896H320V960H256V896Z" />
                    </mask>
                    <path
                        d="M320 960V961H321V960H320ZM319 896V960H321V896H319ZM320 959H256V961H320V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-431-inside-215_4940_405682)"
                    />
                    <mask id="path-433-inside-216_4940_405682" fill="white">
                        <path d="M320 896H384V960H320V896Z" />
                    </mask>
                    <path
                        d="M384 960V961H385V960H384ZM383 896V960H385V896H383ZM384 959H320V961H384V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-433-inside-216_4940_405682)"
                    />
                    <mask id="path-435-inside-217_4940_405682" fill="white">
                        <path d="M384 896H448V960H384V896Z" />
                    </mask>
                    <path
                        d="M448 960V961H449V960H448ZM447 896V960H449V896H447ZM448 959H384V961H448V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-435-inside-217_4940_405682)"
                    />
                    <mask id="path-437-inside-218_4940_405682" fill="white">
                        <path d="M448 896H512V960H448V896Z" />
                    </mask>
                    <path d="M448 896H512V960H448V896Z" fill="#F2F4F7" />
                    <path
                        d="M512 960V961H513V960H512ZM511 896V960H513V896H511ZM512 959H448V961H512V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-437-inside-218_4940_405682)"
                    />
                    <mask id="path-439-inside-219_4940_405682" fill="white">
                        <path d="M512 896H576V960H512V896Z" />
                    </mask>
                    <path
                        d="M576 960V961H577V960H576ZM575 896V960H577V896H575ZM576 959H512V961H576V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-439-inside-219_4940_405682)"
                    />
                    <mask id="path-441-inside-220_4940_405682" fill="white">
                        <path d="M576 896H640V960H576V896Z" />
                    </mask>
                    <path
                        d="M640 960V961H641V960H640ZM639 896V960H641V896H639ZM640 959H576V961H640V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-441-inside-220_4940_405682)"
                    />
                    <mask id="path-443-inside-221_4940_405682" fill="white">
                        <path d="M640 896H704V960H640V896Z" />
                    </mask>
                    <path
                        d="M704 960V961H705V960H704ZM703 896V960H705V896H703ZM704 959H640V961H704V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-443-inside-221_4940_405682)"
                    />
                    <mask id="path-445-inside-222_4940_405682" fill="white">
                        <path d="M704 896H768V960H704V896Z" />
                    </mask>
                    <path
                        d="M768 960V961H769V960H768ZM767 896V960H769V896H767ZM768 959H704V961H768V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-445-inside-222_4940_405682)"
                    />
                    <mask id="path-447-inside-223_4940_405682" fill="white">
                        <path d="M768 896H832V960H768V896Z" />
                    </mask>
                    <path
                        d="M832 960V961H833V960H832ZM831 896V960H833V896H831ZM832 959H768V961H832V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-447-inside-223_4940_405682)"
                    />
                    <mask id="path-449-inside-224_4940_405682" fill="white">
                        <path d="M832 896H896V960H832V896Z" />
                    </mask>
                    <path
                        d="M896 960V961H897V960H896ZM895 896V960H897V896H895ZM896 959H832V961H896V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-449-inside-224_4940_405682)"
                    />
                    <mask id="path-451-inside-225_4940_405682" fill="white">
                        <path d="M896 896H960V960H896V896Z" />
                    </mask>
                    <path d="M896 896H960V960H896V896Z" fill="#F2F4F7" />
                    <path
                        d="M960 960V961H961V960H960ZM959 896V960H961V896H959ZM960 959H896V961H960V959Z"
                        fill="#D0D5DD"
                        mask="url(#path-451-inside-225_4940_405682)"
                    />
                </g>
                <rect x="0.5" y="0.5" width="959" height="959" stroke="#D0D5DD" />
            </g>
            <defs>
                <radialGradient
                    id="paint0_radial_4940_405682"
                    cx="0"
                    cy="0"
                    r="1"
                    gradientUnits="userSpaceOnUse"
                    gradientTransform="translate(480 -0.000114441) rotate(90) scale(960 501.059)"
                >
                    <stop />
                    <stop offset="0.953125" stopOpacity="0" />
                </radialGradient>
                <clipPath id="clip0_4940_405682">
                    <rect width="960" height="960" fill="white" />
                </clipPath>
            </defs>
        </svg>
    );
};

const sizes = {
    sm,
    md,
};
