import React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
  fill?: string;
}

export default function Logo({
  size = 32,
  color = "currentColor",
  className = "",
  ...props
}: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="4 1 112 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AnonVerdict Shield & Gavel Logo"
      {...props}
    >
      {/* Outer Shield & Insignia Group */}
      <g fill={color}>
        {/* Shield Border Contour */}
        <path
          d="M60 6 L98 22 C98 52 82 86 60 108 C38 86 22 52 22 22 Z"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinejoin="round"
        />

        {/* Left 'A' Leg */}
        <path
          d="M48 28 L30 82 L42 82 L48 64 L58 48 Z"
          fill={color}
        />

        {/* Gavel Head and Handle */}
        {/* Handle */}
        <path
          d="M38 68 L70 42 L66 38 L34 64 Z"
          fill={color}
        />
        {/* Gavel Hammer Head */}
        <rect
          x="64"
          y="28"
          width="18"
          height="12"
          rx="3"
          transform="rotate(40 73 34)"
          fill={color}
        />

        {/* 'V' Right Arm with Upward Arrow */}
        <path
          d="M46 76 L60 92 L76 56 L68 52 L60 74 L52 64 Z"
          fill={color}
        />
        {/* Arrow Head on Right Arm */}
        <path
          d="M82 24 L96 46 L82 44 L78 52 L72 38 L84 38 Z"
          fill={color}
        />
      </g>
    </svg>
  );
}
