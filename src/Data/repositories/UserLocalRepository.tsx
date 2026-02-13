// src/Domain/repositories/UserLocalRepository.tsx
import { User } from "../entities/User";

export interface UserLocalRepository {
  save(user: User): Promise<void>;
  getUser(): Promise<User | null>;
  remove(): Promise<void>;
}
