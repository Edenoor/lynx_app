import { AuthRepositoryImpl } from "../../../Data/repositories/AuthRepository";


const { capabilities } = new AuthRepositoryImpl();

export const GetAdminCapabilitiesUseCase = async () => {
    return await capabilities();
}
