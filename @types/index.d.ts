import type { User } from 'generated/prisma/client';
import { Multer as MulterNamed } from 'multer';

declare global {
  namespace Express {
    interface Multer extends MulterNamed {}
    interface Request {
      authUser: User;
    }
  }
}
