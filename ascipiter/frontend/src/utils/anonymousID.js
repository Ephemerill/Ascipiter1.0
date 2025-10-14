import { v4 as uuidv4 } from 'uuid';

const USER_ID_KEY = 'anonymousUserId';

/**
 * Retrieves the anonymous user ID from localStorage.
 * If one doesn't exist, it creates a new UUID, stores it, and returns it.
 * @returns {string} The anonymous user ID.
 */
export const getAnonymousId = () => {
  let anonymousId = localStorage.getItem(USER_ID_KEY);
  if (!anonymousId) {
    anonymousId = uuidv4();
    localStorage.setItem(USER_ID_KEY, anonymousId);
  }
  return anonymousId;
};