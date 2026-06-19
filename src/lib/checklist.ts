export const CHECKLIST_ITEMS = [
  "Tyres (tread, pressure, damage)",
  "Lights (head, brake, indicators)",
  "Windows & mirrors",
  "Wipers & washer fluid",
  "Body damage (exterior walk-around)",
  "Fluid leaks underneath",
  "Fuel / charge level",
  "Dashboard warning lights",
  "Brakes feel",
  "Horn",
  "Seatbelts & interior cleanliness",
] as const;

export type ChecklistItem = (typeof CHECKLIST_ITEMS)[number];
