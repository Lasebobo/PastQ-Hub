const DEPT_COLORS: Record<string, string> = {
  "Computer Science & Engineering": "bg-blue-600",
  "Mathematics": "bg-purple-600",
  "Physics": "bg-green-600",
  "Chemistry": "bg-orange-600",
  "Biology": "bg-teal-600",
  "Statistics": "bg-pink-600",
};

export function deptColor(dept: string) { return DEPT_COLORS[dept] || "bg-gray-600"; }
