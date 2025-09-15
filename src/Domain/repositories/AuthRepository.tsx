import { ResponseApiDelivery } from "../../Data/sources/remote/models/ResponseApiDelivery";
import { User } from "../entities/User";

export interface AuthRepository {

    login(username: string, password: string): Promise<ResponseApiDelivery>;
    register(user: User): Promise<ResponseApiDelivery>
    recovery(username: string): Promise<ResponseApiDelivery>
}