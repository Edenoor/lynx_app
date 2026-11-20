import { ResponseApiDelivery } from "../../Data/sources/remote/models/ResponseApiDelivery";
import { User } from "../entities/User";

// Capacidades de un ADMIN (admin_data). Solo informativas: la autoridad sigue
// siendo el servidor en cada endpoint.
export type AdminCapabilities = {
    profile?: string | null;
    warehouse_access?: boolean;
    db_access?: boolean;
    user_access?: boolean;
    finance_access?: boolean;
    // Lista efectiva de permisos. Un servidor anterior no la manda (null).
    permissions?: string[] | null;
    // Depósito asignado en la ficha: null = no tiene; undefined = servidor
    // anterior que no lo informa (auditoría 19-nov, APP-04).
    assignedWarehouse?: { id: number; name: string | null; active: boolean } | null;
};

export interface AuthRepository {

    login(username: string, password: string): Promise<ResponseApiDelivery>;
    register(user: User): Promise<ResponseApiDelivery>
    recovery(username: string): Promise<ResponseApiDelivery>
    capabilities(): Promise<AdminCapabilities>
}
