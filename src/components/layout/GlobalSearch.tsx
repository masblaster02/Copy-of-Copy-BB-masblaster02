import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Car, Users, TriangleAlert as AlertTriangle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

interface SearchResult {
  type: "vehicle" | "driver" | "damage";
  id: string;
  label: string;
  sub: string;
  href: string;
}

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return dv;
}

async function runSearch(q: string): Promise<SearchResult[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const like = `%${term}%`;

  const [vRes, dRes, dmRes] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, registration_number, make, model, status")
      .or(`registration_number.ilike.${like},make.ilike.${like},model.ilike.${like}`)
      .eq("archived", false)
      .limit(5),
    supabase
      .from("drivers")
      .select("id, name, surname, employee_number, active")
      .or(`name.ilike.${like},surname.ilike.${like},employee_number.ilike.${like}`)
      .limit(5),
    supabase
      .from("damage_markers")
      .select("id, damage_type, description, status, vehicle:vehicles(id, registration_number)")
      .or(`damage_type.ilike.${like},description.ilike.${like}`)
      .order("reported_at", { ascending: false })
      .limit(5),
  ]);

  const results: SearchResult[] = [];

  for (const v of vRes.data || []) {
    results.push({
      type: "vehicle",
      id: v.id,
      label: v.registration_number,
      sub: `${v.make} ${v.model} · ${v.status}`,
      href: `/admin/vehicles/${v.id}`,
    });
  }

  for (const d of dRes.data || []) {
    results.push({
      type: "driver",
      id: d.id,
      label: `${d.name} ${d.surname}`,
      sub: `${d.employee_number} · ${d.active ? "Active" : "Disabled"}`,
      href: `/admin/drivers`,
    });
  }

  for (const dm of dmRes.data || []) {
    const vehicle = dm.vehicle as { id: string; registration_number: string } | null;
    results.push({
      type: "damage",
      id: dm.id,
      label: `${dm.damage_type} — ${vehicle?.registration_number ?? "unknown"}`,
      sub: dm.description || dm.status,
      href: vehicle ? `/admin/vehicles/${vehicle.id}/blueprint` : `/admin/damages`,
    });
  }

  return results;
}

const TYPE_ICON = {
  vehicle: Car,
  driver: Users,
  damage: AlertTriangle,
};

const TYPE_LABEL = {
  vehicle: "Vehicles",
  driver: "Drivers",
  damage: "Damages",
};

export function GlobalSearch({ onNavigate }: { onNavigate?: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(query, 300);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    runSearch(debounced)
      .then((r) => {
        setResults(r);
        setOpen(true);
      })
      .finally(() => setLoading(false));
  }, [debounced]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function go(href: string) {
    setQuery("");
    setResults([]);
    setOpen(false);
    navigate(href);
    onNavigate?.();
  }

  // Group by type preserving order: vehicle → driver → damage
  const grouped: { type: SearchResult["type"]; items: SearchResult[] }[] = [];
  for (const type of ["vehicle", "driver", "damage"] as const) {
    const items = results.filter((r) => r.type === type);
    if (items.length) grouped.push({ type, items });
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search vehicles, drivers, damages…"
          className="pl-8 pr-8 h-9 text-sm"
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-card shadow-lg">
          {loading && (
            <p className="px-4 py-3 text-xs text-muted-foreground">Searching…</p>
          )}
          {!loading && grouped.length === 0 && query.length >= 2 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">No results for "{query}"</p>
          )}
          {!loading && grouped.map(({ type, items }) => {
            const Icon = TYPE_ICON[type];
            return (
              <div key={type}>
                <p className="flex items-center gap-1.5 border-t px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:border-t-0">
                  <Icon className="h-3 w-3" />
                  {TYPE_LABEL[type]}
                </p>
                {items.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => go(r.href)}
                    className="flex w-full flex-col px-4 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <span className="text-sm font-medium">{r.label}</span>
                    <span className="text-xs text-muted-foreground">{r.sub}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
