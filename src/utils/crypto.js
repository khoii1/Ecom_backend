import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const genCode = (len = 6) => {
  const min = 10 ** (len - 1), max = 10 ** len - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
};
