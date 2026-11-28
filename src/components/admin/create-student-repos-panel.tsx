"use client";

import { Plus } from "lucide-react";

/** Kept as the shared entry point for both the header and sidebar. */
export function CreateStudentReposPanel({
  orgName,
  trigger = "button",
  navClassName = "",
  hideClassName = "",
}: {
  orgName: string;
  trigger?: "button" | "nav";
  navClassName?: string;
  hideClassName?: string;
}) {
  return (
    <a
      href={`/admin/assignments/new?org=${encodeURIComponent(orgName)}`}
      target="_blank"
      rel="noreferrer"
      className={
        trigger === "nav"
          ? navClassName
          : "inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-3 text-[13px] font-semibold text-white transition hover:brightness-110"
      }
    >
      <Plus
        className={trigger === "nav" ? "h-[18px] w-[18px] shrink-0" : "h-4 w-4"}
      />
      <span
        className={`whitespace-nowrap ${trigger === "nav" ? hideClassName : ""}`}
      >
        과제 생성
      </span>
    </a>
  );
}
