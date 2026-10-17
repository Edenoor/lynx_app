// src/Presentation/components/DriverQrActionGrid.tsx

import React from "react";
import { QrActionGrid } from "./QrActionGrid";

type DriverQrActionGridProps = {
  pendingCount?: number;

  onCollect: () => void;
  onAssign: () => void;
  onPlant: () => void;
  onPending: () => void;
};

export function DriverQrActionGrid({
  pendingCount = 0,
  onCollect,
  onAssign,
  onPlant,
  onPending,
}: DriverQrActionGridProps) {
  return (
    <QrActionGrid
      actions={[
        { key: "collect", icon: "cube-outline", label: "Colectar", onPress: onCollect },
        { key: "assign", icon: "person-add-outline", label: "Asignar", onPress: onAssign },
        { key: "plant", icon: "business-outline", label: "Planta", onPress: onPlant },
        { key: "pending", icon: "car-outline", label: "Pendientes", badge: pendingCount, onPress: onPending },
      ]}
    />
  );
}

export default DriverQrActionGrid;
