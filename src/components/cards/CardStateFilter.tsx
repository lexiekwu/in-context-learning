"use client";

import { cn } from "@/lib/cn";
import type { CardState } from "@/types";

const STATES: { value: CardState; label: string; color: string; activeColor: string }[] = [
  {
    value: "NEW" as CardState,
    label: "New",
    color: "border-indigo-700 text-indigo-400",
    activeColor:
      "bg-indigo-900/40 border-indigo-500 text-indigo-300",
  },
  {
    value: "LEARNING" as CardState,
    label: "Learning",
    color: "border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400",
    activeColor:
      "bg-yellow-100 border-yellow-500 text-yellow-800 dark:bg-yellow-900/40 dark:border-yellow-500 dark:text-yellow-300",
  },
  {
    value: "REVIEW" as CardState,
    label: "Review",
    color: "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400",
    activeColor:
      "bg-green-100 border-green-500 text-green-800 dark:bg-green-900/40 dark:border-green-500 dark:text-green-300",
  },
  {
    value: "RELEARNING" as CardState,
    label: "Relearning",
    color: "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400",
    activeColor:
      "bg-red-100 border-red-500 text-red-800 dark:bg-red-900/40 dark:border-red-500 dark:text-red-300",
  },
];

interface CardStateFilterProps {
  selected: CardState[];
  onChange: (states: CardState[]) => void;
}

export default function CardStateFilter({
  selected,
  onChange,
}: CardStateFilterProps) {
  function toggle(state: CardState) {
    if (selected.includes(state)) {
      onChange(selected.filter((s) => s !== state));
    } else {
      onChange([...selected, state]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {STATES.map((s) => {
        const isActive = selected.includes(s.value);
        return (
          <button
            key={s.value}
            type="button"
            onClick={() => toggle(s.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              isActive ? s.activeColor : s.color,
              !isActive && "hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
