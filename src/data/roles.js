import { selectedRoles } from './roles-selected.js';
import { mediaBaseUrl } from '../runtime-config.js';

export const roles = selectedRoles;
export const regularRoles = roles.filter(role => !role.hidden);
export const hiddenRoles = roles.filter(role => role.hidden);
export const roleById = Object.fromEntries(roles.map(role => [role.id, role]));
export const mediaPath = (role, extension = 'mp4', revision) => `${mediaBaseUrl()}media/${extension === 'mp4' ? role.videoId : role.id}.${extension}${revision ? `?v=${encodeURIComponent(revision)}` : ''}`;
