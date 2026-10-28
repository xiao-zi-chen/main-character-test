import React from 'react';
import { mediaAsset } from '../media.js';
import './role-card-artwork.css';

// The complete downloadable card starts with the original character artwork.
// Reuse that image, clipping only its separate description and QR footer.
export function RoleCardArtwork({ role, media, alt = '', className = '', loading }) {
  return <span className={`role-card-artwork ${className}`} style={{ aspectRatio: media?.cardArtworkSize?.join(' / ') || '2 / 3' }}>
    <img src={mediaAsset(role, media, 'card')} alt={alt} loading={loading}/>
  </span>;
}
