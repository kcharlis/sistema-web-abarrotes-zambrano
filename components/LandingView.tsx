import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ChevronRight, 
  CheckCircle2, 
  LayoutDashboard, 
  Barcode, 
  Users, 
  TrendingUp, 
  Smartphone,
  ShieldCheck,
  ArrowRight,
  Database,
  Cpu,
  FileCheck,
  Scale,
  Award,
  BookOpen,
  MapPin
} from 'lucide-react';

interface LandingViewProps {
  onStart: () => void;
}

const LandingView: React.FC<LandingViewProps> = ({ onStart }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
    }
  };

  const features = [
    {
      icon: <Barcode className="w-6 h-6 text-emerald-600" />,
      title: "Control con QR y Barras",
      description: "Escanea productos por código de barras o QR propio. Genera etiquetas PDF listas para imprimir.",
      color: "emerald"
    },
    {
      icon: <Users className="w-6 h-6 text-blue-600" />,
      title: "Control de Fiados y WhatsApp",
      description: "Gestión de deudores con semáforo de riesgo, cobro amigable por WhatsApp y cumplimiento Ley 1581.",
      color: "blue"
    },
    {
      icon: <LayoutDashboard className="w-6 h-6 text-purple-600" />,
      title: "Cálculo de Márgenes y Vencimientos",
      description: "Soporte para menudeo y bulto mayorista, margen automático y alertas cromáticas de caducidad.",
      color: "purple"
    },
    {
      icon: <TrendingUp className="w-6 h-6 text-orange-600" />,
      title: "Reportes Diarios y Cierre POS",
      description: "Auditoría en tiempo real, balance de ventas versus gastos y comprobantes válidos según Ley 527.",
      color: "orange"
    }
  ];

  const complianceStandards = [
    {
      law: "Ley 1581 de 2012",
      badge: "Habeas Data",
      title: "Protección de Datos Personales",
      desc: "Consentimiento informado obligatorio al registrar clientes para cobro de créditos y fiados en libro digital.",
      icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />
    },
    {
      law: "Ley 527 de 1999",
      badge: "Comercio Electrónico",
      title: "Mensajes de Datos y Tirillas",
      desc: "Comprobantes digitales generados en PDF con timestamp estricto e ID transaccional único con plena validez jurídica.",
      icon: <FileCheck className="w-6 h-6 text-blue-500" />
    },
    {
      law: "Ley 1480 de 2011",
      badge: "Estatuto del Consumidor",
      title: "Transparencia al Consumidor",
      desc: "Precios claros a la vista en menudeo y mayorista, historial de pagos inmutable y desglose de abonos.",
      icon: <Scale className="w-6 h-6 text-purple-500" />
    },
    {
      law: "ISO/IEC/IEEE 29148:2018",
      badge: "Ingeniería de Software",
      title: "Requisitos de Software",
      desc: "Ingeniería de requisitos y especificación de casos de uso modelados para tenderos del municipio de Zambrano, Bolívar.",
      icon: <Award className="w-6 h-6 text-amber-500" />
    }
  ];

  const techStack = [
    { name: "React 18 & TypeScript", role: "Interfaz reactiva, tipado seguro y componentes modulares" },
    { name: "Firebase Cloud Firestore v12", role: "Base de datos NoSQL serverless con sincronización offline nativa (IndexedDB)" },
    { name: "Tailwind CSS & Motion", role: "Diseño Mobile-First adaptado al contexto operativo del tendero" },
    { name: "barcode-detector & jsPDF", role: "Escaneo óptico desde cámara móvil y generación de comprobantes digitales" }
  ];

  const teamMembers = [
    {
      name: "Angélica María Daza Ochoa",
      role: "Product Owner & Levantamiento de Requisitos",
      desc: "Ingeniería de Sistemas · ECBTI UNAD"
    },
    {
      name: "Anderson David Tapia Ochoa",
      role: "Diseñador UI/UX & Aseguramiento de Calidad (QA)",
      desc: "Ingeniería de Sistemas · ECBTI UNAD"
    },
    {
      name: "Carlos Guillermo Herrera Meza",
      role: "Arquitecto de Software & Desarrollador Frontend/Cloud",
      desc: "Ingeniería de Sistemas · ECBTI UNAD"
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-emerald-100 overflow-x-hidden">
      {/* Abstract Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-emerald-100/30 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] bg-blue-100/30 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] left-[20%] w-[60%] h-[50%] bg-purple-100/20 blur-[120px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-xl border-b border-slate-100 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 group-hover:rotate-6 transition-transform">
              <Smartphone className="text-white w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-black text-2xl tracking-tighter text-slate-900 leading-none">
                SIGA<span className="text-emerald-600"> Zambrano</span>
              </span>
              <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Zambrano, Bolívar</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8 mr-8">
            <a href="#features" className="text-sm font-semibold text-slate-600 hover:text-emerald-600 transition-colors">Funcionalidades</a>
            <a href="#architecture" className="text-sm font-semibold text-slate-600 hover:text-emerald-600 transition-colors">Arquitectura & Normativa</a>
            <a href="#academic" className="text-sm font-semibold text-slate-600 hover:text-emerald-600 transition-colors">Proyecto UNAD</a>
          </div>
          <button 
            onClick={onStart}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-full font-bold text-sm hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
          >
            Abrir Aplicativo
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-36 pb-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 text-center lg:text-left z-10">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={containerVariants}
            >
              <motion.span 
                variants={itemVariants}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border border-emerald-100"
              >
                <Award className="w-3.5 h-3.5" /> Prototipo Funcional TRL 5 · UNAD 2026
              </motion.span>

              <motion.div
                variants={itemVariants}
                className="inline-flex items-start gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-bold border border-slate-200/80 mb-6 max-w-xl"
              >
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-left leading-relaxed uppercase tracking-wide">
                  Ribera del Río Magdalena · Montes de María · Con Fuerza y Voluntad para el comercio zambranero
                </span>
              </motion.div>
              
              <motion.h1 
                variants={itemVariants}
                className="font-display text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-[0.92] mb-6"
              >
                Gestión integrada para abarrotes en <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
                  Zambrano, Bolívar.
                </span>
              </motion.h1>
              
              <motion.p 
                variants={itemVariants}
                className="text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed font-medium"
              >
                Aplicativo web para la digitalización de inventario, ventas POS con escáner, control de fiados con respaldo normativo y sincronización en la nube para tiendas de abarrotes.
              </motion.p>
              
              <motion.div 
                variants={itemVariants}
                className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10"
              >
                <button 
                  onClick={onStart}
                  className="w-full sm:w-auto px-10 py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-2xl shadow-emerald-200 hover:bg-emerald-700 hover:translate-y-[-4px] transition-all active:scale-95 flex items-center justify-center gap-3 group"
                >
                  Ingresar a SIGA Zambrano
                  <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
                <a href="#architecture" className="px-8 py-5 text-slate-600 font-bold hover:text-slate-900 transition-colors flex items-center gap-2">
                  Ver Ficha Técnica <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>

              <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-slate-500 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> Soporte Offline Nativo</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> Ley 1581 de 2012</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500"/> Ley 527 de 1999</span>
              </motion.div>
            </motion.div>
          </div>

          {/* Visual Mockup */}
          <div className="flex-1 w-full max-w-sm lg:max-w-none relative lg:mt-0 mt-8">
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative z-10"
            >
              <div className="bg-slate-900 rounded-[3rem] p-4 shadow-[0_40px_90px_-20px_rgba(0,0,0,0.35)] border-[10px] border-slate-900 w-[310px] mx-auto aspect-[9/18.5] relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-20" />
                
                {/* Mockup screen */}
                <div className="bg-blue-600 h-full rounded-[1.8rem] overflow-hidden relative text-white p-5 pt-8 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <span className="text-[9px] font-black text-blue-200 uppercase tracking-widest block">SIGA Zambrano</span>
                        <h3 className="text-xl font-black italic">Resumen de Hoy</h3>
                      </div>
                      <span className="text-[9px] bg-yellow-400 text-yellow-950 font-black px-2 py-0.5 rounded-full">TRL 5</span>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-4 border border-white/20">
                      <p className="text-[10px] uppercase font-bold text-blue-100">Ventas Registradas</p>
                      <h4 className="text-3xl font-black tracking-tight mt-0.5">$ 845.000</h4>
                      <p className="text-[9px] text-emerald-200 mt-1 font-bold">+28% ganancia proyectada</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-white/10 p-3 rounded-xl">
                        <p className="text-[9px] uppercase font-bold opacity-75">Inventario</p>
                        <p className="text-sm font-black">1.280 Und</p>
                      </div>
                      <div className="bg-white/10 p-3 rounded-xl">
                        <p className="text-[9px] uppercase font-bold opacity-75">Fiados Activos</p>
                        <p className="text-sm font-black text-amber-200">6 Clientes</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 text-slate-900 shadow-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold pb-2 border-b border-slate-100">
                      <span className="text-slate-500">Modo de Operación</span>
                      <span className="text-emerald-600">Admin / POS</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Habeas Data Ley 1581 Activo</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                      <Barcode className="w-4 h-4 text-blue-500 shrink-0" />
                      <span>Escáner QR & Barras Cámara</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 bg-slate-50 relative">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 text-center lg:text-left">
            <span className="text-emerald-600 font-black text-xs uppercase tracking-[0.3em] mb-3 block">Módulos del Sistema</span>
            <h2 className="font-display text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
              Diseñado para la realidad operativa del tendero zambranero.
            </h2>
            <p className="text-slate-500 max-w-2xl font-medium">
              Elimina las libretas de papel deterioradas y los errores de cálculo mediante interfaces de alto contraste táctil.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div 
                key={i}
                className="p-8 rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all"
              >
                <div className="mb-6 p-3 bg-slate-50 w-fit rounded-xl">
                  {f.icon}
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-medium">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture & Compliance (TRL 5) */}
      <section id="architecture" className="py-24 px-6 bg-white relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-emerald-600 font-black text-xs uppercase tracking-[0.3em] mb-3 block">TRL 5: Entorno Relevante</span>
            <h2 className="font-display text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">
              Arquitectura Técnica y Cumplimiento Normativo
            </h2>
            <p className="text-slate-500 font-medium">
              El aplicativo SIGA Zambrano implementa estándares de ingeniería de software y el marco legal colombiano vigente para el comercio electrónico y el tratamiento de datos.
            </p>
          </div>

          {/* Legal Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {complianceStandards.map((std, i) => (
              <div 
                key={i} 
                className="p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="px-3 py-1 bg-white text-slate-700 font-mono text-xs font-black rounded-lg border border-slate-200">
                      {std.law}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{std.badge}</span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">{std.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{std.desc}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center gap-2">
                  {std.icon}
                  <span className="text-xs font-bold text-slate-500">Validado en prototipo funcional</span>
                </div>
              </div>
            ))}
          </div>

          {/* Technical Stack Highlights */}
          <div className="bg-slate-900 rounded-[3rem] p-8 md:p-14 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-600/10 blur-[90px] rounded-full" />
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
                <div>
                  <span className="text-emerald-400 font-mono text-xs font-bold uppercase tracking-widest block mb-2">Stack Tecnológico</span>
                  <h3 className="text-3xl md:text-4xl font-black tracking-tight">Arquitectura Serverless Cloud & Edge</h3>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold border border-emerald-500/30">
                    Persistencia Offline IndexedDB
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {techStack.map((tech, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                      <Cpu className="w-5 h-5 text-emerald-400 shrink-0" />
                      <h4 className="font-bold text-white text-lg">{tech.name}</h4>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">{tech.role}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Project & Team (UNAD) */}
      <section id="academic" className="py-24 px-6 bg-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-12 items-start">
            
            {/* Left Column: Context */}
            <div className="lg:col-span-5 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black uppercase tracking-widest">
                <BookOpen className="w-4 h-4" /> Proyecto de Grado · UNAD
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                Desarrollo de un sistema web para la gestión integrada de inventario, ventas y clientes en tiendas de abarrotes de Zambrano, Bolívar
              </h2>
              <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-400 uppercase">Fase</span>
                  <span className="font-black text-slate-800">Fase 4: Componente Práctico (TRL 5)</span>
                </div>
                <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-400 uppercase">Curso</span>
                  <span className="font-black text-slate-800">Proyecto de Grado · Código 202016907</span>
                </div>
                <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-400 uppercase">Grupo Colaborativo</span>
                  <span className="font-black text-emerald-600">202016907_2</span>
                </div>
                <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-400 uppercase">Fecha</span>
                  <span className="font-black text-slate-800">Noviembre de 2026</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-400 uppercase">Tutor</span>
                  <span className="font-black text-blue-600">Orlando Gómez Barboza</span>
                </div>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Escuela de Ciencias Básicas, Tecnología e Ingeniería (ECBTI) · Programa de Ingeniería de Sistemas · Universidad Nacional Abierta y a Distancia (UNAD CEAD Plato – Zona Caribe ZCAR).
              </div>
            </div>

            {/* Right Column: Team Cards */}
            <div className="lg:col-span-7 space-y-4">
              <h3 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" /> Autores del Proyecto
              </h3>

              <div className="space-y-3">
                {teamMembers.map((member, i) => (
                  <div 
                    key={i} 
                    className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:border-emerald-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="font-black text-slate-900 text-lg">{member.name}</h4>
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mt-0.5">{member.role}</p>
                      <p className="text-xs text-slate-400 mt-1">{member.desc}</p>
                    </div>
                    <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xs shrink-0">
                      UNAD
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-6">
                <button 
                  onClick={onStart}
                  className="w-full py-5 bg-slate-900 hover:bg-emerald-600 text-white font-black text-lg rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  Probar Prototipo Funcional (TRL 5) <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-slate-400 text-xs font-bold uppercase tracking-widest">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black">
              SZ
            </div>
            <span>SIGA Zambrano · Municipio de Zambrano, Bolívar (UNAD 2026)</span>
          </div>
          <p>© 2026 Proyecto de Grado 202016907_2. ECBTI UNAD.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingView;
