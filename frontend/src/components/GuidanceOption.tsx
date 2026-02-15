import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GuidanceOptionProps {
  id: string;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

export default function GuidanceOption({ id, title, description, selected, onClick }: GuidanceOptionProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200",
        selected 
          ? "border-indigo-400 bg-indigo-50/30" 
          : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
      )}
    >
      <div className="flex items-center justify-center">
        <div className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center",
          selected ? "border-indigo-500" : "border-slate-300"
        )}>
          {selected && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
        </div>
      </div>
      <div className="flex flex-col">
        <div className="text-sm font-semibold text-slate-900">
          {title} <span className="text-slate-500 font-normal">{description}</span>
        </div>
      </div>
    </div>
  );
}