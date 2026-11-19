
import React, { useState, useMemo } from 'react';
import { TrendingUp, FileText, ShoppingBag, BarChart3, Clock, PieChart, Gem, Activity, Lock, Users } from 'lucide-react';
import { Transaction, InventoryItem, Debtor } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ReportsViewProps {
  transactions?: Transaction[];
  inventory?: InventoryItem[];
  debtors?: Debtor[];
  isPro?: boolean;
  onOpenPro?: () => void;
}

type TimeRange = 'day' | 'week' | 'month';

const ReportsView: React.FC<ReportsViewProps> = ({ transactions = [], inventory = [], debtors = [], isPro = false, onOpenPro }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('day');
  const [isGenerating, setIsGenerating] = useState(false);

  const formatMoney = (amount: number) => '$ ' + Math.round(amount).toLocaleString('es-CO');

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    // Inicio del día actual (00:00:00) local
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    
    let startTime = 0;
    if (timeRange === 'day') {
        // Usamos el menor entre el inicio del día y las últimas 24h para ser más permisivos con el tiempo real
        startTime = Math.min(startOfToday, last24h);
    } else if (timeRange === 'week') {
        startTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
    } else if (timeRange === 'month') {
        startTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
    }

    return transactions.filter(t => {
      let txTime: number;
      if (typeof t.date === 'number') {
        txTime = t.date;
      } else {
        const dateStr = String(t.date);
        txTime = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T')).getTime();
      }
      
      // Fallback: si el timestamp es inválido (NaN), excluimos pero no rompemos
      if (isNaN(txTime)) return false;
      
      return txTime >= startTime;
    });
  }, [transactions, timeRange]);

  const stats = useMemo(() => {
    let totalVendido = 0;
    let costoDeLoVendido = 0;
    let totalGastos = 0;
    const itemsVendidos: Record<string, { qty: number, total: number, profit: number }> = {};

    filteredTransactions.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'venta') {
        totalVendido += amt;
        if (tx.items && tx.items.length > 0) {
          tx.items.forEach(item => {
            const invProd = inventory?.find(i => String(i.id) === String(item.id) || i.name === item.name);
            const unitCost = invProd && Number(invProd.cost) > 0 ? Number(invProd.cost) : (Number(item.price) * 0.8);
            const qty = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            
            const subtotalCost = unitCost * qty;
            const subtotalRevenue = price * qty;
            costoDeLoVendido += subtotalCost;

            if (!itemsVendidos[item.name]) itemsVendidos[item.name] = { qty: 0, total: 0, profit: 0 };
            itemsVendidos[item.name].qty += qty;
            itemsVendidos[item.name].total += subtotalRevenue;
            itemsVendidos[item.name].profit += (subtotalRevenue - subtotalCost);
          });
        } else {
          // Fallback para ventas sin items (estimación 20% margen)
          costoDeLoVendido += (amt * 0.8);
        }
      } else if (tx.type === 'gasto') {
        totalGastos += amt;
      }
    });

    const totalDeudaProveedores = inventory?.reduce((acc, item) => acc + (item.supplierDebt || 0), 0) || 0;
    const totalFiados = debtors?.reduce((acc, d) => acc + (d.debt || 0), 0) || 0;
    const gananciaBruta = (totalVendido - costoDeLoVendido) || 0;
    const gananciaNeta = (gananciaBruta - totalGastos) || 0;

    return {
      totalVendido: totalVendido || 0,
      totalGastos: totalGastos || 0,
      gananciaNeta: gananciaNeta || 0,
      gananciaBruta: gananciaBruta || 0,
      totalDeudaProveedores: totalDeudaProveedores || 0,
      totalFiados: totalFiados || 0,
      topItems: Object.entries(itemsVendidos)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total)
    };
  }, [filteredTransactions, inventory, debtors]);

  const chartData = useMemo(() => {
      return [
          { name: 'Ventas', valor: stats.totalVendido, color: '#10b981' }, // Emerald-500
          { name: 'Gastos', valor: stats.totalGastos, color: '#f43f5e' },  // Rose-500
          { name: 'Deuda Prov.', valor: stats.totalDeudaProveedores, color: '#f59e0b' }, // Amber-500
          { name: 'Ganancia', valor: stats.gananciaNeta, color: '#3b82f6' } // Blue-500
      ];
  }, [stats]);

  const downloadPDFReport = () => {
    if (!isPro && timeRange !== 'day') {
        onOpenPro?.();
        return;
    }
    setIsGenerating(true);
    try {
      const JsPDFConstructor = (jsPDF as unknown as { jsPDF: typeof jsPDF }).jsPDF || jsPDF;
      const doc = new JsPDFConstructor();
      
      const dateStr = new Date().toLocaleDateString('es-CO');
      const rangeText = timeRange === 'day' ? 'HOY' : timeRange === 'week' ? 'ESTA SEMANA' : 'ESTE MES';

      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 45, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text('AUDITORÍA DE INVENTARIO Y VENTAS', 105, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`SIGA Zambrano Pro - Periodo: ${rangeText} | Generado: ${dateStr}`, 105, 30, { align: 'center' });

      autoTable(doc, {
          startY: 55,
          head: [['CONCEPTO', 'VALOR ACUMULADO']],
          body: [
              ['RECAUDO TOTAL VENTAS', formatMoney(stats.totalVendido)],
              ['COSTO MERCANCÍA VENDIDA', formatMoney(stats.totalVendido - stats.gananciaBruta)],
              ['UTILIDAD BRUTA', formatMoney(stats.gananciaBruta)],
              ['GASTOS OPERATIVOS', formatMoney(stats.totalGastos)],
              ['DEUDA PROVEEDORES', formatMoney(stats.totalDeudaProveedores)],
              ['DINERO EN LA CALLE (FIADOS)', formatMoney(stats.totalFiados)],
              ['GANANCIA NETA FINAL', formatMoney(stats.gananciaNeta)],
          ],
          theme: 'striped',
          headStyles: { fillColor: [16, 185, 129] }
      });

      const auditY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
      doc.setTextColor(0,0,0);
      doc.setFontSize(14);
      doc.text('CONTROL DE MOVIMIENTO DE STOCK', 14, auditY);

      const auditRows = inventory.map(item => {
          const soldData = stats.topItems.find(i => i.name === item.name);
          const soldQty = soldData ? soldData.qty : 0;
          return [
              item.name,
              `${soldQty} ${item.unit}`,
              `${item.stock} ${item.unit}`,
              formatMoney(item.stock * item.cost)
          ];
      });

      autoTable(doc, {
          startY: auditY + 5,
          head: [['Producto', 'Cant. Vendida', 'Stock Actual', 'Valor Bodega']],
          body: auditRows,
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 8 }
      });

      doc.save(`Auditoria_${rangeText}.pdf`);
    } catch (e) {
      console.error("PDF Error:", e);
      alert('Error al generar PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Selector de Tiempo y Botón Reporte */}
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center px-1">
           <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-2 font-display">
             <Activity className="text-emerald-500 w-6 h-6" /> Rendimiento
           </h2>
           <div className="bg-white dark:bg-slate-800 p-1 rounded-2xl flex shadow-sm border border-slate-100 dark:border-slate-700">
              {['day', 'week', 'month'].map(r => (
                  <button 
                    key={r} 
                    onClick={() => {
                        setTimeRange(r as TimeRange);
                    }} 
                    className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all flex items-center gap-1 ${timeRange === r ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      {r === 'day' ? 'HOY' : r === 'week' ? 'SEMANA' : 'MES'}
                  </button>
              ))}
           </div>
        </div>

        <button 
          onClick={downloadPDFReport}
          disabled={isGenerating}
          className="group w-full bg-slate-900 text-white py-6 rounded-[32px] font-black flex items-center justify-center gap-4 shadow-xl shadow-slate-200 dark:shadow-none active:scale-95 transition-all relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          {isGenerating ? <Clock className="animate-spin" /> : <FileText size={24} className="text-emerald-500 shrink-0 group-hover:scale-110 transition-transform" />}
          <span className="text-sm tracking-tight relative z-10">{isGenerating ? 'GENERANDO INFORME...' : 'DESCARGAR AUDITORÍA COMPLETA'}</span>
        </button>
      </div>

      {/* Gráfico de Comparativa */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[40px] shadow-xl shadow-slate-100 dark:shadow-none border border-slate-50 dark:border-slate-700">
          <div className="flex items-center justify-between mb-8">
              <p className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <BarChart3 size={16} className="text-blue-500" /> Comparativa de Flujo
              </p>
              <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border shadow-sm ${stats.gananciaNeta >= 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                  <span className="text-[10px] font-black uppercase tracking-tighter">
                      NETO: {formatMoney(stats.gananciaNeta)}
                  </span>
              </div>
          </div>
          <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 30, right: 0, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 10, fontWeight: '800', fill: '#64748b'}}
                        dy={25}
                      />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', backgroundColor: '#0f172a', color: '#fff', padding: '12px' }} 
                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                        cursor={{ fill: 'transparent' }}
                        formatter={(value: number) => [formatMoney(value), '']}
                      />
                      <Bar 
                        dataKey="valor" 
                        radius={[10, 10, 10, 10]} 
                        barSize={40}
                        label={(props: { x: number; y: number; width: number; value: number }) => {
                            const { x, y, width, value } = props;
                            return (
                                <text 
                                  x={x + width / 2} 
                                  y={value < 0 ? y + 25 : y - 15} 
                                  fill={value < 0 ? '#f43f5e' : '#1e293b'}
                                  fontSize={10}
                                  fontWeight="900"
                                  textAnchor="middle"
                                  className="dark:fill-slate-200"
                                  fontFamily="Inter"
                                >
                                  {value === 0 ? '' : formatMoney(value).replace('$ ', '$')}
                                </text>
                            );
                        }}
                      >
                          {chartData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.color} 
                                opacity={entry.valor === 0 ? 0.2 : 1}
                                className="hover:opacity-80 transition-opacity cursor-pointer"
                              />
                          ))}
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
          </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 gap-6">
          {/* Tarjeta Ventas Brutas */}
          <div className="group bg-slate-900 p-10 rounded-[40px] text-white shadow-2xl shadow-emerald-100 dark:shadow-none relative overflow-hidden flex flex-col justify-center">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/20 blur-[100px] rounded-full translate-x-1/3 -translate-y-1/3 group-hover:scale-125 transition-transform duration-700" />
              <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <TrendingUp size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Recaudo Total</span>
                  </div>
                  <h4 className="text-6xl font-black tracking-tighter mb-6 text-white font-display">
                      {formatMoney(stats.totalVendido)}
                  </h4>
                  <div className="flex items-center gap-3 bg-white/10 w-fit px-4 py-2 rounded-2xl backdrop-blur-md border border-white/10">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-bold uppercase tracking-tight text-slate-300">Neto: <span className="text-white">{formatMoney(stats.gananciaNeta)}</span></span>
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[35px] border border-slate-50 dark:border-slate-700 shadow-xl shadow-slate-100 dark:shadow-none">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Stock Vendido</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter font-display">
                      {stats.topItems.reduce((a,c) => a+c.qty, 0)} <span className="text-xs text-slate-400">Items</span>
                  </p>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-4 overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: '65%' }}></div>
                  </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[35px] border border-slate-50 dark:border-slate-700 shadow-xl shadow-slate-100 dark:shadow-none">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Gastos</p>
                  <p className="text-3xl font-black text-rose-500 tracking-tighter font-display">{formatMoney(stats.totalGastos)}</p>
                  <p className="text-[10px] font-bold mt-2 text-rose-400/60 uppercase tracking-tight">Fugas de caja</p>
              </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
              <div className="bg-orange-50 p-8 rounded-[35px] text-orange-900 shadow-sm border border-orange-100/50">
                  <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-3">A Proveedores</p>
                  <h4 className="text-3xl font-black tracking-tighter text-orange-600 font-display">
                      {formatMoney(stats.totalDeudaProveedores)}
                  </h4>
              </div>
  
              <div className="bg-blue-50 p-8 rounded-[35px] text-blue-900 shadow-sm border border-blue-100/50">
                  <p className="text-[10px] font-black uppercase opacity-60 tracking-widest mb-3 flex items-center gap-2">
                    En Fiados <Users size={14} />
                  </p>
                  <h4 className="text-3xl font-black tracking-tighter text-blue-600 font-display">
                      {formatMoney(stats.totalFiados)}
                  </h4>
              </div>
          </div>
      </div>

      {/* Ranking de Salida */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[40px] shadow-xl shadow-slate-100 dark:shadow-none border border-slate-50 dark:border-slate-700">
          <div className="flex justify-between items-center mb-8">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                  <ShoppingBag size={18} className="text-emerald-500" /> Ranking de Salida
              </h3>
              <Activity size={16} className="text-slate-200" />
          </div>
          <div className="space-y-4">
              {stats.topItems.length > 0 ? stats.topItems.slice(0, 5).map((item, idx) => {
                  const invItem = inventory.find(i => i.name === item.name);
                  const remaining = invItem ? invItem.stock : 0;
                  return (
                      <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-transparent hover:border-slate-100 transition-all group">
                          <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center font-black text-emerald-600 text-xs shadow-sm border border-slate-100 dark:border-slate-700 group-hover:scale-110 transition-transform">
                                  #{idx + 1}
                              </div>
                              <div className="min-w-0">
                                  <p className="font-black text-slate-900 dark:text-white text-sm tracking-tight truncate max-w-[140px]">{item.name}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Disponible: {remaining} {invItem?.unit}</p>
                              </div>
                          </div>
                          <div className="text-right">
                              <p className="text-sm font-black text-slate-900 dark:text-white font-display">{item.qty} vendidos</p>
                              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">+{formatMoney(item.profit)}</p>
                          </div>
                      </div>
                  );
              }) : (
                  <div className="text-center py-16 opacity-30">
                      <PieChart size={48} className="mx-auto mb-4 text-slate-300" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sin ventas registradas</p>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default ReportsView;
