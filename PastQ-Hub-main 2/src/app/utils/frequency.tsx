import { Flame, Pin, Zap } from "lucide-react";

export function freqMeta(n: number): { label: string; cls: string; icon: "flame" | "zap" | "pin" } {
  if (n >= 10) return { label: `${n}× — Very High`, cls: "bg-red-100 text-red-600", icon: "flame" };
  if (n >= 7) return { label: `${n}× — High`, cls: "bg-amber-100 text-amber-700", icon: "zap" };
  return { label: `${n}× — Moderate`, cls: "bg-blue-100 text-blue-600", icon: "pin" };
}

export function FreqIcon({ type }: { type: "flame" | "zap" | "pin" }) {
  if (type === "flame") return <Flame size={11} />;
  if (type === "zap") return <Zap size={11} />;
  return <Pin size={11} />;
}
