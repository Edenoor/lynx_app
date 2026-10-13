// src/Presentation/views/picker/pickerOutcome.ts
// Lo que ve el operador por cada lectura: color, título y detalle. Separado de
// la pantalla para que los textos se puedan verificar sin dibujarla.

import { OPS_LABEL } from "../driver/routes/routesApi";
import { ReceiveStatus, ScanOutcome } from "./pickerScan";

export type OutcomeTone = "success" | "neutral" | "warning" | "danger";

export type OutcomeView = {
  tone: OutcomeTone;
  title: string;
  // Estantería en grande, cuando el paquete quedó (o está) en una.
  shelf: string | null;
  lines: string[];
  warnings: string[];
  // Contenido leído por la cámara, para copiar y analizar la etiqueta.
  raw: string | null;
};

const opsLabel = (s: string | null | undefined) => (s ? OPS_LABEL[s] ?? s : "desconocido");
const joined = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

// Alertas que ya se explican con el título o con otra línea.
const EXPLAINED_ALERTS = new Set(["CLOSED", "IN_ROUTE", "SHELF_MISMATCH"]);

const RECEIVE_TITLES: Record<ReceiveStatus, { tone: OutcomeTone; title: string }> = {
  received: { tone: "success", title: "Ingresó a planta" },
  alreadyHere: { tone: "success", title: "Ya estaba en planta" },
  closed: { tone: "neutral", title: "Envío cerrado: no vuelve a planta" },
  inRoute: { tone: "warning", title: "Asignado a un recorrido: no se reestantea" },
  unchanged: { tone: "neutral", title: "Sin cambios" },
};

function errorTitle(o: Extract<ScanOutcome, { kind: "error" }>): string {
  const receive = o.operation === "receive";
  switch (o.category) {
    case "identification":
      if (!receive) return "No reconocemos esa estantería";
      if (o.status === 404) return "El envío no está en Lynx";
      if (o.status === 422) return "No se pudo dar de alta el envío";
      return "No reconocemos esta etiqueta";
    case "conflict":
      return receive ? "No se puede recibir este envío" : "No se puede mover a esa estantería";
    case "access":
      return o.status === 401 ? "Tu sesión expiró" : "Tu usuario no puede operar acá";
    case "server":
      return receive
        ? "Error del servidor: no se pudo confirmar la recepción"
        : "Error del servidor: no se pudo confirmar el movimiento";
  }
}

export function presentOutcome(outcome: ScanOutcome, warehouse: string): OutcomeView {
  const base = { shelf: null, lines: [], warnings: [], raw: null };

  switch (outcome.kind) {
    case "unknown":
      return { ...base, tone: "warning", title: "Sin respuesta del servidor", lines: [outcome.message] };

    case "sequence":
      return { ...base, tone: "warning", title: outcome.message };

    case "moved":
      return {
        ...base,
        tone: "success",
        title: `Movido a ${outcome.to}`,
        shelf: outcome.to,
        lines: [
          `${outcome.tracking ?? "Paquete"} movido${outcome.from ? ` de ${outcome.from}` : ""} a ${outcome.to}.`,
          warehouse,
        ],
      };

    case "error":
      return {
        ...base,
        tone: "danger",
        title: errorTitle(outcome),
        lines: [outcome.message],
        warnings:
          outcome.category === "server" ? ["Si se repite, copiá el contenido y avisá a soporte."] : [],
        raw: outcome.raw,
      };

    case "received": {
      const { status, result } = outcome;
      const { delivery, shelf, ops, alerts } = result;
      const { tone, title } = RECEIVE_TITLES[status];
      const lines = [joined(delivery.tracking, delivery.store), joined(delivery.receiver, delivery.postal_code ? `CP ${delivery.postal_code}` : null)];
      const warnings: string[] = [];

      if (status === "closed" || status === "unchanged" || status === "inRoute") {
        lines.push(`Estado: ${opsLabel(ops.from)}`);
      }
      if (status === "inRoute") {
        const text = alerts.find((a) => a.code === "IN_ROUTE")?.text;
        if (text) warnings.push(text);
      }
      if (status === "alreadyHere" && shelf?.suggested && shelf.suggested !== shelf.code) {
        warnings.push(`Está en ${shelf.code}; por su CP le corresponde ${shelf.suggested}.`);
      }
      for (const a of alerts) if (!EXPLAINED_ALERTS.has(a.code)) warnings.push(a.text);
      lines.push(warehouse);

      // La estantería en grande solo cuando el paquete queda en planta.
      const onShelf = status === "received" || status === "alreadyHere";
      return { ...base, tone, title, shelf: onShelf ? shelf?.code ?? null : null, lines: lines.filter(Boolean), warnings };
    }
  }
}
