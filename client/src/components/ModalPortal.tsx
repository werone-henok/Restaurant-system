import React from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
}

/**
 * Mounts modal overlays directly to document.body.
 * Guarantees modals escape all parent stacking contexts, transforms,
 * and sibling sticky headers/bottom navbars.
 */
export const ModalPortal: React.FC<ModalPortalProps> = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};
