export const ADMIN_PIN = '9193';
const UNLOCK_KEY = 'alita-admin-unlocked';

export function isAdminUnlocked() {
  return sessionStorage.getItem(UNLOCK_KEY) === 'true';
}

export function unlockAdmin() {
  sessionStorage.setItem(UNLOCK_KEY, 'true');
}
