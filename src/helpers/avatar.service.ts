import { Injectable } from '@nestjs/common';

@Injectable()
export class AvatarService {
  create(id: string) {
    // https://api.dicebear.com/9.x/shapes/svg?backgroundColor=b6e3f4,c0aede,d1d4f9
    // const svg = createAvatar(shapes, {
    //   seed: id,
    //   backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'],
    // });
    // return svg.toString();
    return `https://api.dicebear.com/9.x/shapes/svg?backgroundColor=26532E,f88c49,D9EEDD&seed=${id}`;
  }
}
