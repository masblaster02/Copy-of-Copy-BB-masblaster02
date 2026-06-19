import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Plus, Archive, Image, TriangleAlert as AlertTriangle } from "lucide-react";

const CURRENT_YEAR = new Date().getFullYear();

type FormErrors = Partial<Record<"registration_number" | "make" | "model" | "year", string>>;

function validateVehicleForm(form: {
  registration_number: string;
  make: string;
  model: string;
  year: string;
}): FormErrors {
  const errors: FormErrors = {};
  if (!form.registration_number.trim()) errors.registration_number = "Registration number is required.";
  if (!form.make.trim()) errors.make = "Make is required.";
  if (!form.model.trim()) errors.model = "Model is required.";
  if (form.year) {
    const y = parseInt(form.year);
    if (isNaN(y) || y < 1900 || y > CURRENT_YEAR + 1)
      errors.year = `Enter a year between 1900 and ${CURRENT_YEAR + 1}.`;
  }
  return errors;
}

interface Vehicle {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  year: number | null;
  vin: string | null;
  status: string;
  archived: boolean;
  open_damage_count?: number;
  last_used_at?: string | null;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive">{msg}</p>;
}

export default function AdminVehicles() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({
    registration_number: "",
    make: "",
    model: "",
    year: String(CURRENT_YEAR),
    vin: "",
    status: "available",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const { data } = useQuery<Vehicle[]>({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_summary")
        .select("id, registration_number, make, model, year, vin, status, archived, open_damage_count, last_used_at")
        .order("registration_number");
      if (error) throw error;
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const errs = validateVehicleForm(form);
      if (Object.keys(errs).length) {
        setErrors(errs);
        setTouched(new Set(Object.keys(errs)));
        throw new Error("Please fix the errors above.");
      }
      const payload = {
        registration_number: form.registration_number.trim().toUpperCase(),
        make: form.make.trim(),
        model: form.model.trim(),
        year: form.year ? parseInt(form.year) : null,
        vin: form.vin.trim() || null,
        status: form.status,
      };
      if (editing) {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Vehicle updated" : "Vehicle added");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: (e: Error) => {
      if (e.message !== "Please fix the errors above.") toast.error(e.message);
    },
  });

  const archive = useMutation({
    mutationFn: async (v: Vehicle) => {
      const { error } = await supabase
        .from("vehicles")
        .update({ archived: !v.archived, status: !v.archived ? "archived" : "available" })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });

  function openNew() {
    setEditing(null);
    setForm({ registration_number: "", make: "", model: "", year: String(CURRENT_YEAR), vin: "", status: "available" });
    setErrors({});
    setTouched(new Set());
    setOpen(true);
  }
  function openEdit(v: Vehicle) {
    setEditing(v);
    setForm({
      registration_number: v.registration_number,
      make: v.make,
      model: v.model,
      year: v.year?.toString() ?? "",
      vin: v.vin ?? "",
      status: v.status,
    });
    setErrors({});
    setTouched(new Set());
    setOpen(true);
  }

  function touch(field: string) {
    setTouched((prev) => new Set([...prev, field]));
    const errs = validateVehicleForm(form);
    setErrors(errs);
  }

  function change<K extends keyof typeof form>(field: K, value: string) {
    const next = { ...form, [field]: value };
    setForm(next);
    if (touched.has(field)) {
      setErrors(validateVehicleForm(next));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vehicles</h1>
          <p className="text-sm text-muted-foreground">Manage the fleet</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> New vehicle
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reg</TableHead>
              <TableHead>Make / Model</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Open Damages</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data || []).map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">
                  <Link
                    to={`/admin/vehicles/${v.id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {v.registration_number}
                  </Link>
                </TableCell>
                <TableCell>
                  {v.make} {v.model}
                </TableCell>
                <TableCell>{v.year ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={v.status === "available" ? "default" : "secondary"} className="capitalize">
                    {v.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {(v.open_damage_count ?? 0) > 0 ? (
                    <Link to={`/admin/vehicles/${v.id}`} className="flex items-center gap-1 text-sm font-medium text-destructive hover:underline underline-offset-4">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {v.open_damage_count}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {v.last_used_at ? new Date(v.last_used_at).toLocaleDateString() : "Never"}
                </TableCell>
                <TableCell className="space-x-1 text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/admin/vehicles/${v.id}/blueprint`}>
                      <Image className="mr-1 h-3.5 w-3.5" /> Manage
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(v)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => archive.mutate(v)}>
                    <Archive className="mr-1 h-3.5 w-3.5" /> {v.archived ? "Restore" : "Archive"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update vehicle details." : "Fill in the required fields to add a vehicle to the fleet."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {/* Registration */}
            <div>
              <Label htmlFor="v-reg">
                Registration number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="v-reg"
                value={form.registration_number}
                placeholder="e.g. ABC 123 GP"
                autoCapitalize="characters"
                onChange={(e) => change("registration_number", e.target.value)}
                onBlur={() => touch("registration_number")}
                aria-invalid={!!errors.registration_number}
              />
              <FieldError msg={touched.has("registration_number") ? errors.registration_number : undefined} />
            </div>

            {/* Make + Model */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="v-make">
                  Make <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="v-make"
                  value={form.make}
                  placeholder="e.g. Toyota"
                  onChange={(e) => change("make", e.target.value)}
                  onBlur={() => touch("make")}
                  aria-invalid={!!errors.make}
                />
                <FieldError msg={touched.has("make") ? errors.make : undefined} />
              </div>
              <div>
                <Label htmlFor="v-model">
                  Model <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="v-model"
                  value={form.model}
                  placeholder="e.g. Hilux"
                  onChange={(e) => change("model", e.target.value)}
                  onBlur={() => touch("model")}
                  aria-invalid={!!errors.model}
                />
                <FieldError msg={touched.has("model") ? errors.model : undefined} />
              </div>
            </div>

            {/* Year + VIN */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="v-year">Year</Label>
                <Input
                  id="v-year"
                  type="number"
                  min={1900}
                  max={CURRENT_YEAR + 1}
                  value={form.year}
                  onChange={(e) => change("year", e.target.value)}
                  onBlur={() => touch("year")}
                  aria-invalid={!!errors.year}
                />
                <FieldError msg={touched.has("year") ? errors.year : undefined} />
              </div>
              <div>
                <Label htmlFor="v-vin">
                  VIN <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="v-vin"
                  value={form.vin}
                  placeholder="17-character code"
                  onChange={(e) => change("vin", e.target.value)}
                />
              </div>
            </div>

            {/* Status — only shown when editing */}
            {editing && (
              <div>
                <Label htmlFor="v-status">Status</Label>
                <Select value={form.status} onValueChange={(v) => change("status", v)}>
                  <SelectTrigger id="v-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="maintenance">In maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Add vehicle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
