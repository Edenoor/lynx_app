import { User } from '../../Domain/entities/User';
import { UserLocalRepository } from '../../Domain/repositories/UserLocalRepository';
import { readSession, removeSession, saveSession } from '../sources/local/SessionStorage';


export class UserLocalRepositoryImpl implements UserLocalRepository {


    async save(user: User): Promise<void> {
        await saveSession(JSON.stringify(user));
    }

    async getUser(): Promise<User> {
        const data = await readSession();
        const user: User = JSON.parse(data as any);
        return user;
    }

    async remove(): Promise<void> {
        await removeSession();
    }

}