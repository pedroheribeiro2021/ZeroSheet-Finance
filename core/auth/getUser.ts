// Reexporta o resolvedor memoizado — ver `core/services/auth.service.ts` para
// o porquê de não bater em `/auth/v1/user` a cada chamada.
export { getCurrentUser } from '@/core/services/auth.service';
