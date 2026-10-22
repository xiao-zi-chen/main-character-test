import { roleById } from './data/roles.js';

// A recommended partner from a different story is not a co-star in this film.
export function getFilmPartner(role) {
  const ids = role?.castIds;
  if (!Array.isArray(ids) || ids.length !== 2 || new Set(ids).size !== 2 || !ids.includes(role.id)) return null;
  const partner = roleById[ids.find(id => id !== role.id)];
  if (!partner || !role.filmId || !role.videoId || partner.filmId !== role.filmId || partner.videoId !== role.videoId
    || partner.castIds?.length !== 2 || !ids.every(id => partner.castIds.includes(id))) return null;
  return partner;
}
