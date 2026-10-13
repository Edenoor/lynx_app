export type UserRole = "ADMIN" | "SELLER" | "DRIVER" | string;

export interface User {
  id?: string;

  /**
   * Credencial de acceso.
   * Se usa para login, no para mostrar en UI ni para buscar envíos legacy.
   */
  username: string;

  /**
   * Nombre visible general.
   * Para choferes debería ser first_name + last_name.
   */
  name: string;

  first_name?: string;
  last_name?: string;

  email?: string;
  phone?: string;

  rol: UserRole;
  token: string;

  /**
   * Perfil de un ADMIN (admin_data.profile), por ejemplo "PICKER". El token no
   * lo trae: se consulta en GET /v2/auth/capabilities y decide a qué parte de
   * la app entra el usuario.
   */
  profile?: string | null;

  /**
   * Nombre usado para consultar envíos legacy de driver.
   * Hoy legacy filtra por cadete, aunque el body se llame username.
   */
  legacyDriverName?: string;

  /**
   * Campos usados solo en formularios legacy de registro.
   * No deben guardarse como sesión real.
   */
  password?: string;
  confirmPassword?: string;
}