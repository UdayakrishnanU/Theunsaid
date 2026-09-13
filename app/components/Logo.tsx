import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
  /** Accepted for backward compatibility with existing call sites; the
   * raster logo carries its own colors, so this is currently unused. */
  color?: string;
}

export default function Logo({ size = 32, className = "" }: LogoProps) {
  return (
    <img
      src="/anonverdict-logo.png"
      width={size}
      height={size}
      alt="AnonVerdict logo"
      className={className}
      style={{ objectFit: "contain", display: "inline-block" }}
    />
  );
}
