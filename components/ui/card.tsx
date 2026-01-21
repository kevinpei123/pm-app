"use client";

import { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return <div className={`rounded-xl border border-zinc-200 bg-white p-4 ${className}`} {...props} />;
}
