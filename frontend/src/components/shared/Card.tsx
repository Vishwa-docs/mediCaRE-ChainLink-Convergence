"use client";

import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export default function Card({ children, className = "", onClick, hover = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800
        ${hover ? "cursor-pointer transition-shadow hover:shadow-md" : ""}
        ${className}`}
    >
      {children}
    </div>
  );
}
