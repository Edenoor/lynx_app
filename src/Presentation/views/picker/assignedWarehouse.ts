// Depósito asignado del ADMIN en el depósito (auditoría 19-nov, APP-04): sin
// uno activo no se opera; la app lo dice en vez de mostrar el principal.
export type AssignedWarehouse = { id: number; name: string | null; active: boolean };

// undefined = servidor anterior que no lo informa: no se muestra ningún aviso.
export const assignedWarehouseProblem = (assigned: AssignedWarehouse | null | undefined): string | null => {
  if (assigned === undefined) return null;
  if (assigned === null) return "No tenés un depósito asignado: pedíselo a quien da accesos.";
  if (!assigned.active) return `Tu depósito asignado (${assigned.name ?? `#${assigned.id}`}) está inactivo: pedí que te asignen otro.`;
  return null;
};
