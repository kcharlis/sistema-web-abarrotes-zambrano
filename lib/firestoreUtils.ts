import { auth } from './firebase';
import { OperationType } from '../types';

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function normalizeBarcode(barcode: any): string {
    if (!barcode) return '';
    // Convert to string and remove all non-digit characters
    // This handles cases where barcodes are saved with spaces, prefixes, or as numbers
    return String(barcode).trim().replace(/\D/g, '');
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getFriendlyErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    
    try {
        const parsed = JSON.parse(message);
        if (parsed.error && parsed.authInfo) {
            if (parsed.error.includes('insufficient permissions')) {
                if (!parsed.authInfo.emailVerified) {
                    return 'Acceso denegado: Por favor verifica tu correo electrónico para realizar esta acción.';
                }
                return 'Acceso denegado: No tienes permisos para realizar esta operación.';
            }
            return `Error de Base de Datos: ${parsed.error}`;
        }
    } catch {
        // Not a JSON error message
    }

    if (message.includes('permission-denied')) {
        return 'Permiso denegado. Asegúrate de estar autenticado y verificado.';
    }

    return message;
}
