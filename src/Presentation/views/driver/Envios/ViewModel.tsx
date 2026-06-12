// src/Presentation/views/driver/Envios/ViewModel.tsx

import { useContext, useEffect, useMemo, useState } from "react";
import { UserContext } from "../../../context/UserContext";
import { ApiDelivery } from "../../../../Data/sources/remote/api/ApiDelivery";

type LegacyUserLike = {
  username?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  legacyDriverName?: string | null;
  email?: string | null;
  token?: string | null;
};

type DriverPerformanceAnalytics = {
  eliteDeliveries: number;
  post21Delivered: number;
  post21Nobody: number;
  post21Rescheduled: number;
  post23Delivered: number;
  post23Nobody: number;
  post23Rescheduled: number;
  post23InTransit: number;
  delayedTotal: number;
};

const normalizeLegacyDriverName = (value: string): string => {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
};

const clean = (value?: string | null): string => {
  return String(value || "").replace(/\s+/g, " ").trim();
};

const normalizeText = (value?: unknown): string => {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const buildLegacyDriverNameCandidates = (
  user?: LegacyUserLike | null
): string[] => {
  if (!user) return [];

  const firstName = clean(user.first_name || user.firstName);
  const lastName = clean(user.last_name || user.lastName);
  const fullName = clean([firstName, lastName].filter(Boolean).join(" "));

  const rawCandidates = [
    clean(user.legacyDriverName),
    fullName,
    clean(user.name),
    clean(user.username),
    clean(user.email),
  ].filter(Boolean);

  const variants = rawCandidates.flatMap((value) => [
    value,
    normalizeLegacyDriverName(value),
    value.toUpperCase(),
  ]);

  return Array.from(new Set(variants));
};

const buildLegacyDriverName = (user?: LegacyUserLike | null): string => {
  return buildLegacyDriverNameCandidates(user)[0] || "";
};

const getRowStatus = (row: any): string => {
  return normalizeText(
    row?.estado ||
      row?.status ||
      row?.delivery_status ||
      row?.estado_envio ||
      row?.Estado
  );
};

const getRowStatusDate = (row: any): Date | null => {
  const value =
    row?.fecha_estado ||
    row?.fechaEstado ||
    row?.updated_at ||
    row?.updatedAt ||
    row?.Fecha_estado ||
    row?.["Fecha estado"];

  if (!value) return null;

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const raw = String(value).trim();

  const match = raw.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/
  );

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year =
    match[3].length === 2 ? Number(`20${match[3]}`) : Number(match[3]);
  const hour = Number(match[4] || 0);
  const minute = Number(match[5] || 0);

  const date = new Date(year, month, day, hour, minute);

  return Number.isNaN(date.getTime()) ? null : date;
};

const isDelivered = (status: string): boolean => status.includes("entregado");

const isNobody = (status: string): boolean => status.includes("nadie");

const isRescheduled = (status: string): boolean =>
  status.includes("reprogramado");

const isInTransit = (status: string): boolean =>
  status.includes("camino") ||
  status.includes("transito") ||
  status.includes("transit");

const isBefore21 = (date: Date | null): boolean => {
  if (!date) return false;
  return date.getHours() < 21;
};

const isPost21Pre23 = (date: Date | null): boolean => {
  if (!date) return false;
  const hour = date.getHours();
  return hour >= 21 && hour < 23;
};

const isPost23 = (date: Date | null): boolean => {
  if (!date) return false;
  return date.getHours() >= 23;
};

const buildEmptyPerformanceAnalytics = (): DriverPerformanceAnalytics => ({
  eliteDeliveries: 0,
  post21Delivered: 0,
  post21Nobody: 0,
  post21Rescheduled: 0,
  post23Delivered: 0,
  post23Nobody: 0,
  post23Rescheduled: 0,
  post23InTransit: 0,
  delayedTotal: 0,
});

const buildPerformanceAnalytics = (
  rows: any[]
): DriverPerformanceAnalytics => {
  return rows.reduce<DriverPerformanceAnalytics>((acc, row) => {
    const status = getRowStatus(row);
    const date = getRowStatusDate(row);

    const isElite = isDelivered(status) && isBefore21(date);

    const isPost21Valid =
      isPost21Pre23(date) &&
      (isDelivered(status) || isNobody(status) || isRescheduled(status));

    if (isElite) {
      acc.eliteDeliveries += 1;
      return acc;
    }

    if (isPost21Valid) {
      if (isDelivered(status)) acc.post21Delivered += 1;
      if (isNobody(status)) acc.post21Nobody += 1;
      if (isRescheduled(status)) acc.post21Rescheduled += 1;
      return acc;
    }

    acc.delayedTotal += 1;

    if (isPost23(date)) {
      if (isDelivered(status)) acc.post23Delivered += 1;
      if (isNobody(status)) acc.post23Nobody += 1;
      if (isRescheduled(status)) acc.post23Rescheduled += 1;
      if (isInTransit(status)) acc.post23InTransit += 1;
    } else if (isInTransit(status)) {
      acc.post23InTransit += 1;
    }

    return acc;
  }, buildEmptyPerformanceAnalytics());
};

const useEnviosViewModel = () => {
  const { user, getUserSession } = useContext(UserContext);

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [totales, setTotales] = useState<any>(null);
  const [discount, setDiscount] = useState<any>(null);
  const [error, setError] = useState("");

  const legacyDriverName = useMemo(() => {
    return buildLegacyDriverName(user);
  }, [user]);

  const performanceAnalytics = useMemo(() => {
    return buildPerformanceAnalytics(list);
  }, [list]);

  const load = async () => {
    setError("");

    let sessionUser: any = user;

    if (
      !sessionUser?.token ||
      buildLegacyDriverNameCandidates(sessionUser).length === 0
    ) {
      sessionUser = await getUserSession();
    }

    const candidates = buildLegacyDriverNameCandidates(sessionUser);

    if (candidates.length === 0) {
      setError("No hay nombre de chofer en sesión");
      setList([]);
      setTotales(null);
      setDiscount(null);
      return;
    }

    if (!sessionUser?.token) {
      setError("Token no disponible en sesión");
      setList([]);
      setTotales(null);
      setDiscount(null);
      return;
    }

    setLoading(true);

    try {
      console.log("[Driver legacy] candidates:", candidates);

      let finalResponse: any = null;
      let finalRows: any[] = [];
      let matchedCandidate = "";

      for (const candidate of candidates) {
        const response = await ApiDelivery.post("/v1/data/driver/me", {
          username: candidate,
        });

        const r = response.data;

        const ok =
          r?.ok === true ||
          r?.success === true ||
          r?.status === "ok" ||
          r?.statusCode === 200;

        if (!ok) {
          continue;
        }

        const rows = r?.result ?? r?.data ?? [];

        console.log(
          "[Driver legacy] candidate:",
          candidate,
          "rows:",
          rows.length
        );

        if (rows.length > 0) {
          finalResponse = r;
          finalRows = rows;
          matchedCandidate = candidate;
          break;
        }

        if (!finalResponse) {
          finalResponse = r;
          finalRows = rows;
        }
      }

      console.log(
        "[Driver legacy] matchedCandidate:",
        matchedCandidate || "none"
      );

      setList(finalRows);
      setTotales(finalResponse?.totales ?? null);
      setDiscount(finalResponse?.discount ?? null);

      if (finalRows.length === 0) {
        setError(`No se encontraron envíos para: ${candidates.join(" | ")}`);
      }
    } catch (e: any) {
      const message =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Error cargando envíos";

      console.error("[Driver legacy] error:", message);

      setError(message);
      setList([]);
      setTotales(null);
      setDiscount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacyDriverName]);

  return {
    loading,
    list,
    totales,
    discount,
    error,
    reload: load,
    username: legacyDriverName,
    legacyDriverName,
    performanceAnalytics,
  };
};

export default useEnviosViewModel;