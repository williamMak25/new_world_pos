import { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
      <tr>{children}</tr>
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>;
}

export function TR({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={`transition-colors hover:bg-brand-50/50 ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </tr>
  );
}

export function TH({ children, align = "left", className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <th className={`px-4 py-3 ${align === "right" ? "text-right" : ""} ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TD({ children, align = "left", className = "", ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <td className={`px-4 py-3 ${align === "right" ? "text-right" : ""} ${className}`} {...props}>
      {children}
    </td>
  );
}

export function TEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-gray-500">
        {children}
      </td>
    </tr>
  );
}
