import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class BcryptService {
  hashSync(value: string) {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(value, salt);
  }

  compareSync(value: string, hash: string) {
    return bcrypt.compareSync(value, hash);
  }
}
