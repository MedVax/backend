import { Injectable } from '@nestjs/common';
import { ECRYPTION_KEY } from 'constants/env.constant';
import * as CryptoJS from 'crypto-js';

const key = ECRYPTION_KEY;

@Injectable()
export class AesEncryptionService {
  encrypt(plainText: string) {
    const encJson = CryptoJS.AES.encrypt(
      JSON.stringify(plainText),
      key,
    ).toString();
    const encData = CryptoJS.enc.Base64.stringify(
      CryptoJS.enc.Utf8.parse(encJson),
    );
    return encData;
  }

  decrypt(encryptedText: string) {
    const decData = CryptoJS.enc.Base64.parse(encryptedText).toString(
      CryptoJS.enc.Utf8,
    );
    const bytes = CryptoJS.AES.decrypt(decData, key).toString(
      CryptoJS.enc.Utf8,
    );
    return JSON.parse(bytes);
  }
  catch(e) {
    console.error(e);
    return null;
  }
}
