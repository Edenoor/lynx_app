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
};

export interface AuthRepository {

    login(username: string, password: string): Promise<ResponseApiDelivery>;
    register(user: User): Promise<ResponseApiDelivery>
    recovery(username: string): Promise<ResponseApiDelivery>
    capabilities(): Promise<AdminCapabilities>
}
