import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Hop as Home, ArrowLeft } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const navigate = useNavigate();

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Go back"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>
      <span className="text-muted-foreground/40">/</span>
      <Link to="/admin" className="flex items-center gap-1 transition-colors hover:text-foreground" aria-label="Dashboard">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          {item.href ? (
            <Link to={item.href} className="transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
