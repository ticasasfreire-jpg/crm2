import React, { useState } from 'react';
import { auth } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Github } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans text-slate-900">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 border border-slate-200"
      >
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-sm">
            P
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
          {isLogin ? 'Bem-vindo de volta' : 'Criar conta'}
        </h2>
        <p className="text-center text-slate-500 mb-8 text-sm font-sans">
          PixPay CRM Financeiro
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-sm"
              placeholder="seu@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-sm"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

          <button 
            type="submit"
            className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-semibold hover:bg-emerald-700 transform transition-all active:scale-95 shadow-sm"
          >
            {isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-400 font-bold uppercase tracking-widest">Ou continue com</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleSignIn}
            className="mt-4 w-full flex items-center justify-center gap-2 border border-slate-200 py-2.5 rounded-lg hover:bg-slate-50 transition-all font-semibold text-slate-700 text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.73 0 3.01.75 3.67 1.38l2.73-2.73C16.4 1.84 14.39 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.22 2.48c.85-2.58 3.25-4.51 6.6-4.51z"/>
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.11 2.41c1.82-1.68 2.31-4.14 2.31-8.23z"/>
              <path fill="#FBBC05" d="M5.4 14.55c-.23-.67-.36-1.39-.36-2.15s.13-1.48.36-2.15L2.18 7.07C1.4 8.64 1 10.28 1 12s.4 3.36 1.18 4.93l3.22-2.38z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-1 7.28-2.69l-3.11-2.41c-.96.64-2.23 1.02-3.67 1.02-3.35 0-5.75-1.93-6.6-4.51l-3.22 2.38C3.99 20.53 7.7 23 12 23z"/>
            </svg>
            Google
          </button>
        </div>

        <p className="mt-8 text-center text-xs font-semibold text-slate-400">
          {isLogin ? 'Ainda não tem conta?' : 'Já tem uma conta?'}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="ml-1 text-emerald-600 hover:underline"
          >
            {isLogin ? 'Cadastre-se' : 'Faça login'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
