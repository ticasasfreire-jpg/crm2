import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, 
  Settings as SettingsIcon, 
  LayoutDashboard, 
  LogOut, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  Download, 
  Plus, 
  MoreVertical,
  X,
  Copy,
  Check,
  Menu,
  Users,
  Shield,
  Edit2,
  Trash2,
  Key,
  Lock
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { auth, db } from '../firebase';
import { updatePassword } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc, getDoc, setDoc, where, getDocs, deleteDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import jsPDF from 'jspdf';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Sidebar Component
const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen }: { activeTab: string, setActiveTab: (tab: string) => void, isOpen: boolean, setIsOpen: (val: boolean) => void }) => {
  const { role } = useAuth();
  
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'pix', icon: Plus, label: 'Gerar Pix' },
    { id: 'settings', icon: SettingsIcon, label: 'Configurações', adminOnly: true },
    { id: 'logs', icon: Clock, label: 'Logs', adminOnly: true },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <div className={cn(
        "fixed inset-y-0 left-0 w-64 bg-slate-900 h-screen flex flex-col p-6 z-50 transition-transform duration-300 transform lg:translate-x-0 lg:sticky lg:top-0 flex-shrink-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between gap-3 mb-10 px-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
              P
            </div>
            <span className="font-bold text-lg tracking-tight text-white">PixPay CRM</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {menuItems.filter(item => !item.adminOnly || role === 'admin').map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group font-medium text-sm",
                activeTab === item.id 
                  ? "bg-white/10 text-white" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-emerald-500 opacity-100" : "opacity-70 group-hover:opacity-100")} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800">
          <button 
            onClick={() => auth.signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 transition-all duration-200 rounded-lg text-sm font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </>
  );
};

// Main App Wrapper
export default function AppContent() {
  const { role, user, allowedIdentifiers, forcePasswordChange } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [identifiers, setIdentifiers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  const addLog = async (action: string, details: string) => {
    try {
      await addDoc(collection(db, 'logs'), {
        action,
        details,
        userEmail: user?.email || 'Sistema',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error adding log:", err);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubscribeTransactions = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'config'), (doc) => {
      if (doc.exists()) setSettings(doc.data());
    });

    const qIdentifiers = query(collection(db, 'identifiers'), orderBy('id', 'asc'));
    const unsubscribeIdentifiers = onSnapshot(qIdentifiers, (snapshot) => {
      setIdentifiers(snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeTransactions();
      unsubscribeSettings();
      unsubscribeIdentifiers();
    };
  }, []);

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.payerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         t.identifier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.document?.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    
    let matchesIdentifier = true;
    if (role !== 'admin' && allowedIdentifiers && allowedIdentifiers.length > 0) {
      matchesIdentifier = allowedIdentifiers.includes(t.identifier || '');
    }

    let matchesDate = true;
    if (t.date) {
      const transDate = new Date(t.date);
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00');
        if (transDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59');
        if (transDate > end) matchesDate = false;
      }
    } else if (startDate || endDate) {
      matchesDate = false;
    }

    return matchesSearch && matchesStatus && matchesDate && matchesIdentifier;
  });

  const handleSync = async () => {
    if (!settings) {
      alert('Configurações não encontradas.');
      return;
    }

    try {
      const response = await fetch('/api/sicoob/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: settings.sicoobClientId,
          clientSecret: settings.sicoobClientSecret,
          certificate: settings.sicoobCert,
          key: settings.sicoobKey,
          pixKey: settings.pixKey
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro na sincronização');
      }

      if (data.success && data.transactions) {
        // Save transactions to Firestore
        const batch = data.transactions.map(async (t: any) => {
          // Check if transaction already exists by endToEndId
          const q = query(collection(db, 'transactions'), where('transactionId', '==', t.endToEndId));
          const snap = await getDocs(q);
          
          if (snap.empty) {
            await addDoc(collection(db, 'transactions'), {
              transactionId: t.endToEndId,
              amount: parseFloat(t.valor),
              payerName: t.pagador?.nome || 'Desconhecido',
              document: t.pagador?.cpf || t.pagador?.cnpj || 'Sem Documento',
              date: t.horario,
              status: 'confirmed',
              identifier: t.infoPagador || t.txid || null,
              createdAt: new Date().toISOString()
            });
          }
        });

        await Promise.all(batch);
        await addLog('Sincronização Pix', `Sincronizadas ${data.transactions.length} transações via API Sicoob.`);
        alert(`${data.transactions.length} transações processadas com sucesso!`);
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro: ' + err.message);
    }
  };

  return (
    <div className="flex bg-slate-50 min-h-screen text-slate-900 font-sans relative">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
      />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col overflow-x-hidden">
        {/* Force Password Change Overlay */}
        <AnimatePresence>
          {forcePasswordChange && user && (
            <PasswordChangeOverlay uid={user.uid} />
          )}
        </AnimatePresence>
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 focus:ring-2 focus:ring-emerald-500"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
              <h2 className="text-xl md:text-2xl font-bold text-slate-800 capitalize">
                {activeTab === 'dashboard' ? 'Dashboard Financeiro' : 
                 activeTab === 'pix' ? 'Gerador Pix' : 
                 activeTab === 'settings' ? 'Configurações' : 
                 activeTab === 'logs' ? 'Logs do Sistema' : activeTab}
              </h2>
              <p className="text-slate-500 text-xs md:text-sm">
                {activeTab === 'dashboard' ? 'Bem-vindo ao controle de transações Pix' : 
                 activeTab === 'pix' ? 'Gere cobranças Pix rápidas e acompanhe em tempo real' : 
                 activeTab === 'settings' ? 'Gerencie dados da empresa, usuários e permissões de acesso' : 
                 'Histórico completo de ações realizadas no sistema'}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            {activeTab === 'dashboard' && (
              <>
                {role === 'admin' && (
                  <button 
                    onClick={() => setActiveTab('settings')}
                    className="flex-1 sm:flex-none bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 text-slate-600 hover:bg-slate-50 shadow-sm transition-all"
                  >
                    <SettingsIcon className="w-4 h-4" />
                    <span className="hidden md:inline">Configurações</span>
                  </button>
                )}
                <button 
                  onClick={() => setActiveTab('pix')}
                  className="flex-1 sm:flex-none bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4 text-emerald-500" />
                  Gerar Pix
                </button>
                <button 
                  onClick={handleSync}
                  className="flex-1 sm:flex-none bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-emerald-700 transition-all active:scale-95"
                >
                  Sincronizar
                </button>
              </>
            )}
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="mb-8 flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar pagador, ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm shadow-sm"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 shadow-sm flex-1">
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 py-1 bg-transparent outline-none text-[10px] text-slate-600 cursor-pointer"
                />
                <span className="text-slate-300">|</span>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 py-1 bg-transparent outline-none text-[10px] text-slate-600 cursor-pointer"
                />
              </div>

              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer text-xs shadow-sm"
              >
                <option value="all">Status</option>
                <option value="confirmed">Confirmados</option>
                <option value="pending">Pendentes</option>
              </select>

              <button className="bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-900 transition-all flex items-center justify-center gap-2">
                <Search className="w-4 h-4" />
                <span>Pesquisar</span>
              </button>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            {activeTab === 'dashboard' && <Dashboard transactions={filteredTransactions} addLog={addLog} />}
            {activeTab === 'pix' && <PixGenerator settings={settings} identifiers={identifiers} />}
            {activeTab === 'settings' && <Settings settings={settings} identifiers={identifiers} />}
            {activeTab === 'logs' && <Logs />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// Dashboard Components
const Dashboard = ({ transactions, addLog }: { transactions: any[], addLog: (a: string, d: string) => Promise<void> }) => {
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  const stats = [
    { label: 'Total Hoje', value: 'R$ 0,00', icon: BarChart3, color: 'text-slate-800', bg: 'bg-white', meta: '+12% vs ontem', metaColor: 'text-emerald-600' },
    { label: 'Confirmados', value: transactions.filter(t => t.status === 'confirmed').length, icon: CheckCircle2, color: 'text-slate-800', bg: 'bg-white', meta: 'Sucessos', metaColor: 'text-slate-500' },
    { label: 'Pendentes', value: transactions.filter(t => t.status === 'pending').length, icon: Clock, color: 'text-slate-800', bg: 'bg-white', meta: 'Aguardando', metaColor: 'text-amber-600' },
    { label: 'Status API', value: 'Operacional', icon: Check, color: 'text-emerald-600', bg: 'bg-white', meta: 'Online', metaColor: 'text-emerald-600', isPulse: true },
  ];

  return (
    <div className="space-y-6 flex-1 flex flex-col">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between"
          >
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <div className="flex items-center gap-2">
                {stat.isPulse && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
                <p className={cn("text-xl font-bold", stat.color)}>{stat.value}</p>
              </div>
            </div>
            <p className={cn("text-[10px] font-bold uppercase tracking-tight mt-2", stat.metaColor)}>{stat.meta}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800">Últimas Transações</h3>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              <tr className="border-b border-slate-100">
                <th className="px-4 md:px-6 py-3">Data/Hora</th>
                <th className="px-4 md:px-6 py-3 min-w-[150px]">Pagador</th>
                <th className="hidden md:table-cell px-6 py-3">CPF/CNPJ</th>
                <th className="hidden sm:table-cell px-6 py-3">Identificador</th>
                <th className="px-4 md:px-6 py-3 text-right">Valor</th>
                <th className="px-4 md:px-6 py-3 text-center">Status</th>
                <th className="px-4 md:px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm text-slate-600">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 md:px-6 py-12 text-center text-slate-400 italic">
                    Nenhuma transação encontrada.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 md:px-6 py-3 font-medium whitespace-nowrap text-[10px] md:text-sm">
                      {t.date ? format(new Date(t.date), 'dd MMM, HH:mm') : '-'}
                    </td>
                    <td className="px-4 md:px-6 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 break-words line-clamp-1">{t.payerName}</span>
                        <span className="md:hidden text-[9px] text-slate-400 font-mono tracking-tighter">{t.document}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-3">
                      <span className="text-[10px] text-slate-500 font-mono tracking-tighter bg-slate-50 px-2 py-1 rounded border border-slate-100">
                        {t.document || '-'}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight bg-slate-100 px-2 py-0.5 rounded">
                        {t.identifier || '-'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-3 text-right">
                      <span className="font-bold text-slate-900 text-xs md:text-sm">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all",
                        t.status === 'confirmed' 
                          ? "bg-emerald-100 text-emerald-700" 
                          : "bg-amber-100 text-amber-700"
                      )}>
                        {t.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setSelectedTransaction(t)}
                          className="text-emerald-600 font-bold hover:underline text-[10px] uppercase tracking-wider"
                        >
                          Ver Recibo
                        </button>
                        {t.status === 'pending' && (
                          <button 
                            onClick={async () => {
                              if (confirm('Confirmar recebimento?')) {
                                await updateDoc(doc(db, 'transactions', t.id), { 
                                  status: 'confirmed',
                                  updatedAt: new Date().toISOString()
                                });
                                await addLog('Confirmação Manual', `Recebimento confirmado para transação ${t.transactionId} de ${t.payerName}.`);
                              }
                            }}
                            className="text-slate-400 font-bold hover:text-emerald-600 text-[10px] uppercase tracking-wider transition-colors"
                          >
                            Confirmar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Mostrando {transactions.length} de {transactions.length} transações</p>
        </div>
      </div>

      {selectedTransaction && (
        <TransactionModal 
          transaction={selectedTransaction} 
          onClose={() => setSelectedTransaction(null)} 
        />
      )}
    </div>
  );
};

// Modal for Transaction Details and Receipt
const TransactionModal = ({ transaction, onClose }: { transaction: any, onClose: () => void }) => {
  const [note, setNote] = useState(transaction.note || '');
  const [saving, setSaving] = useState(false);

  const saveNote = async () => {
    setSaving(true);
    await updateDoc(doc(db, 'transactions', transaction.id), { note });
    setSaving(false);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Recibo de Transação Pix', 20, 30);
    
    doc.setFontSize(12);
    doc.text(`Identificador: ${transaction.identifier || '-'}`, 20, 50);
    doc.text(`Pagador: ${transaction.payerName}`, 20, 60);
    doc.text(`Documento: ${transaction.document || '-'}`, 20, 70);
    doc.text(`Valor: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.amount)}`, 20, 80);
    doc.text(`Data: ${format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')}`, 20, 90);
    doc.text(`ID Transação: ${transaction.transactionId}`, 20, 100);
    doc.text(`Status: ${transaction.status === 'confirmed' ? 'CONFIRMADO' : 'PENDENTE'}`, 20, 110);
    
    if (note) {
      doc.text('Observações:', 20, 130);
      doc.text(note, 20, 140);
    }
    
    doc.save(`recibo-${transaction.transactionId}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-xl rounded-2xl overflow-hidden shadow-xl border border-slate-200"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-lg text-slate-800">Detalhes da Transação</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Pagador</label>
              <p className="font-bold text-slate-800">{transaction.payerName}</p>
              <p className="text-xs text-slate-500 font-mono">{transaction.document}</p>
            </div>
            <div className="text-right">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Valor</label>
              <p className="text-2xl font-bold text-emerald-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.amount)}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider">Data</span>
              <span className="font-semibold text-slate-700">{format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider">ID Transação</span>
              <span className="font-mono text-slate-600 break-all ml-4 text-right leading-tight">{transaction.transactionId}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider">Status</span>
              <span className={cn(
                "font-bold uppercase tracking-widest",
                transaction.status === 'confirmed' ? "text-emerald-600" : "text-amber-600"
              )}>
                {transaction.status === 'confirmed' ? 'CONFIRMADO' : 'PENDENTE'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Notas da Transação</label>
            <textarea 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none h-24 text-sm"
              placeholder="Adicione observações aqui..."
            />
            {saving && <p className="text-[10px] text-emerald-600 mt-1 font-bold uppercase">Salvando...</p>}
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              onClick={generatePDF}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Baixar Recibo
            </button>
            <button 
              onClick={onClose}
              className="px-8 py-3 border border-slate-200 text-slate-600 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-slate-50 transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// Helper for Pix CRC16 calculation
function calculateCRC16(data: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

// Pix Generator Component
const PixGenerator = ({ settings, identifiers }: { settings: any, identifiers: any[] }) => {
  const { role, allowedIdentifiers } = useAuth();
  const [amount, setAmount] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [pixStatus, setPixStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);

  // Filter identifiers based on user permissions
  const availableIdentifiers = role === 'admin' 
    ? identifiers 
    : identifiers.filter(id => allowedIdentifiers?.includes(id.id));

  // If no global identifiers matched but user has custom allowed identifiers, still show them as chips
  const displayIds = availableIdentifiers.length > 0 
    ? availableIdentifiers.map(i => i.id)
    : (allowedIdentifiers || []);

  // Poll for status
  useEffect(() => {
    let interval: any;
    if (txid && pixStatus !== 'CONCLUIDA') {
      interval = setInterval(async () => {
        try {
          const params = new URLSearchParams({
            clientId: settings.sicoobClientId,
            certificate: settings.sicoobCert,
            key: settings.sicoobKey
          });
          const res = await fetch(`/api/sicoob/status/${txid}?${params.toString()}`);
          const data = await res.json();
          if (data.success) {
            setPixStatus(data.status);
            if (data.status === 'CONCLUIDA') {
              clearInterval(interval);
            }
          }
        } catch (err) {
          console.error("Status polling error:", err);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [txid, pixStatus, settings]);

  const generatePix = async () => {
    if (!settings?.pixKey) {
      alert('Configure sua chave Pix primeiro em Configurações.');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert('Informe um valor válido.');
      return;
    }

    setLoading(true);
    setQrCodeData(null);
    setTxid(null);
    setPixStatus(null);

    try {
      const response = await fetch('/api/sicoob/create-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: settings.sicoobClientId,
          clientSecret: settings.sicoobClientSecret,
          certificate: settings.sicoobCert,
          key: settings.sicoobKey,
          pixKey: settings.pixKey,
          amount,
          identifier
        })
      });

      const data = await response.json();
      if (data.success) {
        setQrCodeData(data.pixCopiaECola);
        setTxid(data.txid);
        setPixStatus(data.status);
      } else {
        throw new Error(data.error || 'Erro ao gerar Pix no Sicoob');
      }
    } catch (err: any) {
      alert('Erro: ' + err.message);
      
      // Fallback to static Pix if API fails or user just wants a mock for now
      if (confirm('Deseja gerar um QR Code estático offline como alternativa?')) {
        const cleanAmount = amount.replace(',', '.');
        const formattedAmount = cleanAmount ? parseFloat(cleanAmount).toFixed(2) : '';
        const gui = 'br.gov.bcb.pix';
        const key = settings.pixKey;
        const merchantAccountInfo = `00${gui.length.toString().padStart(2, '0')}${gui}01${key.length.toString().padStart(2, '0')}${key}`;
        const ref = identifier || '***';
        const additionalData = `05${ref.length.toString().padStart(2, '0')}${ref}`;
        const payloadParts = [
          '000201', '26' + merchantAccountInfo.length.toString().padStart(2, '0') + merchantAccountInfo,
          '52040000', '5303986',
          formattedAmount ? `54${formattedAmount.length.toString().padStart(2, '0')}${formattedAmount}` : '',
          '5802BR', `59${(settings.companyName?.length || 6).toString().padStart(2, '0')}${settings.companyName || 'PIXCRM'}`,
          '6009SAO PAULO', `62${additionalData.length.toString().padStart(2, '0')}${additionalData}`, '6304'
        ];
        const payload = payloadParts.join('');
        setQrCodeData(payload + calculateCRC16(payload));
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (qrCodeData) {
      navigator.clipboard.writeText(qrCodeData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadQRCode = () => {
    if (!qrRef.current) return;
    const canvas = qrRef.current;
    const pngUrl = canvas
      .toDataURL("image/png")
      .replace("image/png", "image/octet-stream");
    let downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `qrcode-pix-${txid || 'static'}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="max-w-xl mx-auto w-full">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Valor (R$)</label>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Identificador (Opcional)</label>
            <input 
              type="text" 
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm mb-3"
              placeholder="EX: PEDIDO-123"
            />
            <div className="flex flex-wrap gap-2">
              {displayIds.map((id) => (
                <button
                  key={id}
                  onClick={() => setIdentifier(id)}
                  className={cn(
                    "text-[9px] font-bold px-2 py-1 rounded-full border transition-all",
                    identifier === id 
                      ? "bg-slate-800 text-white border-slate-900" 
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                  )}
                >
                  {id}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={generatePix}
          disabled={loading}
          className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold text-sm uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processando...
            </>
          ) : (
            'Gerar Pix Sicoob'
          )}
        </button>

        {qrCodeData && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="pt-6 border-t border-slate-100 flex flex-col items-center space-y-6"
          >
            {pixStatus === 'CONCLUIDA' ? (
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-emerald-100 border border-emerald-200 p-8 rounded-2xl flex flex-col items-center text-center space-y-4 w-full"
              >
                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg">
                  <Check className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-emerald-800 font-bold text-xl uppercase tracking-wider text-center">Pagamento Aprovado!</h4>
                  <p className="text-emerald-600 text-sm mt-1">O valor foi recebido com sucesso na sua conta.</p>
                </div>
              </motion.div>
            ) : (
              <>
                <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-inner relative">
                  <QRCodeCanvas 
                    ref={qrRef}
                    value={qrCodeData} 
                    size={200} 
                    includeMargin 
                    level="H"
                  />
                  {txid && (
                    <div className="absolute top-2 right-2">
                       <span className="flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aguardando Pagamento</p>
                  <p className="text-[9px] text-slate-400 italic">O status será atualizado automaticamente.</p>
                </div>

                <div className="w-full flex flex-col gap-3">
                  <button 
                    onClick={downloadQRCode}
                    className="w-full border border-slate-200 text-slate-600 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.0 h-3.0" />
                    Baixar QR Code (PNG)
                  </button>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center block">Código Copia e Cola</label>
                    <div className="flex gap-2">
                      <input 
                        readOnly 
                        value={qrCodeData} 
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap"
                      />
                      <button 
                        onClick={copyToClipboard}
                        className={cn(
                          "px-4 py-2 rounded-lg flex items-center gap-3 font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap",
                          copied ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        )}
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

// Settings Component
const Settings = ({ settings, identifiers }: { settings: any, identifiers: any[] }) => {
  const { role } = useAuth();
  const [formData, setFormData] = useState({
    companyName: '',
    cnpj: '',
    pixKey: '',
    pixKeyType: 'email',
    sicoobClientId: '',
    sicoobClientSecret: '',
    sicoobCert: '',
    sicoobKey: ''
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiStatus, setApiStatus] = useState<'Operacional' | 'Inoperante' | 'Verificando'>('Verificando');
  
  // Identifier Management State
  const [newGlobalId, setNewGlobalId] = useState('');

  const checkSicoobConnection = async (data: any) => {
    if (!data.sicoobClientId || !data.sicoobCert || !data.sicoobKey) {
      setApiStatus('Inoperante');
      return;
    }
    setApiStatus('Verificando');
    try {
      const response = await fetch('/api/sicoob/check-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: data.sicoobClientId,
          clientSecret: data.sicoobClientSecret,
          certificate: data.sicoobCert,
          key: data.sicoobKey
        })
      });
      const result = await response.json();
      setApiStatus(result.status || 'Inoperante');
    } catch (err) {
      setApiStatus('Inoperante');
    }
  };

  useEffect(() => {
    if (settings) {
      const newData = {
        companyName: settings.companyName || '',
        cnpj: settings.cnpj || '',
        pixKey: settings.pixKey || '',
        pixKeyType: settings.pixKeyType || 'email',
        sicoobClientId: settings.sicoobClientId || '',
        sicoobClientSecret: settings.sicoobClientSecret || '',
        sicoobCert: settings.sicoobCert || '',
        sicoobKey: settings.sicoobKey || ''
      };
      setFormData(newData);
      checkSicoobConnection(newData);
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'config'), {
        ...formData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setSuccess(true);
      checkSicoobConnection(formData);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert('Erro ao salvar configurações.');
    }
    setSaving(false);
  };

  const addGlobalIdentifier = async () => {
    if (!newGlobalId.trim()) return;
    try {
      await addDoc(collection(db, 'identifiers'), {
        id: newGlobalId.toUpperCase().trim(),
        createdAt: new Date().toISOString()
      });
      setNewGlobalId('');
    } catch (err) {
      alert('Erro ao adicionar identificador.');
    }
  };

  const deleteGlobalIdentifier = async (docId: string) => {
    try {
      await deleteDoc(doc(db, 'identifiers', docId));
    } catch (err) {
      alert('Erro ao excluir identificador.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8 pb-12">
      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4 uppercase tracking-wider">Dados da Empresa</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome Fantasia</label>
              <input 
                type="text" 
                value={formData.companyName}
                onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                placeholder="Ex: Minha Empresa"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CNPJ</label>
              <input 
                type="text" 
                value={formData.cnpj}
                onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de Chave Pix</label>
              <select 
                value={formData.pixKeyType}
                onChange={(e) => setFormData({...formData, pixKeyType: e.target.value})}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
              >
                <option value="email">E-mail</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Chave Aleatória</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chave Pix Principal</label>
              <input 
                type="text" 
                value={formData.pixKey}
                onChange={(e) => setFormData({...formData, pixKey: e.target.value})}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                placeholder={
                  formData.pixKeyType === 'email' ? 'exemplo@email.com' :
                  formData.pixKeyType === 'cpf' ? '000.000.000-00' :
                  formData.pixKeyType === 'cnpj' ? '00.000.000/0000-00' :
                  formData.pixKeyType === 'telefone' ? '+55 (00) 00000-0000' : 'Chave Aleatória'
                }
              />
            </div>
          </div>
        </section>

        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wider">Integração Sicoob</h3>
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-2 py-1 text-[10px] font-bold uppercase rounded-full transition-all flex items-center gap-1.5",
                apiStatus === 'Operacional' ? "bg-emerald-100 text-emerald-600 border border-emerald-200" :
                apiStatus === 'Verificando' ? "bg-slate-100 text-slate-400 border border-slate-200 animate-pulse" :
                "bg-red-100 text-red-600 border border-red-200"
              )}>
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  apiStatus === 'Operacional' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                  apiStatus === 'Verificando' ? "bg-slate-400" :
                  "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                )}></span>
                {apiStatus}
              </span>
              <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase rounded-full border border-slate-200">Automático</span>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client ID</label>
                <input 
                  type="text" 
                  value={formData.sicoobClientId}
                  onChange={(e) => setFormData({...formData, sicoobClientId: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  placeholder="ID da aplicação"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client Secret</label>
                <input 
                  type="password" 
                  value={formData.sicoobClientSecret}
                  onChange={(e) => setFormData({...formData, sicoobClientSecret: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  placeholder="********"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Certificado (.pem)</label>
              <textarea 
                value={formData.sicoobCert}
                onChange={(e) => setFormData({...formData, sicoobCert: e.target.value})}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none h-32 font-mono text-[10px] bg-slate-50 text-slate-500"
                placeholder="-----BEGIN CERTIFICATE-----"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chave Privada (.key)</label>
              <textarea 
                value={formData.sicoobKey}
                onChange={(e) => setFormData({...formData, sicoobKey: e.target.value})}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none h-32 font-mono text-[10px] bg-slate-50 text-slate-500"
                placeholder="-----BEGIN PRIVATE KEY-----"
              />
            </div>
          </div>
        </section>

        <div className="flex items-center gap-4">
          <button 
            type="submit"
            disabled={saving}
            className="flex-1 bg-emerald-600 text-white py-4 rounded-lg font-bold text-sm uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Salvar Configurações API'}
          </button>
          {success && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest"
            >
              <CheckCircle2 className="w-4 h-4" />
              Salvo!
            </motion.div>
          )}
        </div>
      </form>

      {role === 'admin' && (
        <>
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4 uppercase tracking-wider">Identificadores do Sistema</h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newGlobalId}
                onChange={(e) => setNewGlobalId(e.target.value.toUpperCase())}
                placeholder="EX: PDV-CENTRO"
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              />
              <button 
                onClick={addGlobalIdentifier}
                className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-900 transition-all"
              >
                Cadastrar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {identifiers.map((id) => (
                <div key={id.docId} className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-3">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{id.id}</span>
                  <button onClick={() => deleteGlobalIdentifier(id.docId)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.0 h-3.0" />
                  </button>
                </div>
              ))}
              {identifiers.length === 0 && <p className="text-xs text-slate-400 italic">Nenhum identificador cadastrado.</p>}
            </div>
          </section>

          <UserManagement identifiers={identifiers} />
        </>
      )}
    </div>
  );
};

const UserManagement = ({ identifiers }: { identifiers: any[] }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<any>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newIdentifier, setNewIdentifier] = useState('');
  
  // Form State for new user
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'viewer'
  });

  // Form State for editing user
  const [editForm, setEditForm] = useState({
    displayName: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddModal(false);
        setNewUser({ email: '', password: '', displayName: '', role: 'viewer' });
        alert('Usuário criado com sucesso! O acesso exigirá troca de senha no primeiro login.');
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (err) {
      alert('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: showEditModal.uid,
          displayName: editForm.displayName,
          email: editForm.email
        })
      });
      if (res.ok) {
        setShowEditModal(null);
        alert('Dados do usuário atualizados com sucesso!');
      } else {
        const data = await res.json();
        alert('Erro: ' + data.error);
      }
    } catch (err) {
      alert('Erro na conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação é irreversível.')) return;
    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid })
      });
      if (!res.ok) alert('Erro ao excluir usuário.');
    } catch (err) {
      alert('Erro na conexão.');
    }
  };

  const [resetPass, setResetPass] = useState('');
  const handleResetPassword = async (uid: string) => {
    if (!resetPass) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, newPassword: resetPass })
      });
      if (res.ok) {
        setShowPasswordModal(null);
        setResetPass('');
        alert('Senha alterada com sucesso!');
      } else {
        alert('Erro ao alterar senha.');
      }
    } catch (err) {
      alert('Erro na conexão.');
    } finally {
      setLoading(false);
    }
  };

  const toggleIdentifier = async (user: any, identifier: string) => {
    const current = user.allowedIdentifiers || [];
    const updated = current.includes(identifier) 
      ? current.filter((id: string) => id !== identifier)
      : [...current, identifier];
    
    await updateDoc(doc(db, 'users', user.id), { allowedIdentifiers: updated });
  };

  const updateRole = async (user: any, newRole: string) => {
    await updateDoc(doc(db, 'users', user.id), { role: newRole });
  };

  return (
    <div className="space-y-6 mt-12">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wider">Gestão de Usuários</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Controles de acesso e permissões</p>
          </div>
        </div>
        <button 
          type="button"
          onClick={() => setShowAddModal(true)}
          className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-3 h-3" />
          Novo Usuário
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            <tr className="border-b border-slate-100">
              <th className="px-6 py-4">Usuário</th>
              <th className="px-6 py-4">Perfil</th>
              <th className="px-6 py-4">Identificadores Associados</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 text-sm">{u.displayName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{u.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select 
                    value={u.role}
                    onChange={(e) => updateRole(u, e.target.value)}
                    className="bg-slate-100 border-none text-[10px] font-bold uppercase tracking-widest rounded-full px-3 py-1 text-slate-600 focus:ring-2 focus:ring-emerald-500 transition-all outline-none cursor-pointer"
                  >
                    <option value="admin">Administrador</option>
                    <option value="viewer">Visualizador</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {u.allowedIdentifiers?.map((id: string) => (
                      <span key={id} className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                        {id}
                        <button onClick={() => toggleIdentifier(u, id)} className="hover:text-emerald-900">
                          <X className="w-2.0 h-2.0" />
                        </button>
                      </span>
                    )) || <span className="text-[10px] text-slate-300 italic">Nenhum associado</span>}
                    <button 
                      onClick={() => setEditingUser(u)}
                      className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => {
                        setEditForm({ displayName: u.displayName, email: u.email });
                        setShowEditModal(u);
                      }}
                      className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"
                      title="Editar Usuário"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setShowPasswordModal(u)}
                      className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                      title="Alterar Senha"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(u.uid)}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      title="Excluir Usuário"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {/* Modal: Edit User */}
        {showEditModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-xl border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">Editar Usuário</h3>
                <button onClick={() => setShowEditModal(null)} className="text-slate-400 hover:bg-slate-100 p-1 rounded transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome Completo</label>
                  <input 
                    type="text" required
                    value={editForm.displayName}
                    onChange={(e) => setEditForm({...editForm, displayName: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail</label>
                  <input 
                    type="email" required
                    value={editForm.email}
                    onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowEditModal(null)}
                    className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all border border-slate-200"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal: Add User */}
        {showAddModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-xl border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">Novo Usuário</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:bg-slate-100 p-1 rounded transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome Completo</label>
                  <input 
                    type="text" required
                    value={newUser.displayName}
                    onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                    placeholder="João Silva"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail</label>
                  <input 
                    type="email" required
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    placeholder="joao@email.com"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Senha Temporária</label>
                  <input 
                    type="password" required
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    placeholder="••••••"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Perfil de Acesso</label>
                  <select 
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="viewer">Visualizador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div className="pt-4">
                  <button 
                    disabled={loading}
                    type="submit"
                    className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95"
                  >
                    {loading ? 'Criando...' : 'Criar Usuário'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal: Change Password (Admin) */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-500" />
                  <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">Alterar Senha</h3>
                </div>
                <button onClick={() => setShowPasswordModal(null)} className="text-slate-400 hover:bg-slate-100 p-1 rounded transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-[11px] text-slate-500">Defina uma nova senha para o usuário <strong>{showPasswordModal.displayName}</strong>.</p>
                <input 
                  type="password" 
                  value={resetPass}
                  onChange={(e) => setResetPass(e.target.value)}
                  placeholder="Nova senha (mínimo 6 caracteres)"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={() => handleResetPassword(showPasswordModal.uid)}
                  disabled={loading || resetPass.length < 6}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95"
                >
                  {loading ? 'Redefinindo...' : 'Confirmar Nova Senha'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal: Identifiers */}
        {editingUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-xl border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs">Gerir Identificadores</h3>
                <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:bg-slate-100 p-1 rounded transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-[11px] text-slate-500">Vincule identificadores para o colaborador <strong>{editingUser.displayName}</strong> filtrar relatórios.</p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newIdentifier}
                    onChange={(e) => setNewIdentifier(e.target.value.toUpperCase())}
                    placeholder="EX: PDV-01"
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button 
                    onClick={async () => {
                      if (newIdentifier) {
                        await toggleIdentifier(editingUser, newIdentifier);
                        setNewIdentifier('');
                      }
                    }}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-emerald-700"
                  >
                    Vincular
                  </button>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Vincular Identificador Existente</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {identifiers.map((id) => {
                      const isLinked = editingUser.allowedIdentifiers?.includes(id.id);
                      return (
                        <button 
                          key={id.docId}
                          onClick={() => toggleIdentifier(editingUser, id.id)}
                          className={cn(
                            "text-[10px] font-bold px-3 py-1 rounded-lg border transition-all",
                            isLinked 
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-sm" 
                              : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                          )}
                        >
                          {id.id}
                        </button>
                      );
                    })}
                    {identifiers.length === 0 && <p className="text-[10px] text-slate-400 italic">Crie identificadores globais primeiro nas Configurações.</p>}
                  </div>

                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Vínculos Ativos</p>
                  <div className="flex flex-wrap gap-2">
                    {editingUser.allowedIdentifiers?.map((id: string) => (
                      <span key={id} className="bg-slate-100 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-lg border border-slate-200 flex items-center gap-2">
                        {id}
                        <button onClick={() => toggleIdentifier(editingUser, id)} className="text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    )) || <p className="text-xs text-slate-400 italic font-medium">Nenhum identificador vinculado.</p>}
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setEditingUser(null)}
                  className="px-6 py-2 bg-white border border-slate-200 rounded-lg font-bold text-[10px] uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Concluído
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Password Change Overlay for First Login
const PasswordChangeOverlay = ({ uid }: { uid: string }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        // Mark as changed in Firestore
        await updateDoc(doc(db, 'users', uid), {
          forcePasswordChange: false,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl border border-slate-200 space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Troca de Senha Obrigatória</h2>
          <p className="text-sm text-slate-500">Para sua segurança, por favor defina uma nova senha em seu primeiro acesso.</p>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nova Senha</label>
            <input 
              type="password" 
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confirmar Nova Senha</label>
            <input 
              type="password" 
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••"
            />
          </div>

          {error && <p className="text-xs text-red-500 font-bold text-center italic">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-sm uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
          >
            {loading ? 'Alterando...' : 'Alterar Senha e Entrar'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
const Logs = () => {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'logs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          Histórico de Atividades
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            <tr className="border-b border-slate-100">
              <th className="px-6 py-3">Data/Hora</th>
              <th className="px-6 py-3">Ação</th>
              <th className="px-6 py-3">Detalhes</th>
              <th className="px-6 py-3">Usuário</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-sm text-slate-600 font-sans">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                  Nenhum log registrado.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                    {log.createdAt ? format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss') : '-'}
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight",
                      log.action.includes('Sincronização') ? "bg-emerald-100 text-emerald-700" :
                      log.action.includes('Confirmação') ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-700"
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-[11px] text-slate-500 font-medium">
                    {log.details}
                  </td>
                  <td className="px-6 py-3 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {log.userEmail || 'Sistema'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
