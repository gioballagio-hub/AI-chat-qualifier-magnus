interface BadgeProps {
  children: React.ReactNode;
  variant?: "caldo" | "tiepido" | "freddo" | "alta" | "media" | "bassa" | "new" | "contacted" | "archived" | "default";
  className?: string;
}

const variantClasses = {
  caldo: "bg-red-100 text-red-800 border border-red-200",
  tiepido: "bg-amber-100 text-amber-800 border border-amber-200",
  freddo: "bg-blue-100 text-blue-800 border border-blue-200",
  alta: "bg-red-100 text-red-800 border border-red-200",
  media: "bg-amber-100 text-amber-800 border border-amber-200",
  bassa: "bg-blue-100 text-blue-800 border border-blue-200",
  new: "bg-green-100 text-green-800 border border-green-200",
  contacted: "bg-purple-100 text-purple-800 border border-purple-200",
  archived: "bg-gray-100 text-gray-600 border border-gray-200",
  default: "bg-gray-100 text-gray-700 border border-gray-200",
};

export default function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
