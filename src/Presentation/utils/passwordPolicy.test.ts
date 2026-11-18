// Pruebas de passwordPolicy.ts. El repo no tiene Jest: se compila y se corre con node.
//   npx tsc --outDir /tmp/password-policy --module commonjs --target es2020 --strict --skipLibCheck \
//     src/Presentation/utils/passwordPolicy.test.ts
//   node /tmp/password-policy/passwordPolicy.test.js

import { passwordProblem } from "./passwordPolicy";

let failed = 0;
const check = (name: string, ok: boolean) => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
};

check("vacía", passwordProblem("") !== null);
check("corta", passwordProblem("Ab1") !== null);
check("sin mayúscula", passwordProblem("abcdefg1") !== null);
check("sin minúscula", passwordProblem("ABCDEFG1") !== null);
check("sin número", passwordProblem("Abcdefgh") !== null);
check("válida", passwordProblem("Abcdefg1") === null);

if (failed) {
  console.log(`${failed} fallaron`);
  process.exit(1);
}
