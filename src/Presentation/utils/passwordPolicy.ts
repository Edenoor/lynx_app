// Política de contraseña. Espejo de server/auth/passwordPolicy.js del
// servidor, que es quien decide: esto solo da el aviso antes de enviar.
export const PASSWORD_MIN_LENGTH = 8;

/** Devuelve el motivo por el que la contraseña no sirve, o null si sirve. */
export const passwordProblem = (password: string): string | null => {
  if (!password) return "Ingresá la contraseña nueva";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`;
  }
  if (!/[A-Z]/.test(password)) return "Debe tener al menos una mayúscula";
  if (!/[a-z]/.test(password)) return "Debe tener al menos una minúscula";
  if (!/[0-9]/.test(password)) return "Debe tener al menos un número";
  return null;
};
