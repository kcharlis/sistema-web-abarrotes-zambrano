import React, { useState, useMemo } from 'react';
import { auth } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Store, Mail, Lock, Loader2, AlertCircle, MailCheck, ShieldCheck, UserCircle, Eye, EyeOff, Shield, User } from 'lucide-react';
import { UserRole } from '../types';

interface AuthScreenProps {
  onLoginSuccess: (role?: UserRole) => void;
  onGuestAccess: (role?: UserRole) => void;
  onShowLanding: () => void;
  initialRole?: UserRole;
  onRoleSelect?: (role: UserRole) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ 
  onLoginSuccess, 
  onGuestAccess, 
  onShowLanding,
  initialRole = 'admin',
  onRoleSelect 
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(() => {
    return (localStorage.getItem('tf_user_role') as UserRole) || initialRole;
  });

  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    localStorage.setItem('tf_user_role', role);
    if (onRoleSelect) onRoleSelect(role);
  };
  
  // Validación de fuerza de contraseña
  const stats = useMemo(() => ({
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasLength: password.length >= 8,
  }), [password]);

  const isStrong = stats.hasUpper && stats.hasNumber && stats.hasLength;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (isRegistering) {
        if (!isStrong) {
            setErrorMsg('La contraseña requiere 8 caracteres, una mayúscula y un número.');
            setLoading(false);
            return;
        }
        if (password !== confirmPassword) {
            setErrorMsg('Las contraseñas no coinciden');
            setLoading(false);
            return;
        }
    }

    try {
      localStorage.setItem('tf_user_role', selectedRole);
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setNeedsVerification(true);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess(selectedRole);
      }
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message: string };
      let message = firebaseError.message;
      if (firebaseError.code === 'auth/unauthorized-domain') {
        message = 'Dominio no autorizado en Firebase Authentication. Agrega este dominio en Firebase Console (Authorized domains) o ingresa en Modo Offline.';
      } else if (firebaseError.code === 'auth/invalid-credential' || firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password') {
        message = 'Correo o contraseña incorrectos';
      } else if (firebaseError.code === 'auth/email-already-in-use') {
        message = 'El correo ya está en uso';
      } else if (firebaseError.code === 'auth/weak-password') {
        message = 'La contraseña es muy débil';
      } else if (firebaseError.code === 'auth/operation-not-allowed') {
        message = 'El registro por correo está deshabilitado. Por favor, usa Google.';
      }
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    const provider = new GoogleAuthProvider();
    try {
      localStorage.setItem('tf_user_role', selectedRole);
      await signInWithPopup(auth, provider);
      onLoginSuccess(selectedRole);
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message: string };
      let message = firebaseError.message;
      if (firebaseError.code === 'auth/unauthorized-domain') {
        message = 'Dominio no autorizado en Firebase Authentication. Agrega este dominio en Firebase Console (Authorized domains) o ingresa en Modo Offline.';
      } else if (firebaseError.code === 'auth/popup-closed-by-user') {
        message = 'El inicio de sesión se canceló porque se cerró la ventana. Inténtalo de nuevo.';
      } else if (firebaseError.code === 'auth/cancelled-popup-request') {
        message = 'Ya hay una ventana de inicio de sesión abierta.';
      } else if (firebaseError.code === 'auth/popup-blocked') {
        message = 'El navegador bloqueó la ventana emergente. Por favor, actívalas para este sitio.';
      } else if (firebaseError.code === 'auth/network-request-failed') {
        message = 'Error de conexión. Revisa tu internet o intenta otro método.';
      } else if (firebaseError.code === 'auth/operation-not-allowed') {
        message = 'El inicio de sesión con Google no está habilitado en la consola de Firebase.';
      }
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  if (needsVerification) {
      return (
        <div className="min-h-screen bg-blue-600 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-[40px] p-10 text-center shadow-2xl animate-in zoom-in-95">
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <MailCheck size={40} />
                </div>
                <h2 className="text-2xl font-black mb-3 text-gray-900 dark:text-white">Verifica tu Email</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                  Hemos enviado un enlace a <b className="text-blue-600">{email}</b>.<br/>Si no lo ves, revisa tu carpeta de <b>SPAM</b>.
                </p>
                <button onClick={() => setNeedsVerification(false)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg transition-transform active:scale-95">
                  ENTENDIDO, VOLVER
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center p-4 py-8">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 my-auto">
        
        <div className="p-8 sm:p-10">
            <div className="text-center mb-6">
                <div className="w-16 h-16 shrink-0 bg-blue-600 rounded-[24px] mx-auto flex items-center justify-center shadow-xl mb-3">
                    <Store size={32} className="text-white" />
                </div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">SIGA Zambrano</h1>
                <p className="text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-wider mt-1">
                  Sistema Integrado de Gestión para Abarrotes · Zambrano, Bolívar
                </p>
            </div>

            {/* Selector de Rol Inicial */}
            <div className="mb-6">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 text-center">
                Selecciona tu rol de acceso:
              </label>
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => handleRoleChange('admin')}
                  className={`py-3 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${
                    selectedRole === 'admin'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                  }`}
                >
                  <Shield size={16} />
                  <span>Administrador</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('dependiente')}
                  className={`py-3 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${
                    selectedRole === 'dependiente'
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                  }`}
                >
                  <User size={16} />
                  <span>Dependiente</span>
                </button>
              </div>
              <p className="text-[10px] text-gray-400 text-center mt-1.5 font-medium">
                {selectedRole === 'admin' 
                  ? 'Acceso total a reportes financieros, márgenes y auditoría.' 
                  : 'Modo mostrador: ventas POS y consultas sin reportes sensibles.'}
              </p>
            </div>

            {errorMsg && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold flex items-center gap-3 border border-red-100 dark:border-red-800">
                    <AlertCircle size={20} className="shrink-0" /> {errorMsg}
                </div>
            )}

            <button 
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full mb-6 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-white font-black py-4 rounded-2xl shadow-sm flex items-center justify-center gap-3 border-2 border-gray-100 dark:border-gray-700 transition-all active:scale-[0.98] disabled:opacity-50"
            >
                {loading ? <Loader2 className="animate-spin" /> : (
                    <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        CONTINUAR CON GOOGLE
                    </>
                )}
            </button>

            <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-gray-800"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black text-gray-400"><span className="bg-white dark:bg-gray-900 px-4">O usa tu correo</span></div>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tu Correo</label>
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="email" 
                            required 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 focus:border-blue-500 focus:bg-white p-4 pl-12 rounded-2xl font-bold outline-none text-gray-900 dark:text-white transition-all shadow-sm text-sm" 
                            placeholder="nombre@ejemplo.com" 
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contraseña</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type={showPassword ? "text" : "password"} 
                            required 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 focus:border-blue-500 focus:bg-white p-4 pl-12 pr-12 rounded-2xl font-bold outline-none text-gray-900 dark:text-white transition-all shadow-sm text-sm" 
                            placeholder="••••••••" 
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 z-10 transition-colors"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>

                {isRegistering && (
                  <>
                    <div className="px-1 py-1 space-y-1.5 animate-in fade-in">
                        <div className="flex flex-wrap gap-1.5">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border transition-all ${stats.hasLength ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>8 Caracteres</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border transition-all ${stats.hasUpper ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>1 Mayúscula</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border transition-all ${stats.hasNumber ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>1 Número</span>
                        </div>
                    </div>

                    <div className="space-y-1 animate-in slide-in-from-top-2">
                        <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                            <ShieldCheck size={12}/> Confirmar Contraseña
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={18} />
                            <input 
                                type={showConfirmPassword ? "text" : "password"} 
                                required 
                                value={confirmPassword} 
                                onChange={e => setConfirmPassword(e.target.value)} 
                                className="w-full bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-100 dark:border-blue-900 focus:border-blue-500 focus:bg-white p-4 pl-12 pr-12 rounded-2xl font-bold outline-none text-gray-900 dark:text-white transition-all shadow-sm text-sm" 
                                placeholder="Repite tu contraseña" 
                            />
                            <button 
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-300 hover:text-blue-500 z-10"
                            >
                                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                  </>
                )}

                <button 
                    type="submit" 
                    disabled={loading || (isRegistering && !isStrong)} 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 tracking-wide text-base"
                >
                    {loading ? <Loader2 className="animate-spin" /> : (isRegistering ? 'CREAR CUENTA' : 'INGRESAR')}
                </button>
            </form>

            <div className="mt-5 flex flex-col gap-3">
                <button 
                    onClick={() => {
                      localStorage.setItem('tf_user_role', selectedRole);
                      onGuestAccess(selectedRole);
                    }}
                    className="w-full bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 border-2 border-amber-100 dark:border-amber-900/30 transition-all shadow-sm text-sm"
                >
                    <UserCircle size={20} /> ENTRAR EN MODO OFFLINE
                </button>
                <p className="text-[10px] text-gray-400 text-center font-medium px-4">
                    Usa el modo Offline con sincronización local si no dispones de conexión a internet en tu tienda.
                </p>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 text-center flex flex-col gap-3">
                <button 
                    onClick={() => {
                        setIsRegistering(!isRegistering);
                        setErrorMsg('');
                        setConfirmPassword('');
                    }} 
                    className="text-xs font-black text-blue-600 dark:text-blue-400 hover:underline"
                >
                    {isRegistering ? '¿YA TIENES CUENTA? INICIA SESIÓN' : '¿AÚN NO TIENES CUENTA? REGÍSTRATE'}
                </button>
                <div className="h-px bg-gray-50 dark:bg-gray-800 w-1/4 mx-auto" />
                <button 
                    onClick={onShowLanding}
                    className="text-[10px] font-black text-gray-400 hover:text-blue-500 transition-colors uppercase tracking-widest"
                >
                    ← VOLVER A INICIO (LANDING)
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
