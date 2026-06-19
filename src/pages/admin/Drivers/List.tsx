import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, KeyRound, Power, Eye, EyeOff } from "lucide-react";

interface Driver {
  id: string;
  name: string;
  surname: string;
  employee_number: string;
  mobile: string | null;
  active: boolean;
  hasActiveSession?: boolean;
}

type FormErrors = Partial<Record<"name" | "surname" | "employee_number" | "pin", string>>;

function validateDriverForm(
  form: { name: string; surname: string; employee_number: string; pin: string },
  isEditing: boolean,
): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "First name is required.";
  if (!form.surname.trim()) errors.surname = "Surname is required.";
  if (!form.employee_number.trim()) errors.employee_number = "Driver ID is required.";
  if (!isEditing && !form.pin) {
    errors.pin = "PIN is required for new drivers.";
  } else if (form.pin && (form.pin.length < 4 || form.pin.length > 6)) {
    errors.pin = "PIN must be 4–6 digits.";
  }
  return errors;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive">{msg}</p>;
}

export default function AdminDrivers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [form, setForm] = useState({ name: "", surname: "", employee_number: "", mobile: "", pin: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [changingPin, setChangingPin] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const { data } = useQuery<Driver[]>({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, name, surname, employee_number, mobile, active, vehicle_sessions(id, status)")
        .order("surname");
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        hasActiveSession: (d.vehicle_sessions || []).some((s: any) => s.status === "active"),
      }));
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const errs = validateDriverForm(form, !!editing);
      if (Object.keys(errs).length) {
        setErrors(errs);
        setTouched(new Set(Object.keys(errs)));
        throw new Error("validation");
      }
      if (editing) {
        const { error } = await supabase
          .from("drivers")
          .update({ name: form.name.trim(), surname: form.surname.trim(), employee_number: form.employee_number.trim(), mobile: form.mobile.trim() || null })
          .eq("id", editing.id);
        if (error) throw error;
        if (form.pin) {
          const { error: pErr } = await supabase.rpc("set_driver_pin", { p_driver_id: editing.id, p_pin: form.pin });
          if (pErr) throw pErr;
        }
      } else {
        const { data: created, error } = await supabase.rpc("create_driver", {
          p_name: form.name.trim(),
          p_surname: form.surname.trim(),
          p_employee_number: form.employee_number.trim(),
          p_pin: form.pin,
        });
        if (error) throw error;
        if (form.mobile.trim() && created) {
          await supabase.from("drivers").update({ mobile: form.mobile.trim() }).eq("id", created);
        }
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Driver updated" : "Driver added");
      setOpen(false);
      setEditing(null);
      setForm({ name: "", surname: "", employee_number: "", mobile: "", pin: "" });
      qc.invalidateQueries({ queryKey: ["drivers"] });
    },
    onError: (e: Error) => {
      if (e.message !== "validation") toast.error(e.message);
    },
  });

  const toggle = useMutation({
    mutationFn: async (d: Driver) => {
      const { error } = await supabase.from("drivers").update({ active: !d.active }).eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drivers"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (data || []).filter((d) =>
    `${d.name} ${d.surname} ${d.employee_number}`.toLowerCase().includes(search.toLowerCase()),
  );

  function openNew() {
    setEditing(null);
    setForm({ name: "", surname: "", employee_number: "", mobile: "", pin: "" });
    setErrors({});
    setTouched(new Set());
    setChangingPin(false);
    setShowPin(false);
    setOpen(true);
  }
  function openEdit(d: Driver) {
    setEditing(d);
    setForm({ name: d.name, surname: d.surname, employee_number: d.employee_number, mobile: d.mobile ?? "", pin: "" });
    setErrors({});
    setTouched(new Set());
    setChangingPin(false);
    setShowPin(false);
    setOpen(true);
  }

  function touch(field: string) {
    setTouched((prev) => new Set([...prev, field]));
    setErrors(validateDriverForm(form, !!editing));
  }

  function change<K extends keyof typeof form>(field: K, value: string) {
    const next = { ...form, [field]: value };
    setForm(next);
    if (touched.has(field)) {
      setErrors(validateDriverForm(next, !!editing));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drivers</h1>
          <p className="text-sm text-muted-foreground">Manage driver accounts and PINs</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> New driver
        </Button>
      </div>

      <Input placeholder="Search by name or ID…" value={search} onChange={(e) => setSearch(e.target.value)} />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Driver ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.employee_number}</TableCell>
                <TableCell>
                  <Link
                    to={`/admin/drivers/${d.id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {d.name} {d.surname}
                  </Link>
                </TableCell>
                <TableCell>
                  {d.active ? (
                    d.hasActiveSession ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        Inactive
                      </span>
                    )
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </TableCell>
                <TableCell className="space-x-1 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                    <KeyRound className="mr-1 h-3.5 w-3.5" /> Edit / Reset PIN
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate(d)}>
                    <Power className="mr-1 h-3.5 w-3.5" /> {d.active ? "Disable" : "Enable"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No drivers
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit driver" : "Add driver"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update driver details. Leave PIN blank to keep the existing one."
                : "Fill in all required fields to create a driver account."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="d-name">
                  First name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="d-name"
                  value={form.name}
                  placeholder="e.g. John"
                  onChange={(e) => change("name", e.target.value)}
                  onBlur={() => touch("name")}
                  aria-invalid={!!errors.name}
                />
                <FieldError msg={touched.has("name") ? errors.name : undefined} />
              </div>
              <div>
                <Label htmlFor="d-surname">
                  Surname <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="d-surname"
                  value={form.surname}
                  placeholder="e.g. Smith"
                  onChange={(e) => change("surname", e.target.value)}
                  onBlur={() => touch("surname")}
                  aria-invalid={!!errors.surname}
                />
                <FieldError msg={touched.has("surname") ? errors.surname : undefined} />
              </div>
            </div>

            {/* Driver ID */}
            <div>
              <Label htmlFor="d-empnum">
                Driver ID (employee number) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="d-empnum"
                value={form.employee_number}
                placeholder="e.g. EMP001"
                onChange={(e) => change("employee_number", e.target.value)}
                onBlur={() => touch("employee_number")}
                aria-invalid={!!errors.employee_number}
              />
              <FieldError msg={touched.has("employee_number") ? errors.employee_number : undefined} />
            </div>

            {/* Mobile */}
            <div>
              <Label htmlFor="d-mobile">
                Mobile <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="d-mobile"
                type="tel"
                inputMode="tel"
                value={form.mobile}
                placeholder="e.g. +27 82 000 0000"
                onChange={(e) => change("mobile", e.target.value)}
              />
            </div>

            {/* PIN — always shown for new; progressive disclosure for edit */}
            {editing ? (
              <div>
                {!changingPin ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setChangingPin(true)}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Change PIN
                  </Button>
                ) : (
                  <div>
                    <Label htmlFor="d-pin">
                      New PIN <span className="text-xs text-muted-foreground font-normal">(4–6 digits)</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="d-pin"
                        type={showPin ? "text" : "password"}
                        inputMode="numeric"
                        maxLength={6}
                        value={form.pin}
                        placeholder="••••"
                        className="pr-10"
                        onChange={(e) => change("pin", e.target.value.replace(/\D/g, ""))}
                        onBlur={() => touch("pin")}
                        aria-invalid={!!errors.pin}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPin ? "Hide PIN" : "Show PIN"}
                      >
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <FieldError msg={touched.has("pin") ? errors.pin : undefined} />
                    <button
                      type="button"
                      onClick={() => { setChangingPin(false); change("pin", ""); }}
                      className="mt-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      Cancel PIN change
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <Label htmlFor="d-pin">
                  PIN <span className="text-destructive">*</span>{" "}
                  <span className="text-xs text-muted-foreground font-normal">(4–6 digits)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="d-pin"
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={6}
                    value={form.pin}
                    placeholder="••••"
                    className="pr-10"
                    onChange={(e) => change("pin", e.target.value.replace(/\D/g, ""))}
                    onBlur={() => touch("pin")}
                    aria-invalid={!!errors.pin}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPin ? "Hide PIN" : "Show PIN"}
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FieldError msg={touched.has("pin") ? errors.pin : undefined} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Add driver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
