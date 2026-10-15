import bcrypt from "bcrypt";

export function hashPassword(password) {
  return bcrypt.hash(password, 8);
}

export async function checkPassword(password, storedHash) {
  if (typeof password !== "string" || typeof storedHash !== "string")
    return false;
  return bcrypt.compare(password, storedHash);
}
